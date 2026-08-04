import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('groups QR, Sitemap and TXT in one responsive Publish workspace', async ({ page }) => {
  test.setTimeout(60_000);
  await openAuthenticatedAdmin(page);

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/publish$/);
  await expect(page.getByRole('heading', { name: 'Share your page and make it discoverable.' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Publishing tools' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page QR codes' })).toBeVisible();
  const desktopQrBounds = await page.getByRole('img', { name: 'Generated QR preview' }).boundingBox();
  expect(desktopQrBounds).not.toBeNull();
  expect(desktopQrBounds!.width).toBeLessThanOrEqual(220);

  await page.getByRole('tab', { name: /Sitemap/ }).click();
  await expect(page.getByRole('heading', { name: 'Sitemap', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /TXT/ }).click();
  await expect(page.getByRole('heading', { name: 'TXT files' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'TXT files' })).toBeVisible();
  await page.getByRole('tab', { name: /TXT/ }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('heading', { name: 'Page QR codes' })).toBeVisible();
  await page.getByRole('tab', { name: /TXT/ }).click();
  await page.screenshot({ path: 'test-results/publish-tools-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tablist', { name: 'Publishing tools' })).toBeVisible();
  await page.getByRole('tab', { name: /QR/ }).click();
  const mobileQrBounds = await page.getByRole('img', { name: 'Generated QR preview' }).boundingBox();
  expect(mobileQrBounds).not.toBeNull();
  expect(mobileQrBounds!.width).toBeLessThanOrEqual(190);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/publish-tools-mobile.png', fullPage: true });
});

test('redirects legacy publishing routes to the unified workspace', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.goto('/dashboard/sitemap');
  await expect(page).toHaveURL(/\/dashboard\/publish$/);
  await expect(page.getByRole('heading', { name: 'Share your page and make it discoverable.' })).toBeVisible();
});
