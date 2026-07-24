import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('opens a searchable block library grouped by category', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await expect(dialog).toBeVisible();

  await expect(dialog.getByRole('button', { name: /All blocks/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Essentials/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Writing & structure/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Media & embeds/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Engagement/ })).toBeVisible();

  await dialog.getByRole('button', { name: /Connected services/ }).click();
  const instagram = dialog.getByRole('button', { name: /Instagram/ });
  await expect(instagram.locator('[data-service-brand="instagram"]')).toBeVisible();
  await expect(instagram.locator('[data-service-brand-tile="instagram"]')).toBeVisible();

  await dialog.getByRole('button', { name: /All blocks/ }).click();
  await dialog.getByRole('textbox', { name: 'Search blocks' }).fill('map');
  await expect(dialog.getByRole('button', { name: /Map/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Link/ })).toHaveCount(0);

  await dialog.getByRole('button', { name: /Map/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-link-id]').last()).toContainText('Map');
});

test('keeps the block library usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add content' }).click();

  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Media & embeds/ }).click();
  await expect(dialog.getByRole('button', { name: /Image/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Map/ })).toBeVisible();

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(horizontalOverflow).toBe(false);
});
