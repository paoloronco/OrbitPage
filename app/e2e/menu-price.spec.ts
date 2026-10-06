import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

test('preserves the menu draft after validation failures and saves a corrected retry', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Menu');
  const editor = page.locator('.menu-editor-stack--visual');
  await editor.locator('.menu-unified-toolbar').getByRole('button', { name: 'Add item', exact: true }).click();
  const name = editor.locator('.menu-product-editor').getByRole('textbox', { name: 'Name', exact: true });
  const save = page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true });
  let requests = 0;
  let rejectNextSave = true;
  await page.route('**/api/menu', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    requests += 1;
    if (rejectNextSave) {
      rejectNextSave = false;
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Menu name must not be empty.', code: 'MENU_INVALID' }) });
    }
    return route.fallback();
  });
  await name.fill('');
  await save.click();
  await expect(page.locator('.admin-profile-save-layer').getByRole('alert')).toContainText('name');
  expect(requests).toBe(0);
  await expect(name).toHaveValue('');
  await expect(save).toBeEnabled();

  const itemName = `Validation retry ${Date.now()}`;
  await name.fill(itemName);
  await save.click();
  await expect(page.locator('.admin-profile-save-layer').getByRole('alert')).toContainText('Menu name');
  await expect(name).toHaveValue(itemName);
  await expect(save).toBeEnabled();
  expect(requests).toBe(1);
  await save.click();
  await expect(page.locator('.admin-profile-saved-notice')).toContainText('Saved');
  expect(requests).toBe(2);
  await page.reload();
  await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: `Edit ${itemName}` }).click();
  await expect(editor.locator('.menu-product-editor').getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(itemName);
});


test('accepts localized menu prices without rewriting the field while typing', async ({ page }, testInfo) => {
  const priceByProject: Record<string, string> = {
    chromium: '37,45',
    firefox: '38,45',
    webkit: '39,45',
  };
  const basePrice = priceByProject[testInfo.project.name] ?? '40,45';
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Menu');
  const editor = page.locator('.menu-editor-stack--visual');
  await editor.locator('.menu-unified-toolbar').getByRole('button', { name: 'Add item', exact: true }).click();
  const price = editor.locator('.menu-product-editor').getByRole('textbox', { name: 'Item price' });
  await expect(price).toBeVisible();
  const typedPrice = (await price.inputValue()).replace(',', '.') === basePrice.replace(',', '.')
    ? basePrice.replace(',45', ',46') : basePrice;
  const normalizedPrice = typedPrice.replace(',', '.');
  await price.clear();
  await price.pressSequentially(typedPrice);
  await expect(price).toHaveValue(typedPrice);

  await price.press('Enter');
  await expect(price).toHaveValue(normalizedPrice);
  await expect(page.locator('.admin-menu-live-preview')).toHaveCount(0);

  await page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.admin-profile-saved-notice')).toContainText('Saved');
});

test('keeps the menu workspace inside a laptop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Menu');

  const editor = page.locator('.menu-editor-stack');
  const workflow = page.getByRole('navigation', { name: 'Menu setup workflow' });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveClass(/menu-editor-stack--visual/);
  await expect(workflow).toBeVisible();
  await expect(workflow.getByRole('button')).toHaveCount(3);
  await expect(workflow.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
  await expect(page.locator('.menu-unified-panel')).toBeVisible();
  await expect(page.locator('.admin-menu-live-preview')).toHaveCount(0);

  const clippedWorkflowLabels = await workflow.locator('button').evaluateAll((buttons) => buttons.filter((button) => {
    const label = button.querySelector<HTMLElement>('.menu-editor-tab-copy strong');
    if (!label) return true;
    const buttonBounds = button.getBoundingClientRect();
    const labelBounds = label.getBoundingClientRect();
    return labelBounds.left < buttonBounds.left || labelBounds.right > buttonBounds.right
      || label.scrollWidth > label.clientWidth + 1;
  }).length);
  expect(clippedWorkflowLabels).toBe(0);

  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    editor: (() => {
      const element = document.querySelector<HTMLElement>('.menu-editor-stack');
      return element ? element.scrollWidth - element.clientWidth : 0;
    })(),
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.editor).toBeLessThanOrEqual(1);

  const bounds = await editor.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1366);
});

test('keeps menu categories and items usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Menu');

  const workflow = page.getByRole('navigation', { name: 'Menu setup workflow' });
  await expect(workflow).toBeVisible();
  await expect(workflow.getByRole('button')).toHaveCount(3);
  const editor = page.locator('.menu-editor-stack--visual');
  await expect(editor.locator('.menu-unified-panel')).toBeVisible();
  await editor.locator('.menu-unified-toolbar').getByRole('button', { name: 'Add item', exact: true }).click();
  const firstItem = page.locator('.menu-product-editor').first();
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

test('creates, edits, reorders and removes menu content through the visible controls', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const testSuffix = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
  const categoryLabel = `Desserts ${testSuffix}`;
  const subsectionLabel = `Cakes ${testSuffix}`;
  const seasonalLabel = `Seasonal cakes ${testSuffix}`;
  const itemLabel = `Tiramisu ${testSuffix}`;

  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Menu');

  const editor = page.locator('.menu-editor-stack--visual');
  await editor.locator('.menu-unified-toolbar').getByRole('button', { name: 'Add category', exact: true }).click();
  const selectedCategory = page.getByRole('region', { name: 'Selected category' });
  const categoryName = selectedCategory.locator('#selected-menu-category-name');
  await expect(selectedCategory).toBeVisible();
  await expect(categoryName).toHaveValue('New section');
  await categoryName.fill(categoryLabel);

  await page.getByRole('button', { name: 'Subcategory', exact: true }).click();
  await expect(categoryName).toHaveValue('New subsection');
  await categoryName.fill(subsectionLabel);

  await page.getByRole('button', { name: 'Another subcategory', exact: true }).click();
  await expect(categoryName).toHaveValue('New subsection');
  await categoryName.fill(seasonalLabel);
  await page.getByRole('button', { name: 'Up', exact: true }).click();
  await selectedCategory.getByRole('button', { name: /Add item to this category/ }).click();

  const itemEditor = page.locator('.menu-product-editor');
  await expect(itemEditor).toBeVisible();
  await itemEditor.getByRole('textbox', { name: 'Name' }).fill(itemLabel);
  await itemEditor.getByRole('textbox', { name: 'Item price' }).fill('8,50');

  await page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.admin-profile-saved-notice')).toContainText('Saved');

  await page.goto(`/dashboard/editor/menu?e2eReload=${Date.now()}`, { waitUntil: 'commit' });
  await expect(page.locator('.admin-dashboard-shell')).toBeVisible({ timeout: 15_000 });
  await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: `Edit ${itemLabel}` }).click();
  await expect(page.locator('.menu-product-editor').getByRole('textbox', { name: 'Item price' })).toHaveValue('8.50');

  await page.locator('.menu-product-editor').getByRole('button', { name: 'Delete item' }).click();
  await expect(page.getByRole('button', { name: `Edit ${itemLabel}` })).toHaveCount(0);
  await page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.admin-profile-saved-notice')).toContainText('Saved');
});
