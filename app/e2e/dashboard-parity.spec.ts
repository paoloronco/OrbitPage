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

test('matches the SaaS dashboard shell and keeps hosted-only surfaces explicit', async ({ page }) => {
  await openAuthenticatedAdmin(page);

  const primaryLabels = await page.locator('.admin-dashboard-nav-page button').allTextContents();
  const secondaryLabels = await page.locator('.admin-dashboard-nav-workspace button').allTextContents();

  expect(primaryLabels.map((label) => label.trim())).toEqual(primaryNavigation);
  expect(secondaryLabels.map((label) => label.trim())).toEqual(secondaryNavigation);

  await page.getByRole('button', { name: 'Content', exact: true }).click();
  const lockedShop = page.locator('.content-workspace-option-locked');
  await expect(lockedShop).toContainText('Shop');
  await expect(lockedShop).toBeDisabled();

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
