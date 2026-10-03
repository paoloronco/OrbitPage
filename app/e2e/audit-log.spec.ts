import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('shows the protected audit log in Account with searchable filters at phone width', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.goto('/en-US/dashboard/account/audit');
  const log = page.locator('.audit-log-panel');
  await expect(log.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  await expect(log.getByRole('columnheader', { name: 'Date and time' })).toBeVisible();
  await expect(log.getByRole('columnheader', { name: 'User' })).toBeVisible();
  await expect(log.getByRole('columnheader', { name: 'Change' })).toBeVisible();
  await log.getByRole('textbox', { name: 'Search' }).fill('profile');
  await log.getByRole('button', { name: 'Apply filters' }).click();
  await expect(log.getByRole('table')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect((await page.request.get('/api/account/audit-log')).status()).toBe(401);
});
