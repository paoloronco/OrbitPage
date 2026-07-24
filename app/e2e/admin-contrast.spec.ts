import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

function relativeLuminance([red, green, blue]: number[]) {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground: number[], background: number[]) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function findLowContrastCopy(page: import('@playwright/test').Page) {
  return page.locator('.orbitpage-admin *').evaluateAll((elements) => {
    const parseColor = (value: string) => {
      const channels = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      return channels.length >= 3
        ? [channels[0], channels[1], channels[2], channels[3] ?? 1]
        : null;
    };
    const luminance = (channels: number[]) => {
      const values = channels.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * values[0]) + (0.7152 * values[1]) + (0.0722 * values[2]);
    };
    const ratio = (foreground: number[], background: number[]) => {
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    };
    const getBackground = (element: Element) => {
      let current: Element | null = element;
      while (current) {
        const style = getComputedStyle(current);
        const color = parseColor(style.backgroundColor);
        if (color && color[3] >= 0.75 && style.backgroundImage === 'none') return color;
        current = current.parentElement;
      }
      return [255, 255, 255, 1];
    };

    return elements.flatMap((element) => {
      if (
        element.closest('.public-page-content') ||
        element.closest('.admin-preview-device__screen') ||
        element.closest('[disabled], [aria-disabled="true"]')
      ) return [];
      const text = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (!text || /^(?:✓|○)$/.test(text)) return [];
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      if (
        bounds.width <= 0 ||
        bounds.height <= 0 ||
        style.visibility === 'hidden' ||
        style.display === 'none' ||
        Number(style.opacity) < 0.8
      ) return [];
      const foreground = parseColor(style.color);
      if (!foreground) return [];
      const background = getBackground(element);
      const score = ratio(foreground, background);
      return score < 4.5 ? [{
        background: `rgb(${background.slice(0, 3).join(', ')})`,
        color: style.color,
        score: Number(score.toFixed(2)),
        text: text.slice(0, 90),
      }] : [];
    });
  });
}

async function expectReadableDashboardCopy(
  page: import('@playwright/test').Page,
  workspace: string,
) {
  expect(
    await findLowContrastCopy(page),
    `Low-contrast copy found in the ${workspace} workspace`,
  ).toEqual([]);
}

test('keeps secondary dashboard copy readable across the main workspaces', async ({ page }) => {
  await openAuthenticatedAdmin(page);

  const contentTab = page.getByRole('button', { name: 'Content', exact: true });
  await contentTab.click();
  await page.getByRole('button', { name: /Menu/ }).first().click();

  const samples = await page.locator([
    '.admin-dashboard-logo-copy small',
    '.admin-dashboard-header > div:first-child > p:last-child',
    '.admin-metric-label',
    '.admin-metric-detail',
    '.content-workspace-option small',
    '.menu-editor-intro span',
    '.menu-editor-section-title p',
  ].join(',')).evaluateAll((elements) => {
    const colorChannels = (value: string) => value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const backgroundFor = (element: Element) => {
      let current: Element | null = element;
      while (current) {
        const style = getComputedStyle(current);
        const channels = colorChannels(style.backgroundColor);
        if (channels.length >= 3 && (channels[3] ?? 1) >= 0.75 && style.backgroundImage === 'none') {
          return channels.slice(0, 3);
        }
        current = current.parentElement;
      }
      return [255, 255, 255];
    };

    return elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
      })
      .map((element) => {
        const channels = colorChannels(getComputedStyle(element).color).slice(0, 3);
        return { background: backgroundFor(element), channels, text: element.textContent?.trim() ?? '' };
      });
  });

  expect(samples.length).toBeGreaterThan(4);
  for (const sample of samples) {
    expect(sample.channels, `Could not parse the color for "${sample.text}"`).toHaveLength(3);
    expect(
      contrastRatio(sample.channels, sample.background),
      `Secondary copy "${sample.text}" does not meet WCAG AA contrast (${JSON.stringify(sample)})`,
    ).toBeGreaterThanOrEqual(4.5);
  }

  await expectReadableDashboardCopy(page, 'Content / Menu');

  for (const workspace of ['Page', 'Theme', 'Publish', 'Backup', 'Analytics', 'Privacy']) {
    const navigationItem = page.getByRole('button', { name: workspace, exact: true }).first();
    if (await navigationItem.count() === 0) continue;
    await navigationItem.click();
    await page.waitForTimeout(80);
    await expectReadableDashboardCopy(page, workspace);
  }
});
