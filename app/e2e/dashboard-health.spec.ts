import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

for (const width of [390, 768, 1440]) {
  test(`dashboard navigation renders without overflow or runtime errors at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 980 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).origin === new URL(page.url()).origin && new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await openAuthenticatedAdmin(page);
    for (const section of ['Page', 'Content', 'Menu', 'Shop', 'Pages', 'AI Assistant', 'Theme', 'Publish', 'Backup', 'Analytics', 'Privacy', 'Newsletter', 'Team', 'Account', 'Plan']) {
      await openAdminSection(page, section);
      if (width < 768) await expect(page.locator('.admin-dashboard-nav-stack')).toBeHidden();
      await expect(page.locator('.admin-dashboard-heading-row h1')).toBeVisible();
      const panel = { Menu: '.menu-editor-stack', Theme: '.admin-theme-customizer', Newsletter: '.newsletter-workspace' }[section];
      if (panel) await expect(page.locator(panel)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), section).toBeLessThanOrEqual(1);
      if (['Page', 'Privacy', 'Newsletter', 'Team'].includes(section)) await page.screenshot({ path: testInfo.outputPath(`dashboard-${section.toLowerCase()}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    expect(errors).toEqual([]);
  });
}

test('menu image upload failure remains visible and does not crash the editor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Menu');
  const editor = page.locator('.menu-editor-stack--visual');
  await editor.locator('.menu-unified-toolbar').getByRole('button', { name: 'Add item', exact: true }).click();
  await page.route('**/api/upload', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Upload temporarily unavailable' }) }));
  await editor.locator('input[type="file"]').setInputFiles({ name: 'menu.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5S8AAAAASUVORK5CYII=', 'base64') });
  await expect(page.getByRole('alert')).toContainText('Upload temporarily unavailable');
  await expect(editor.locator('.menu-product-editor')).toBeVisible();
  expect(errors).toEqual([]);
});
