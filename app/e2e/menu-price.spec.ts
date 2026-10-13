import { expect, test, type Page } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin, preservePageData } from './helpers';

const itemDialog = (page: Page) => page.getByRole('dialog', { name: 'Edit item', exact: true });
const sectionDialog = (page: Page) => page.getByRole('dialog', { name: 'Edit section', exact: true });
const saveButton = (page: Page) => page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true });
async function saveAction(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/menu' && response.request().method() === 'PUT');
  await action();
  expect((await response).status()).toBe(200);
  await expect(page.locator('.menu-editor-dialog')).toBeHidden();
  await expect(saveButton(page)).toBeHidden();
}
const apply = (page: Page) => saveAction(page, () => page.getByRole('dialog').getByRole('button', { name: 'Apply', exact: true }).click());
let restoreMenu: () => Promise<void>;
test.beforeEach(async ({ page }) => {
  await openAuthenticatedAdmin(page);
  restoreMenu = await preservePageData(page, ['/api/menu']);
});
test.afterEach(async () => { await restoreMenu?.(); });

test('protects popup drafts, rejects empty names and preserves a failed menu save for retry', async ({ page }) => {
  await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = itemDialog(page), name = dialog.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill(''); await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await page.mouse.click(2,2); await expect(dialog).toBeVisible();
  const label = 'Retry item ' + Date.now(); await name.fill(label);
  await page.route('**/api/menu', async route => route.request().method() === 'PUT' ? route.fulfill({ status: 400, json: { error: 'Fictional menu save failure' } }) : route.fallback(), { times: 1 });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('Fictional menu save failure');
  await expect(name).toHaveValue(label);
  await apply(page);
  await page.reload(); await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Edit ' + label, exact: true }).click(); await expect(name).toHaveValue(label);
});

test('accepts localized prices without changing the field while typing', async ({ page }, testInfo) => {
  await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = itemDialog(page), label = 'Price item ' + testInfo.project.name + Date.now();
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(label);
  const price = dialog.getByRole('textbox', { name: 'Item price', exact: true });
  await price.clear(); await price.pressSequentially('37,45'); await expect(price).toHaveValue('37,45');
  await price.press('Enter'); await expect(price).toHaveValue('37.45');
  await apply(page);
  await page.reload(); await openAdminSection(page, 'Menu'); await page.getByRole('button', { name: 'Edit ' + label, exact: true }).click(); await expect(price).toHaveValue('37.45');
});

test('reorders only within sections, confirms deletions, and saves each action automatically', async ({ page }) => {
  test.setTimeout(60_000);
  const stamp = Date.now();
  const shortName = 'Short ' + stamp, longName = 'A much longer section name ' + stamp, soup = 'Soup ' + stamp, tea = 'Tea ' + stamp, salad = 'Salad ' + stamp, nested = 'Nested ' + stamp;
  await openAdminSection(page, 'Menu');
  const category = sectionDialog(page), item = itemDialog(page);
  for (const section of [shortName, longName]) {
    await page.getByRole('button', { name: 'Add section', exact: true }).click();
    await category.getByRole('textbox', { name: 'Name', exact: true }).fill(section);
    await expect(category.getByText('Edit category', { exact: true })).toHaveCount(0);
    await expect(category.getByRole('button', { name: /Move|Delete|Add item to this section/ })).toHaveCount(0);
    await apply(page);
  }
  for (const [name, section] of [[soup, shortName], [tea, longName], [salad, shortName]]) {
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await item.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
    await item.getByRole('combobox', { name: 'Category', exact: true }).selectOption({ label: section });
    await expect(item.getByRole('button', { name: /Move|Delete/ })).toHaveCount(0);
    await apply(page);
  }
  const actions = (name: string) => page.getByRole('group', { name: 'Actions for ' + name, exact: true });
  const reveal = async (name: string) => { await actions(name).locator('..').hover(); };
  await reveal(soup); await expect(actions(soup).getByRole('button', { name: 'Move up', exact: true })).toBeDisabled();
  await reveal(tea); await expect(actions(tea).getByRole('button', { name: 'Move up', exact: true })).toBeDisabled(); await expect(actions(tea).getByRole('button', { name: 'Move down', exact: true })).toBeDisabled();
  await reveal(salad); await saveAction(page, () => actions(salad).getByRole('button', { name: 'Move up', exact: true }).click());
  const short = page.locator('.orbitpage-menu__section').filter({ has: page.locator('h2').getByRole('button', { name: shortName, exact: true }) });
  await expect(short.locator('.orbitpage-menu-item h3')).toHaveText([salad, soup]);
  await reveal(shortName); await saveAction(page, () => actions(shortName).getByRole('button', { name: 'Move up', exact: true }).click());
  await reveal(soup); page.once('dialog', dialog => dialog.dismiss());
  await actions(soup).getByRole('button', { name: 'Delete item', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit ' + soup, exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await saveAction(page, () => actions(soup).getByRole('button', { name: 'Delete item', exact: true }).click());
  await expect(page.getByRole('button', { name: 'Edit ' + soup, exact: true })).toHaveCount(0);
  await saveAction(page, () => page.locator('.admin-profile-saved-notice').getByRole('button', { name: 'Revert', exact: true }).click());
  await expect(short.locator('.orbitpage-menu-item h3')).toHaveText([salad, soup]);
  await short.locator('h2').getByRole('button', { name: shortName, exact: true }).click();
  await category.getByRole('switch', { name: 'Allow collapsing this section' }).click(); await apply(page);
  await expect(short.getByRole('button', { name: 'Collapse ' + shortName, exact: true })).toHaveCount(0);
  await page.reload(); await openAdminSection(page, 'Menu'); await expect(short.locator('.orbitpage-menu-item h3')).toHaveText([salad, soup]);
  await expect(short.getByRole('button', { name: 'Collapse ' + shortName, exact: true })).toHaveCount(0);
  // The same setting survives publication and makes the public section always visible.
  const publish = page.getByRole('button', { name: 'Publish menu', exact: true });
  if (await publish.isVisible()) await saveAction(page, () => publish.click());
  await page.goto('/menu');
  const publicShort = page.locator('.orbitpage-menu__section').filter({ has: page.getByRole('heading', { name: shortName, exact: true }) });
  await expect(publicShort.locator('.orbitpage-menu-item h3')).toHaveText([salad, soup]);
  await expect(publicShort.locator('h2 button')).toHaveCount(0);
  await expect(page.locator('.menu-preview-actions')).toHaveCount(0);
  await page.goto('/admin'); await openAdminSection(page, 'Menu');
  await page.locator('.menu-preview-canvas').getByRole('button', { name: shortName, exact: true }).click();
  await category.getByRole('button', { name: 'Subcategory', exact: true }).click();
  await category.getByRole('textbox', { name: 'Name', exact: true }).fill(nested); await apply(page);
  await reveal(nested); await expect(actions(nested).getByRole('button', { name: 'Move up', exact: true })).toBeDisabled(); await expect(actions(nested).getByRole('button', { name: 'Move down', exact: true })).toBeDisabled();
  await reveal(shortName); page.once('dialog', dialog => dialog.dismiss()); await actions(shortName).getByRole('button', { name: 'Delete section', exact: true }).click();
  await expect(short).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await saveAction(page, () => actions(shortName).getByRole('button', { name: 'Delete section', exact: true }).click());
  await page.reload(); await openAdminSection(page, 'Menu');
  await expect(page.getByRole('button', { name: 'Edit ' + soup, exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Edit ' + salad, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: nested, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit ' + tea, exact: true })).toBeVisible();
});

test('opens the mobile menu by default and edits title and description with safe cancellation', async ({ page }) => {
  await openAdminSection(page, 'Menu');
  await expect(page.locator('.menu-preview-canvas [data-preview-source-width="390"]')).toHaveAttribute('data-preview-viewport-ready', 'true');
  await expect(page.getByRole('button', { name: 'Mobile preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Edit menu title', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Menu title and description', exact: true });
  const title = dialog.getByRole('textbox', { name: 'Title', exact: true }), original = await title.inputValue();
  await title.fill('Unsaved popup title'); await page.mouse.click(2,2); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.locator('.menu-preview-canvas h1')).toHaveText(original);
  await page.getByRole('button', { name: 'Edit menu description', exact: true }).click(); await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Menu description ' + Date.now()); await apply(page);
  await page.getByRole('button', { name: 'Desktop preview', exact: true }).click(); await expect(page.locator('.menu-preview-canvas [data-preview-source-width="1280"]')).toHaveAttribute('data-preview-viewport-ready', 'true');
  await page.reload(); await openAdminSection(page, 'Menu'); await expect(page.getByRole('button', { name: 'Mobile preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('keeps the preview, Personalize and dialogs usable from phones to laptops', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 980 }); await openAdminSection(page, 'Menu');
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
    await expect(dialog.getByRole('button', { name: /Move|Delete/ })).toHaveCount(0);
    const body = (await dialog.locator('.menu-editor-dialog-body').boundingBox())!, footer = (await dialog.locator('.menu-editor-dialog-footer').boundingBox())!; expect(body.y + body.height).toBeLessThanOrEqual(footer.y + 1); expect(body.x + body.width).toBeLessThanOrEqual(box.x + box.width);
    await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeVisible(); await page.screenshot({ path: testInfo.outputPath('menu-popup-' + width + '.png'), fullPage: true }); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});

test('matches Shop device geometry and keeps the surrounding canvas transparent', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await openAdminSection(page, 'Menu');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await itemDialog(page).getByRole('textbox', { name: 'Name', exact: true }).fill('Preview outline');
  await apply(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 980 });
    for (const device of ['Mobile', 'Desktop']) {
      const frames = [];
      for (const section of ['Shop', 'Menu']) {
        await openAdminSection(page, section);
        await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
        await expect(page.locator('.shop-device-viewport')).toHaveAttribute('data-preview-viewport-ready', 'true');
        frames.push(await page.locator('.shop-device-hardware').evaluate(element => {
          const rect = element.getBoundingClientRect(), css = getComputedStyle(element);
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, radius: css.borderRadius, padding: css.padding, background: css.backgroundColor };
        }));
        if (section === 'Menu') {
          await expect(page.locator('.menu-preview-canvas')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
          const item = page.locator('.orbitpage-menu-item[role=button]').first();
          await item.hover();
          await expect(item).toHaveCSS('outline-style', 'dashed');
          await expect(item).toHaveCSS('outline-offset', '-2px');
          await item.press('ArrowRight');
          await expect(item).toBeFocused();
          await expect(item).toHaveCSS('outline-offset', '-3px');
          await page.screenshot({ path: testInfo.outputPath(`menu-${device}-${width}.png`), fullPage: true });
        }
      }
      expect(frames[1]).toEqual(frames[0]);
    }
  }
});


test.describe('touch menu controls', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test('exposes actions without hover and keeps collapse arrows at the right edge', async ({ page }) => {
    await openAdminSection(page, 'Menu');
    const headings = page.locator('.orbitpage-menu__section-heading');
    for (const heading of await headings.all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading.locator('.menu-preview-actions')).toHaveCSS('opacity', '1');
      const toggle = heading.locator('.orbitpage-menu__section-toggle');
      if (!await toggle.count()) continue;
      const bounds = (await heading.boundingBox())!, arrow = (await toggle.boundingBox())!;
      expect(Math.abs(bounds.x + bounds.width - arrow.x - arrow.width)).toBeLessThan(1);
      await toggle.tap(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.tap(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    await page.locator('.menu-preview-actions button:enabled').first().focus();
    await expect(page.locator('.menu-preview-actions button:focus')).toBeVisible();
  });
});
