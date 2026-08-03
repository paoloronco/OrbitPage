import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

const primaryNavigation = [
  'Page',
  'Content',
  'AI Agent',
  'Theme',
  'Publish',
  'Backup',
  'Analytics',
  'Privacy',
];

const secondaryNavigation = ['Newsletter', 'Team', 'Account', 'Plan'];

const navigationIcons = {
  Page: 'user-round',
  Content: 'files',
  'AI Agent': 'sparkles',
  Theme: 'palette',
  Publish: 'share-2',
  Backup: 'database',
  Analytics: 'bar-chart-3',
  Privacy: 'cookie',
  Newsletter: 'mail',
  Team: 'users-round',
  Account: 'circle-user-round',
  Plan: 'credit-card',
} as const;

test('matches the SaaS dashboard shell and keeps hosted-only surfaces explicit', async ({ page }) => {
  await openAuthenticatedAdmin(page);

  const primaryLabels = await page.locator('.admin-dashboard-nav-page button').allTextContents();
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
  await expect(page.locator('.orbitpage-dashboard-brand img')).toHaveCSS('width', '36px');
  await expect(page.locator('.orbitpage-dashboard-brand img')).toHaveCSS('height', '36px');

  const language = page.locator('.admin-dashboard-language');
  await expect(language).toHaveCSS('height', '34px');
  await expect(page.getByLabel('Language')).toHaveCSS('font-weight', '800');

  const backToSite = page.getByRole('link', { name: 'Back to site' });
  await expect(backToSite).toHaveCSS('height', '38px');
  await expect(backToSite).toHaveCSS('font-weight', '800');
  await expect(backToSite).not.toHaveAttribute('target', '_blank');

  const publicPage = page.getByRole('link', { name: 'Public page' });
  await expect(publicPage).toHaveCSS('min-height', '40px');
  await expect(publicPage).toHaveCSS('font-size', '16px');
  await expect(publicPage.locator('button')).toHaveCount(0);

  await page.getByRole('button', { name: 'Content', exact: true }).click();
  const lockedShop = page.locator('.content-workspace-option-locked');
  await expect(lockedShop).toContainText('Shop');
  await expect(lockedShop).toBeDisabled();

  const mobilePreview = page.locator('.admin-preview-device--mobile');
  await expect(mobilePreview).toHaveCSS('min-height', '600px');
  await expect(mobilePreview.locator('.admin-preview-device__hardware')).toHaveCSS('height', '568px');

  await page.getByRole('button', { name: 'Desktop preview' }).click();
  const desktopPreview = page.locator('.admin-preview-device--desktop');
  await expect(desktopPreview).toHaveCSS('min-height', '420px');
  await expect(desktopPreview.locator('.admin-preview-device__hardware')).toHaveCSS('max-width', '640px');

  const launcher = page.getByRole('button', { name: 'Edit with AI' });
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(page.getByRole('dialog', { name: 'OrbitPage AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Close AI assistant' }).click();

  await page.getByRole('button', { name: 'AI Agent', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit by asking' })).toBeVisible();
  await expect(launcher).toBeVisible();
});

test('keeps the parity navigation and AI launcher usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit with AI' })).toBeVisible();

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: 'AI Agent', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toBeVisible();
  await expect(page.locator('.admin-dashboard-language')).toHaveCSS('width', '44px');
  await expect(page.getByRole('link', { name: 'Back to site' })).toHaveCSS('width', '44px');

  await page.getByRole('button', { name: 'Close navigation' }).first().click();
  await page.getByRole('button', { name: 'Edit with AI' }).click();
  const dialog = page.getByRole('dialog', { name: 'OrbitPage AI' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.ai-page-agent')).toHaveCSS('position', 'fixed');
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
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
