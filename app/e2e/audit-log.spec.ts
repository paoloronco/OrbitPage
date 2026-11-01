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

test('shows password guidance on demand and recent sign-ins in an accessible responsive dialog', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.goto('/en-US/dashboard/account/security');
  await expect(page.getByText('Two-step verification', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Two-factor authentication is off', { exact: true })).toHaveCount(0);
  const help = page.getByRole('button', { name: 'Password requirements', exact: true });
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await help.focus();
  await expect(page.getByRole('tooltip')).toContainText('At least 8 characters');
  await help.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.locator('#new-password').fill('StrongPass1!');
  const opener = page.getByRole('button', { name: 'View sign-ins', exact: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Recent sign-ins', exact: true });
    await expect(dialog.getByRole('columnheader', { name: 'Method' })).toBeVisible();
    await expect(dialog.getByRole('cell', { name: 'Password', exact: true }).first()).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const bounds = await dialog.boundingBox();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - await page.evaluate(() => document.documentElement.clientWidth) / 2)).toBeLessThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
  }
  expect((await page.request.get('/api/account/sign-ins')).status()).toBe(401);
});
