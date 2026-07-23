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
  await page.getByRole('button', { name: 'Menu content' }).click();
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dishes and drinks' })).toBeVisible();

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

test('keeps menu categories and items usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: /^Menu/ }).click();

  const switcher = page.locator('.menu-content-mobile-switch');
  await expect(switcher).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();

  await switcher.getByRole('button', { name: 'Items' }).click();
  await expect(page.getByRole('heading', { name: 'Dishes and drinks' })).toBeVisible();
  await expect(page.locator('.menu-content-pane--sections')).toBeHidden();

  const firstItem = page.locator('.menu-product-editor').first();
  const emptyState = page.getByRole('button', { name: 'Add the first item in this section' });
  if (await firstItem.count() === 0) await emptyState.click();
  await expect(firstItem).toBeVisible();

  const viewportOverflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    navigation: (() => {
      const navigation = document.querySelector<HTMLElement>('.admin-dashboard-nav');
      return navigation ? navigation.scrollWidth - navigation.clientWidth : 0;
    })(),
  }));
  expect(viewportOverflow.document).toBeLessThanOrEqual(1);
  expect(viewportOverflow.navigation).toBeLessThanOrEqual(1);

  const itemBounds = await firstItem.boundingBox();
  expect(itemBounds).not.toBeNull();
  expect(itemBounds!.x).toBeGreaterThanOrEqual(0);
  expect(itemBounds!.x + itemBounds!.width).toBeLessThanOrEqual(390);
});

test('creates, edits, reorders and removes menu content through the visible controls', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: /^Menu/ }).click();

  await page.getByRole('button', { name: 'Category', exact: true }).click();
  const categoryName = page.locator('#selected-menu-category-name');
  await expect(categoryName).toHaveValue('New section');
  await categoryName.fill('Desserts');

  await page.getByRole('button', { name: 'Subcategory', exact: true }).click();
  await expect(categoryName).toHaveValue('New subsection');
  await categoryName.fill('Cakes');

  await page.getByRole('button', { name: 'Another subcategory', exact: true }).click();
  await expect(categoryName).toHaveValue('New subsection');
  await categoryName.fill('Seasonal cakes');
  await page.getByRole('button', { name: 'Up', exact: true }).click();

  await page.getByRole('button', { name: 'Cakes 0', exact: true }).click();
  await page.getByRole('button', { name: 'Manage items in this category 0' }).click();
  await page.getByRole('button', { name: 'Item', exact: true }).click();

  const editor = page.locator('.menu-product-editor');
  await expect(editor).toBeVisible();
  await editor.getByRole('textbox', { name: 'Name' }).fill('Tiramisu');
  await editor.getByRole('textbox', { name: 'Product price' }).fill('8,50');
  await editor.getByRole('button', { name: 'Option', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Option name' }).fill('Large');
  await editor.getByRole('textbox', { name: 'Option price' }).fill('11,00');

  await page.getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText('Menu saved and published')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page.getByRole('button', { name: 'Cakes 1', exact: true }).click();
  await page.getByRole('button', { name: /Tiramisu/ }).click();
  await expect(page.locator('.menu-product-editor').getByRole('textbox', { name: 'Product price' })).toHaveValue('8.50');

  await page.locator('.menu-product-editor').getByTitle('Delete product').click();
  await expect(page.getByRole('button', { name: /Tiramisu/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save menu' }).click();
  await expect(page.getByText('Menu saved and published')).toBeVisible();
});
