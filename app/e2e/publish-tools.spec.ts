import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

test('tracks new QR links and shows QR, Acquisition and Audience reports without disclosures', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Publish');
  const target = page.getByRole('link', { name: 'Test target' });
  await expect(target).toHaveAttribute('href', /utm_source=qr&utm_medium=qr/);

  const event = await page.request.post('/api/analytics/events', { data: {
    event: 'view', visitorId: 'visitor-qr-e2e', path: '/qr-e2e-destination', utmSource: 'qr', utmMedium: 'qr',
  } });
  expect(event.status()).toBe(204);

  await openAdminSection(page, 'Analytics');
  const analytics = page.getByTestId('managed-analytics');
  await expect(analytics.getByText('QR codes', { exact: true })).toBeVisible();
  await expect(analytics.locator('.managed-analytics-qr-metrics')).toContainText('QR visits');
  await expect(analytics.locator('.managed-analytics-qr-breakdown')).toContainText('/qr-e2e-destination');
  await expect(analytics.getByRole('heading', { name: 'Traffic sources', exact: true })).toBeVisible();
  await expect(analytics.getByRole('heading', { name: 'Devices', exact: true })).toBeVisible();
  await expect(analytics.locator('details.managed-analytics-disclosure')).toHaveCount(0);
});

test('groups QR, Sitemap and TXT in one responsive Publish workspace', async ({ page }) => {
  test.setTimeout(60_000);
  await openAuthenticatedAdmin(page);

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/publish\/QR$/);
  await expect(page.getByRole('tablist', { name: 'Publishing tools' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page QR codes' })).toBeVisible();
  const desktopQrBounds = await page.getByRole('img', { name: 'Generated QR preview' }).boundingBox();
  expect(desktopQrBounds).not.toBeNull();
  expect(desktopQrBounds!.width).toBeLessThanOrEqual(220);

  await page.getByRole('tab', { name: /Sitemap/ }).click();
  await expect(page.getByRole('heading', { name: 'Sitemap', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /TXT/ }).click();
  await expect(page.getByRole('heading', { name: 'TXT files' })).toBeVisible();
  const editor = page.locator('.publish-tools textarea');
  await expect(editor).toBeEditable();
  expect(await editor.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(320);
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
  for (const tab of await page.locator('.publish-tools-tab').all()) {
    const icon = (await tab.locator('svg').boundingBox())!, label = (await tab.locator('strong').boundingBox())!;
    expect(Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2)).toBeLessThan(2);
  }
  await page.getByRole('tab', { name: /Sitemap/ }).click();
  const icon = (await page.locator('#publish-tool-sitemap .admin-panel-icon').boundingBox())!;
  expect(Math.abs(icon.width - icon.height)).toBeLessThan(1);
  await page.screenshot({ path: 'test-results/publish-tools-mobile.png', fullPage: true });
  await page.getByRole('tab', { name: /TXT/ }).click();
  await expect(editor).toBeEditable();
  expect(await editor.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(320);
});

test('honors a server-declared read-only TXT demo while allowing text selection', async ({ page }) => {
  let reads = 0;
  await page.route(/\/api\/text-files(?:\?|$)/, async route => {
    reads++;
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, data: { ...body.data, demoMode: true } } });
  });
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Publish');
  await page.getByRole('tab', { name: /TXT/ }).click();
  const tools = page.locator('.publish-tools'), editor = tools.locator('textarea');
  await expect(tools.getByText('Demo read-only', { exact: true })).toBeVisible();
  expect(reads).toBeGreaterThan(0);
  await expect(editor).toHaveAttribute('readonly', '');
  await expect(editor).toBeEnabled();
  await expect(tools.getByRole('button', { name: 'Add TXT file', exact: true })).toHaveCount(0);
  await expect(tools.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  expect((await editor.inputValue()).length).toBeGreaterThan(0);
  expect(await editor.evaluate(node => { node.focus(); node.select(); return node.selectionEnd - node.selectionStart; })).toBe((await editor.inputValue()).length);
});

test('redirects legacy publishing routes to the unified workspace', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.goto('/dashboard/sitemap');
  await expect(page).toHaveURL(/\/dashboard\/publish\/QR$/);
  await expect(page.getByRole('tablist', { name: 'Publishing tools' })).toBeVisible();
});
