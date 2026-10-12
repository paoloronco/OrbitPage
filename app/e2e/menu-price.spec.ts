import { expect, test, type Page } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

const itemDialog = (page: Page) => page.getByRole('dialog', { name: 'Edit item', exact: true });
const sectionDialog = (page: Page) => page.getByRole('dialog', { name: 'Edit section', exact: true });
const saveButton = (page: Page) => page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true });
async function saveMenu(page: Page) {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/menu' && response.request().method() === 'PUT');
  await saveButton(page).click();
  expect((await response).status()).toBe(200);
  await expect(saveButton(page)).toBeHidden();
}

test('protects popup drafts, rejects empty names and preserves a failed menu save for retry', async ({ page }) => {
  await openAuthenticatedAdmin(page); await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = itemDialog(page), name = dialog.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill(''); await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await page.mouse.click(2,2); await expect(dialog).toBeVisible();
  const label = 'Retry item ' + Date.now(); await name.fill(label);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.route('**/api/menu', async route => route.request().method() === 'PUT' ? route.fulfill({ status: 400, json: { error: 'Fictional menu save failure' } }) : route.fallback(), { times: 1 });
  await saveButton(page).click(); await expect(page.getByRole('alert')).toContainText('Fictional menu save failure');
  await page.getByRole('button', { name: 'Edit ' + label, exact: true }).click(); await expect(name).toHaveValue(label);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await saveMenu(page);
  await page.reload(); await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Edit ' + label, exact: true }).click(); await expect(name).toHaveValue(label);
});

test('accepts localized prices without changing the field while typing', async ({ page }, testInfo) => {
  await openAuthenticatedAdmin(page); await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = itemDialog(page), label = 'Price item ' + testInfo.project.name + Date.now();
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(label);
  const price = dialog.getByRole('textbox', { name: 'Item price', exact: true });
  await price.clear(); await price.pressSequentially('37,45'); await expect(price).toHaveValue('37,45');
  await price.press('Enter'); await expect(price).toHaveValue('37.45');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await saveMenu(page);
  await page.reload(); await openAdminSection(page, 'Menu'); await page.getByRole('button', { name: 'Edit ' + label, exact: true }).click(); await expect(price).toHaveValue('37.45');
});

test('adds sections and subsections from popups, reorders them, and edits or deletes dishes on the preview', async ({ page }) => {
  await openAuthenticatedAdmin(page); await openAdminSection(page, 'Menu');
  const stamp = String(Date.now()), section = 'Wine ' + stamp, subsection = 'Seasonal ' + stamp, dish = 'Drink ' + stamp;
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  const category = sectionDialog(page); await category.getByRole('textbox', { name: 'Name', exact: true }).fill(section);
  await category.getByRole('button', { name: 'Subcategory', exact: true }).click(); await category.getByRole('textbox', { name: 'Name', exact: true }).fill(subsection);
  await category.getByRole('button', { name: /Add item to this section/ }).click();
  const item = itemDialog(page); await item.getByRole('textbox', { name: 'Name', exact: true }).fill(dish); await item.getByRole('textbox', { name: 'Item price', exact: true }).fill('8,50');
  await item.getByRole('button', { name: 'Apply', exact: true }).click(); await saveMenu(page);
  await page.reload(); await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Edit ' + dish, exact: true }).click(); await expect(item.getByRole('textbox', { name: 'Item price' })).toHaveValue('8.50'); await item.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('.menu-preview-canvas').getByRole('button', { name: section, exact: true }).click(); await expect(category.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(section); await category.getByRole('button', { name: 'Up', exact: true }).click(); await category.getByRole('button', { name: 'Apply', exact: true }).click(); await saveMenu(page);
  await page.getByRole('button', { name: 'Edit ' + dish, exact: true }).click(); await item.getByRole('button', { name: 'Delete item', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit ' + dish, exact: true })).toHaveCount(0); await saveMenu(page);
});

test('opens the mobile menu by default and edits title and description with safe cancellation', async ({ page }) => {
  await openAuthenticatedAdmin(page); await openAdminSection(page, 'Menu');
  await expect(page.locator('.menu-preview-canvas [data-preview-source-width="390"]')).toHaveAttribute('data-preview-viewport-ready', 'true');
  await expect(page.getByRole('button', { name: 'Mobile preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Edit menu title', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Menu title and description', exact: true });
  const title = dialog.getByRole('textbox', { name: 'Title', exact: true }), original = await title.inputValue();
  await title.fill('Unsaved popup title'); await page.mouse.click(2,2); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.locator('.menu-preview-canvas h1')).toHaveText(original);
  await page.getByRole('button', { name: 'Edit menu description', exact: true }).click(); await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Menu description ' + Date.now()); await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await saveMenu(page);
  await page.getByRole('button', { name: 'Desktop preview', exact: true }).click(); await expect(page.locator('.menu-preview-canvas [data-preview-source-width="1280"]')).toHaveAttribute('data-preview-viewport-ready', 'true');
  await page.reload(); await openAdminSection(page, 'Menu'); await expect(page.getByRole('button', { name: 'Mobile preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('keeps the preview, Personalize and dialogs usable from phones to laptops', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 980 }); await openAuthenticatedAdmin(page); await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Personalize', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Personalize menu', exact: true }); await expect(panel).toBeVisible();
  const previewBounds = (await page.getByRole('region', { name: 'Menu preview' }).boundingBox())!, panelBounds = (await panel.boundingBox())!;
  expect(panelBounds.x).toBeGreaterThanOrEqual(previewBounds.x + previewBounds.width); expect(panelBounds.width).toBeGreaterThanOrEqual(320); expect(panelBounds.width).toBeLessThanOrEqual(390);
  await panel.getByRole('combobox', { name: 'Typography', exact: true }).selectOption('sans'); await expect(page.locator('.menu-preview-canvas .orbitpage-menu')).toHaveAttribute('data-menu-font', 'sans');
  for (const width of [1440,1024,390,320]) {
    await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Add item', exact: true }).click(); const dialog = itemDialog(page); await expect(dialog).toBeVisible();
    await expect.poll(async () => { const box = (await dialog.boundingBox())!; return Math.abs(box.x + box.width / 2 - (await page.locator('[data-state="open"].fixed.inset-0').boundingBox())!.width / 2); }).toBeLessThan(2);
    const box = (await dialog.boundingBox())!; expect(Math.abs(box.x + box.width/2 - (await page.locator('[data-state="open"].fixed.inset-0').boundingBox())!.width/2)).toBeLessThan(2); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(902);
    await dialog.getByRole('button', { name: 'Delete item', exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole('button', { name: 'Delete item', exact: true })).toBeVisible();
    const body = (await dialog.locator('.menu-editor-dialog-body').boundingBox())!, footer = (await dialog.locator('.menu-editor-dialog-footer').boundingBox())!; expect(body.y + body.height).toBeLessThanOrEqual(footer.y + 1); expect(body.x + body.width).toBeLessThanOrEqual(box.x + box.width);
    await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeVisible(); await page.screenshot({ path: testInfo.outputPath('menu-popup-' + width + '.png'), fullPage: true }); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});
