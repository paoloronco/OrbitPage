import { test, expect } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('builds an icon-only quick link dock and keeps it first on the public page', async ({ page }) => {
  await openAuthenticatedAdmin(page);

  await page.getByRole('button', { name: 'Content', exact: true }).click();
  let dockCard = page.locator('[data-link-id]').filter({ has: page.locator('.public-compact-links') });
  if (await dockCard.count() === 0) {
    await page.getByRole('button', { name: 'Add block' }).click();
    await page.getByRole('button', { name: /Compact links/ }).click();
    dockCard = page.locator('[data-link-id]').filter({ has: page.locator('.public-compact-links') });
  }
  await expect(dockCard).toHaveCount(1);
  const dockId = await dockCard.getAttribute('data-link-id');
  expect(dockId).toBeTruthy();
  dockCard = page.locator(`[data-link-id="${dockId}"]`);
  await expect(page.locator('[data-link-id]').first()).toHaveAttribute('data-link-id', dockId || '');

  await dockCard.hover();
  await dockCard.getByRole('button', { name: 'Edit block' }).click();
  await expect(dockCard.getByText('Quick link dock')).toBeVisible();

  const existingItems = dockCard.locator('.admin-compact-link-item');
  while (await existingItems.count()) {
    await existingItems.first().getByRole('button', { name: 'Remove link' }).click();
  }

  await dockCard.getByRole('button', { name: 'Add Instagram' }).click();
  await dockCard.getByRole('button', { name: 'Custom URL' }).click();

  const items = dockCard.locator('.admin-compact-link-item');
  await expect(items).toHaveCount(2);
  const instagramUrl = items.nth(0).getByLabel('Destination URL');
  await instagramUrl.click();
  await instagramUrl.pressSequentially('https://instagram.com/orbitpage');
  await expect(instagramUrl).toHaveValue('https://instagram.com/orbitpage');
  await expect(instagramUrl).toBeFocused();
  await items.nth(1).getByLabel('Destination URL').fill('https://orbitpage.com');
  await items.nth(1).getByRole('button', { name: 'Move left' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dockCard.getByText('Quick link dock')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await dockCard.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('.admin-link-actions').getByRole('button', { name: 'Save', exact: true }).click();

  await page.goto('/');
  const dock = page.locator('.public-compact-links');
  await expect(dock).toBeVisible();
  await expect(dock).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(dock).toHaveCSS('border-top-width', '0px');
  await expect(dock.locator('.public-compact-links__items')).toHaveCSS('justify-content', 'center');
  await expect(dock.locator('a').first()).toHaveAttribute('href', 'https://orbitpage.com/');
  await expect(dock.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://instagram.com/orbitpage');
  await expect(dock.locator('.public-compact-link__label')).toHaveCount(0);
  await expect(dock.locator('.public-compact-link__icon').first()).toHaveCSS('border-top-width', '0px');
});
