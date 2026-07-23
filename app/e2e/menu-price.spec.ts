import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('accepts localized menu prices without rewriting the field while typing', async ({ page }, testInfo) => {
  const priceByProject: Record<string, string> = {
    chromium: '37,45',
    firefox: '38,45',
    webkit: '39,45',
  };
  const typedPrice = priceByProject[testInfo.project.name] ?? '40,45';
  const normalizedPrice = typedPrice.replace(',', '.');
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page.getByRole('button', { name: 'Items' }).click();

  const price = page.getByRole('textbox', { name: 'Product price' }).first();
  const addFirstProduct = page.getByRole('button', { name: 'Add the first item in this section' });
  await expect(price.or(addFirstProduct)).toBeVisible();
  if (await price.count() === 0) await addFirstProduct.click();
  await expect(price).toBeVisible();
  await price.clear();
  await price.pressSequentially(typedPrice);
  await expect(price).toHaveValue(typedPrice);

  await price.press('Enter');
  await expect(price).toHaveValue(normalizedPrice);
  await expect(page.locator('.admin-menu-live-preview')).toContainText(`€${normalizedPrice}`);

  await page.getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText('Menu saved and published')).toBeVisible();
});
