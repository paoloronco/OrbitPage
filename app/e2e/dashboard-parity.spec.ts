import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

const primaryNavigation = [
  'Page',
  'Content',
  'AI Assistant',
  'Theme',
  'Publish',
  'Backup',
  'Analytics',
  'Privacy',
];

const secondaryNavigation = ['Newsletter', 'Team', 'Account', 'Plan'];

const navigationIcons = {
  Page: 'person-outline',
  Content: 'folder-copy-outlined',
  'AI Assistant': 'auto-awesome-outlined',
  Theme: 'palette-outlined',
  Publish: 'share-outlined',
  Backup: 'storage-outlined',
  Analytics: 'bar-chart-outlined',
  Privacy: 'cookie-outlined',
  Newsletter: 'mail-outline',
  Team: 'group-outlined',
  Account: 'account-circle-outlined',
  Plan: 'credit-card-outlined',
} as const;

test('matches the SaaS dashboard shell and keeps hosted-only surfaces explicit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openAuthenticatedAdmin(page);

  const primaryLabels = await page.locator('.admin-dashboard-nav-page [data-onboarding$="-tab"]').allTextContents();
  const secondaryLabels = await page.locator('.admin-dashboard-nav-workspace button').allTextContents();

  expect(primaryLabels.map((label) => label.trim())).toEqual(primaryNavigation);
  expect(secondaryLabels.map((label) => label.trim())).toEqual(secondaryNavigation);

  for (const [label, icon] of Object.entries(navigationIcons)) {
    const navButton = page.getByRole('button', { name: label, exact: true });
    const navIcon = navButton.locator(`[data-dashboard-icon="${icon}"]`);
    await expect(navIcon).toBeVisible();
    const expectedColor = label === 'Page'
      ? 'rgb(131, 165, 255)'
      : await navButton.evaluate((element) => getComputedStyle(element).color);
    await expect(navIcon).toHaveCSS('color', expectedColor);
  }

  const shell = page.locator('.admin-dashboard-shell');
  await expect(shell).toHaveCSS('font-family', /Aptos|Avenir Next|Segoe UI Variable/);
  await expect(page.locator('.orbitpage-dashboard-brand img')).toHaveCSS('width', '30px');
  await expect(page.locator('.orbitpage-dashboard-brand img')).toHaveCSS('height', '30px');
  await expect(page.locator('.admin-dashboard-header')).toHaveCSS('min-height', '92px');

  const language = page.locator('.admin-dashboard-language');
  await expect(language).toHaveCSS('height', '30px');
  await expect(page.getByLabel('Language')).toHaveCSS('font-weight', '800');

  const backToSite = page.getByRole('link', { name: 'Back to site' });
  await expect(backToSite).toHaveCSS('height', '32px');
  await expect(backToSite).toHaveCSS('font-weight', '800');
  await expect(backToSite).not.toHaveAttribute('target', '_blank');

  const publicPage = page.getByRole('link', { name: 'Public page' });
  await expect(publicPage).toHaveCSS('min-height', '40px');
  await expect(publicPage).toHaveCSS('font-size', '13px');
  await expect(publicPage.locator('button')).toHaveCount(0);

  await page.getByRole('button', { name: 'Content', exact: true }).click();
  const lockedShop = page.locator('.content-workspace-option-locked');
  await expect(lockedShop).toContainText('Shop');
  await expect(lockedShop.locator('.content-workspace-option-main')).toBeDisabled();

  const mobilePreview = page.locator('.admin-preview-device--mobile');
  const mobileHardware = mobilePreview.locator('.admin-preview-device__hardware');
  const mobileHardwareBounds = await mobileHardware.boundingBox();
  expect(mobileHardwareBounds).not.toBeNull();
  expect(mobileHardwareBounds!.width).toBeGreaterThanOrEqual(220);
  expect(mobileHardwareBounds!.width).toBeLessThanOrEqual(240);
  await expect(mobileHardware).toHaveCSS('aspect-ratio', '6 / 13');

  const addLink = page.getByRole('button', { name: 'Add link', exact: true });
  if (await addLink.isVisible()) await addLink.click();
  const contentList = page.locator('.admin-link-list');
  await expect(contentList).toBeVisible();
  await expect(contentList).toHaveCSS('width', '416px');
  await expect(contentList.locator('.public-block-preview h3')).toHaveCSS('font-size', '13px');

  await page.getByRole('button', { name: 'Desktop preview' }).click();
  const desktopPreview = page.locator('.admin-preview-device--desktop');
  await expect(desktopPreview).toHaveCSS('min-height', '430px');
  await expect(desktopPreview.locator('.admin-preview-device__hardware')).toHaveCSS('max-width', '450px');

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  const launcher = page.getByRole('button', { name: 'Edit with AI' });
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(page.getByRole('dialog', { name: 'OrbitPage AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Close AI assistant' }).click();

  await page.getByRole('button', { name: 'AI Assistant', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Usage and working session' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit by asking' })).toBeVisible();
  await expect(page.getByText('Unmetered', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OpenAI API' })).toBeVisible();
  await expect(launcher).toBeVisible();
});

test('keeps the parity navigation and AI launcher usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  const launcher = page.getByRole('button', { name: 'Edit with AI' });
  await expect(launcher).toBeVisible();
  await expect(page.locator('.ai-page-agent')).toHaveCSS('position', 'relative');
  const roleOptions = page.locator('.admin-profile-role-option');
  await expect(roleOptions).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const roleBounds = await roleOptions.nth(index).boundingBox();
    expect(roleBounds).not.toBeNull();
    expect(roleBounds!.height).toBeLessThanOrEqual(72);
  }

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: 'AI Assistant', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toBeVisible();
  await expect(page.locator('.admin-dashboard-language')).toHaveCSS('width', '44px');
  await expect(page.getByRole('link', { name: 'Back to site' })).toHaveCSS('width', '44px');

  await page.getByRole('button', { name: 'Close navigation' }).first().click();
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'OrbitPage AI' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('position', 'fixed');
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});

test('keeps the menu workflow clear on mobile without truncated guidance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.locator('.content-workspace-option-main').filter({ hasText: /^Menu/ }).click();

  const workflow = page.getByRole('navigation', { name: 'Menu setup workflow' });
  const steps = workflow.getByRole('button');
  const descriptions = workflow.locator('.menu-editor-tab-copy small');
  await expect(steps).toHaveCount(4);
  await expect(descriptions).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(steps.nth(index)).toHaveCSS('min-height', '60px');
    await expect(descriptions.nth(index)).toHaveCSS('display', 'none');
  }

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('keeps the real theme preview available without crowding tablet and mobile layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Theme', exact: true }).click();

  const disclosure = page.locator('.admin-theme-preview-disclosure');
  const summary = disclosure.locator('.admin-theme-preview-summary');
  const previewBody = disclosure.locator('.admin-theme-preview-body');
  const mobileHardware = disclosure.locator('.admin-preview-device--mobile .admin-preview-device__hardware');

  await expect(summary).toBeVisible();
  await expect(summary).toHaveCSS('min-height', '52px');
  await expect(previewBody).toBeHidden();
  await summary.click();
  await expect(previewBody).toBeVisible();
  let mobileHardwareBounds = await mobileHardware.boundingBox();
  expect(mobileHardwareBounds).not.toBeNull();
  expect(mobileHardwareBounds!.width).toBeGreaterThanOrEqual(200);
  expect(mobileHardwareBounds!.width).toBeLessThanOrEqual(230);
  await expect(mobileHardware).toHaveCSS('aspect-ratio', '6 / 13');

  let horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await summary.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(previewBody).toBeHidden();
  await summary.click();
  await expect(previewBody).toBeVisible();
  mobileHardwareBounds = await mobileHardware.boundingBox();
  expect(mobileHardwareBounds).not.toBeNull();
  expect(mobileHardwareBounds!.width).toBeGreaterThanOrEqual(190);
  expect(mobileHardwareBounds!.width).toBeLessThanOrEqual(210);
  await expect(mobileHardware).toHaveCSS('aspect-ratio', '6 / 13');

  const previewBounds = await disclosure.boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(previewBounds!.width).toBeLessThanOrEqual(390);
  horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  const themeRail = page.locator('.admin-theme-preset-rail');
  const railDimensions = await themeRail.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(railDimensions.scrollWidth).toBeGreaterThan(railDimensions.clientWidth);
  const firstTheme = page.locator('.admin-theme-preset-card').nth(0);
  const secondTheme = page.locator('.admin-theme-preset-card').nth(1);
  const firstThemeBounds = await firstTheme.boundingBox();
  const secondThemeBounds = await secondTheme.boundingBox();
  expect(firstThemeBounds).not.toBeNull();
  expect(secondThemeBounds).not.toBeNull();
  expect(Math.abs(firstThemeBounds!.y - secondThemeBounds!.y)).toBeLessThanOrEqual(1);
  expect(secondThemeBounds!.x).toBeGreaterThan(firstThemeBounds!.x);
  await summary.click();
  await expect(previewBody).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open controls' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#admin-theme-manual-controls')).toHaveCount(0);
  const compactThemeHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(compactThemeHeight).toBeLessThan(1600);
});

test('keeps the content preview readable on a 720p laptop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  const preview = page.locator('.admin-preview-panel');
  const hardware = preview.locator('.admin-preview-device__hardware');
  const hardwareBounds = await hardware.boundingBox();
  expect(hardwareBounds).not.toBeNull();
  expect(hardwareBounds!.width).toBeGreaterThanOrEqual(215);
  expect(hardwareBounds!.width).toBeLessThanOrEqual(225);
  await expect(hardware).toHaveCSS('aspect-ratio', '6 / 13');

  const previewBounds = await preview.boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(previewBounds!.x).toBeGreaterThanOrEqual(0);
  expect(previewBounds!.x + previewBounds!.width).toBeLessThanOrEqual(1280);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('keeps the dense editors compact and organized by task', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openAuthenticatedAdmin(page);

  await expect(page.getByRole('heading', { name: 'Page type', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();
  await expect(page.getByText('Advanced card style', { exact: true })).toBeVisible();
  await expect(page.locator('.admin-profile-save-layer')).toHaveCount(0);
  const avatarSizeSlider = page.getByLabel('Profile image size');
  const avatarSizeBounds = await avatarSizeSlider.boundingBox();
  expect(avatarSizeBounds).not.toBeNull();
  expect(avatarSizeBounds!.width).toBeLessThanOrEqual(176);
  await expect(page.getByLabel('Role or focus')).toHaveCSS('padding-left', '36px');
  await expect(page.getByLabel('Location')).toHaveCSS('padding-left', '36px');

  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  const compactThemePreview = page.locator('.admin-theme-mockup--compact').first();
  await expect(compactThemePreview).toHaveCSS('height', '112px');
  await expect(page.locator('.admin-theme-preview-disclosure')).toHaveAttribute('open', '');
  await expect(page.locator('.admin-theme-live-preview')).toBeVisible();
  const themeHardware = page.locator('.admin-theme-live-preview .admin-preview-device__hardware');
  const themeHardwareBounds = await themeHardware.boundingBox();
  expect(themeHardwareBounds).not.toBeNull();
  expect(themeHardwareBounds!.width).toBeGreaterThanOrEqual(200);
  expect(themeHardwareBounds!.width).toBeLessThanOrEqual(230);
  await expect(themeHardware).toHaveCSS('aspect-ratio', '6 / 13');

  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.locator('.content-workspace-option-main').filter({ hasText: /^Menu/ }).click();
  const workflow = page.getByRole('navigation', { name: 'Menu setup workflow' });
  await expect(workflow.getByRole('button')).toHaveCount(4);
  await expect(workflow.getByText('Identity', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Categories', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Items', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Publish', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Menu content view' })).toHaveCount(0);
  await workflow.getByRole('button', { name: /Identity/ }).click();
  const localeSelect = page.getByLabel('Locale', { exact: true });
  await expect(localeSelect).toHaveJSProperty('tagName', 'SELECT');
  await expect(localeSelect.locator('option')).toHaveCount(19);
  await localeSelect.selectOption('it-IT');
  await expect(localeSelect).toHaveValue('it-IT');

  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.locator('#current-password')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.locator('#new-password')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#confirm-password')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#two-factor-password')).toHaveAttribute('autocomplete', 'current-password');
  const passwordForms = await page.locator('.oss-account-layout input[type="password"]').evaluateAll((inputs) => inputs.map((input) => Boolean((input as HTMLInputElement).form)));
  expect(passwordForms.every(Boolean)).toBe(true);
});

test('keeps product labels shared with SaaS while localizing section descriptions', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('orbitpage.locale', 'it'));
  await openAuthenticatedAdmin(page);

  await expect(page.getByRole('button', { name: 'Page', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Content', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Theme', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page', exact: true })).toBeVisible();
  await expect(page.getByText("Definisci l'identità che le persone vedono per prima.", { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByText("Assegna a ogni collaboratore solo l'accesso necessario.", { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByText('Gestisci identità, sicurezza e workspace attivo.', { exact: true })).toBeVisible();
});
