import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin } from './helpers';

test('INFO shows saved service status, honest health results and support links on mobile', async ({ page }, testInfo) => {
  let reads = 0;
  const info = { checkedAt: '2026-10-09T00:00:00Z', shop: { published: true, stripe: { connected: true, ready: true, livemode: false },
    email: { mode: 'custom', configured: true, verifiedAt: '2026-10-09T00:00:00Z' }, calendar: { configured: true, webhookVerified: false } },
    instance: { version: '4.21.88', node: 'v22.23.3', uptime: 120, checks: [{ id: 'database', status: 'ok' }, { id: 'vulnerabilities', status: 'unavailable' }],
      audit: { status: 'unavailable', counts: null, checkedAt: '2026-10-09T00:00:00Z' } } };
  await page.route('**/api/shop/info?*', route => { reads++; return route.fulfill({ json: info }); });
  await openAuthenticatedAdmin(page);
  await page.goto('/en-US/dashboard/editor/shop/legal');
  await page.getByRole('navigation', { name: 'Shop settings sections' }).getByRole('button', { name: 'INFO', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'INFO', exact: true })).toBeVisible();
  const panel = page.locator('.account-info-workspace');
  await expect(panel.getByText('Published', { exact: true })).toBeVisible();
  await expect(panel.getByText('Own SMTP server', { exact: true })).toBeVisible();
  await expect(panel.getByText('Test mode', { exact: true })).toHaveCSS('color', 'rgb(180, 83, 9)');
  await expect(panel.getByText('Calendar webhook not yet verified', { exact: true })).toBeVisible();
  await expect(panel.getByText('Not verified', { exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', /shop\.md#info$/);
  await expect(panel.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', /docs\/wiki\/faq\.md$/);
  expect((await page.request.get('/api/shop/info')).status()).toBe(401);
  await panel.getByRole('button', { name: 'Refresh' }).click();
  await expect.poll(() => reads).toBe(2);
  await page.reload();
  await page.getByRole('navigation', { name: 'Shop settings sections' }).getByRole('button', { name: 'INFO', exact: true }).click();
  await expect(panel.getByText('Own SMTP server', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByRole('button', { name: 'Refresh' }).focus();
  await expect(panel.getByRole('button', { name: 'Refresh' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('oss-info-mobile.png'), fullPage: true });
});

test('shows installation diagnostics and edits masked runtime variables', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.goto('/en-US/dashboard/account/general');
  const card = page.locator('.account-instance-card');
  await expect(card.getByText('Database path')).toBeVisible();
  await expect(card.getByText('DATA_DIR', { exact: true })).toBeVisible();
  await expect(card.getByText('Space used')).toBeVisible();
  await expect(card.getByText('Uploads used')).toBeVisible();
  await expect(card.locator('.instance-service')).toHaveCount(4);
  const details = await page.request.get('/api/account/instance-details');
  expect(details.status()).toBe(401);

  await card.getByRole('button', { name: 'Environment variables…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Environment variables' });
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await card.getByRole('button', { name: 'Environment variables…' }).click();
  const field = dialog.locator('.instance-environment-field').filter({ hasText: 'PUBLIC_SITE_NAME' });
  await expect(field.locator('input')).toHaveAttribute('type', 'password');
  await expect(field.locator('input')).toBeEmpty();
  await field.locator('input').fill('OrbitPage test name');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await expect(field.locator('input')).toHaveValue('OrbitPage test name');
  await dialog.getByLabel('Current password').fill(E2E_ADMIN_PASSWORD);
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByText('Restart the instance to apply the saved changes.')).toBeVisible();
  await card.getByRole('button', { name: 'Environment variables…' }).click();
  const savedField = page.getByRole('dialog', { name: 'Environment variables' }).locator('.instance-environment-field').filter({ hasText: 'PUBLIC_SITE_NAME' });
  await expect(savedField.getByText('Override saved')).toBeVisible();
  await expect(savedField.locator('input')).toBeEmpty();
  await savedField.getByRole('button', { name: 'Use host' }).click();
  await page.getByRole('dialog', { name: 'Environment variables' }).getByLabel('Current password').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole('dialog', { name: 'Environment variables' }).getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog', { name: 'Environment variables' })).toBeHidden();
});
