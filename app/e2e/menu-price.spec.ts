import { expect, test } from '@playwright/test';

test('accepts localized menu prices without rewriting the field while typing', async ({ page }) => {
  await page.goto('/admin');

  const password = 'PriceTest123!';
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Complete Setup' }).click();

  await expect(page.locator('h1.admin-title, .admin-title')).toHaveText('OrbitPage Admin');
  await page.getByRole('tab', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Add the first product' }).click();

  const price = page.getByRole('textbox', { name: 'Product price' });
  await price.clear();
  await price.pressSequentially('12,50');
  await expect(price).toHaveValue('12,50');

  await price.press('Enter');
  await expect(price).toHaveValue('12.50');
  await expect(page.locator('.menu-editor-preview')).toContainText('€12.50');

  await page.getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText('Menu saved and queued for publication')).toBeVisible();
});
