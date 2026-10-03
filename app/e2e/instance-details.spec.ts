import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin } from './helpers';

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
  const field = dialog.locator('.instance-environment-field').filter({ hasText: 'PUBLIC_SITE_NAME' });
  await expect(field.locator('input')).toHaveAttribute('type', 'password');
  await expect(field.locator('input')).toBeEmpty();
  await field.locator('input').fill('OrbitPage test name');
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
