import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

test('edits and previews the selected additional page, then publishes its content', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Pages');

  const manager = page.locator('.subpage-manager');
  const canvas = page.locator('.visual-site-editor__canvas');
  const existingPage = manager.locator('.subpage-page-card').filter({ hasText: 'Summer events' }).first();
  if (await existingPage.count()) {
    await existingPage.click();
  } else {
    if (await manager.locator('button.subpage-page-card').count() === 0) {
      await expect(canvas).toHaveCount(0);
    }
    await manager.getByRole('button', { name: 'Add page', exact: true }).click();
  }

  await expect(canvas).toBeVisible();
  await manager.getByLabel('Page title').fill('Summer events');
  await manager.getByLabel('URL slug').fill('events');
  await manager.locator('#subpage-description').fill('Dates, guests and booking details.');
  await expect(canvas.getByText('Summer events', { exact: true })).toBeVisible();
  await expect(canvas.getByText('Dates, guests and booking details.')).toBeVisible();
  const saveSettings = manager.getByRole('button', { name: 'Save settings' });
  if (await saveSettings.isEnabled()) await saveSettings.click();

  let linkCard = manager.locator('.admin-link-list [data-link-id]').filter({ has: page.getByRole('heading', { name: 'Book a table' }) }).first();
  if (await linkCard.count() === 0) {
    await manager.getByRole('button', { name: 'Add content' }).click();
    await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /^Link\b/ }).click();
    linkCard = manager.locator('.admin-link-list [data-link-id]').filter({ has: page.getByRole('heading', { name: 'New link' }) }).first();
  }
  await expect(linkCard).toBeVisible();
  const linkId = await linkCard.getAttribute('data-link-id');
  expect(linkId).toBeTruthy();
  linkCard = manager.locator(`.admin-link-list [data-link-id="${linkId}"]`);
  await linkCard.hover();
  await linkCard.getByRole('button', { name: 'Edit block' }).click();
  await page.getByPlaceholder('Link title').fill('Book a table');
  await page.getByPlaceholder('https://example.com', { exact: true }).fill('https://example.com/book');
  await linkCard.getByRole('button', { name: 'Save' }).click();
  await expect(canvas.getByRole('link', { name: 'Book a table' })).toBeVisible();
  await manager.locator('.admin-link-actions').getByRole('button', { name: 'Save' }).click();

  const visibility = manager.locator('.subpage-publish-toggle');
  if (await visibility.getAttribute('aria-pressed') === 'false') {
    await visibility.click();
    await saveSettings.click();
  }
  await manager.getByRole('button', { name: 'Add page', exact: true }).click();
  await expect(canvas.getByRole('heading', { name: 'Untitled page' })).toBeVisible();
  await manager.locator('button.subpage-page-card').filter({ hasText: 'Summer events' }).click();
  await expect(canvas.getByRole('heading', { name: 'Summer events' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Summer events' })).toBeVisible();
  await expect(page.getByText('Dates, guests and booking details.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book a table' }).first()).toHaveAttribute('href', 'https://example.com/book');
});
