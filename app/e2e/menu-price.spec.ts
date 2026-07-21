import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('accepts localized menu prices without rewriting the field while typing', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('tab', { name: 'Menu' }).click();

  const price = page.getByRole('textbox', { name: 'Product price' }).first();
  const addFirstProduct = page.getByRole('button', { name: 'Add the first product' });
  await expect(price.or(addFirstProduct)).toBeVisible();
  if (await price.count() === 0) await addFirstProduct.click();
  await expect(price).toBeVisible();
  await price.clear();
  await price.pressSequentially('12,50');
  await expect(price).toHaveValue('12,50');

  await price.press('Enter');
  await expect(price).toHaveValue('12.50');
  await expect(page.locator('.menu-editor-preview')).toContainText('€12.50');

  await page.getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText('Menu saved and queued for publication')).toBeVisible();
});
