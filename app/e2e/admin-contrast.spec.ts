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
  ].join(',')).evaluateAll((elements) => elements
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
    })
    .map((element) => {
      const color = getComputedStyle(element).color;
      const channels = color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
      return { channels, text: element.textContent?.trim() ?? '' };
    }));

  expect(samples.length).toBeGreaterThan(4);
  for (const sample of samples) {
    expect(sample.channels, `Could not parse the color for "${sample.text}"`).toHaveLength(3);
    expect(
      contrastRatio(sample.channels, [255, 255, 255]),
      `Secondary copy "${sample.text}" does not meet WCAG AA contrast`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});
