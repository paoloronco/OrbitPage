import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin, preservePageData, saveEditorChanges } from './helpers';

test.use({ hasTouch: true });

test('public cards wrap long text and ignore legacy text coordinates at every width', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const links = ['link', 'text', 'cta'].map((type, index) => ({
      id: `long-${index}`, type, title: `Long ${type} title ${'unbroken'.repeat(10)}`,
      description: 'A complete description with useful details. '.repeat(18),
      content: type === 'text' ? 'Information that must always remain readable. '.repeat(20) : '',
      url: `https://example.com/${'long-url-'.repeat(24)}`, isActive: true,
      alignment: ['left', 'center', 'right'][index],
    }));
    const layout = {
      positions: Object.fromEntries(links.map((link, index) => [link.id, { x: 0, y: index * 156, width: 100, height: 132 }])),
      contents: { 'long-0': { positions: { title: { x: 80, y: 800, width: 20, height: 24 } } } },
      height: 444,
    };
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: { profile: { name: '', bio: '', avatar: '', showAvatar: false, appearance: { cardLayouts: { desktop: layout, mobile: layout } } }, links, theme: {}, branding: { showOrbitPageBadge: false } },
      consentConfig: { mode: 'disabled', enabled: false },
    };
  });
  await page.goto('/');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('[data-card-layout-item]')).toHaveCount(3);
    await expect.poll(() => page.locator('[data-card-layout-item]').evaluateAll(cards => {
      const bounds = cards.map(card => card.getBoundingClientRect());
      return cards.every((card, index) => {
        const surface = card.querySelector('.glass-card, .public-cta-card')!;
        return surface.scrollWidth <= surface.clientWidth + 1
          && surface.scrollHeight <= surface.clientHeight + 1
          && (index === 0 || bounds[index].top >= bounds[index - 1].bottom);
      }) && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await expect(page.locator('.public-link-card__layout-item, [data-card-layout-mode]')).toHaveCount(0);
    await expect(page.locator('[data-card-content-layout-item="title"] h3')).toHaveCSS('text-align', 'left');
  }
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`Arrange tracks the pointer, cancels and preserves other cards at ${width}px`, async ({ page, browserName }) => {
    await page.setViewportSize({ width, height: 980 });
    await openAuthenticatedAdmin(page);
    const restore = await preservePageData(page);
    try {
      await page.getByRole('button', { name: 'Content', exact: true }).click();
      for (let index = 0; index < 2; index++) {
        await page.getByRole('button', { name: 'Content', exact: true }).click();
        await page.getByRole('button', { name: 'Add content' }).click();
        await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /^Link\b/ }).click();
        await saveEditorChanges(page);
      }
      const id = await page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last().getAttribute('data-public-editor-link-id');
      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      const card = page.locator(`[data-card-layout-item="${id}"]`);
      const handle = card.getByRole('button', { name: /^Move card/ });
      await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const position = async () => (await card.getAttribute('data-card-layout-position'))!.split(',').map(Number);
      const before = await position();
      const others = () => page.locator(`[data-card-layout-item]:not([data-card-layout-item="${id}"])`).evaluateAll(cards => cards.map(card => card.getAttribute('data-card-layout-position')));
      const otherPositions = await others();
      const start = (await handle.boundingBox())!;
      expect(start.width).toBeGreaterThanOrEqual(43.5);
      expect(start.height).toBeGreaterThanOrEqual(43.5);
      const canvas = page.locator('.public-card-stack--layout');
      const scale = await canvas.evaluate(element => element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth);
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 - 28, { steps: 5 });
      await expect.poll(async () => (await position())[1]).toBe(Math.round(before[1] - 28 / scale));
      expect(await others()).toEqual(otherPositions);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(await position()).toEqual(before);
      if (width === 390 && browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        const touch = (await handle.boundingBox())!;
        const point = { x: touch.x + touch.width / 2, y: touch.y + touch.height / 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y - 20 }] });
        await expect.poll(async () => (await position())[1]).not.toBe(before[1]);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await expect.poll(position).toEqual(before);
        await cdp.detach();
      }
      await handle.press('Shift+ArrowUp');
      await expect.poll(async () => (await position())[1]).toBe(before[1] - 10);
      expect(await others()).toEqual(otherPositions);
      await expect(card.locator('[data-card-layout-mode]')).toHaveCount(0);
      await expect(card.locator('.page-card-layout__surface')).toHaveAttribute('inert', '');
      await saveEditorChanges(page);
      await page.reload();
      await expect.poll(async () => (await position())[1]).toBe(before[1] - 10);
    } finally {
      await restore();
    }
  });
}
