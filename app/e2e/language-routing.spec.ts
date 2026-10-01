import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

test('keeps dashboard language in navigation history and public pages without it', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await expect(page).toHaveURL(/\/en-US\/dashboard\/profile$/);
  await openAdminSection(page, 'Account');
  await expect(page).toHaveURL(/\/en-US\/dashboard\/account$/);
  await page.getByLabel('Language', { exact: true }).selectOption('it');
  await expect(page).toHaveURL(/\/it-IT\/dashboard\/account$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/en-US\/dashboard\/profile$/);
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
  await page.goForward();
  await expect(page).toHaveURL(/\/it-IT\/dashboard\/account$/);
  await expect(page.getByLabel('Lingua', { exact: true })).toHaveValue('it');
  await page.reload();
  await expect(page.getByLabel('Lingua', { exact: true })).toHaveValue('it');
  await expect(page.locator('.oss-account-page-action strong')).toHaveText(/^http:\/\/localhost:\d+\/$/);
  await page.goto('/dashboard/account?source=bookmark#security');
  await expect(page).toHaveURL(/\/it-IT\/dashboard\/account\?source=bookmark#security$/);
  await page.goto('/it-IT?source=bookmark');
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/\?source=bookmark$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
