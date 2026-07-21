import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('creates and serves an independent subpage from the Pages workspace', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('tab', { name: 'Pages' }).click();

  const existingPage = page.locator('.subpage-list-item').filter({ hasText: 'Summer events' }).first();
  if (await existingPage.count() > 0) {
    await existingPage.click();
  } else {
    await page.getByRole('button', { name: 'Create page' }).first().click();
  }

  await page.getByLabel('Title').fill('Summer events');
  await page.getByLabel('Slug').fill('events');
  await page.getByLabel('Description').fill('Dates, guests and booking details.');
  await page.getByRole('button', { name: 'Save details' }).click();

  let linkCard = page.locator('.subpage-manager .admin-link-list [data-link-id]').filter({ has: page.getByRole('heading', { name: 'Book a table' }) }).first();
  if (await linkCard.count() === 0) {
    await page.getByRole('button', { name: 'Add link' }).click();
    linkCard = page.locator('.subpage-manager .admin-link-list [data-link-id]').filter({ has: page.getByRole('heading', { name: 'New link' }) }).first();
  }
  await expect(linkCard).toBeVisible();
  const linkId = await linkCard.getAttribute('data-link-id');
  expect(linkId).toBeTruthy();
  linkCard = page.locator(`.subpage-manager .admin-link-list [data-link-id="${linkId}"]`);
  await linkCard.hover();
  await linkCard.getByRole('button', { name: 'Edit block' }).click();
  await page.getByPlaceholder('Link title').fill('Book a table');
  await page.getByPlaceholder('https://example.com', { exact: true }).fill('https://example.com/book');
  await linkCard.getByRole('button', { name: 'Save' }).click();
  await page.locator('.admin-link-actions button:has-text("Save")').click();

  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Summer events' })).toBeVisible();
  await expect(page.getByText('Dates, guests and booking details.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book a table' }).first()).toHaveAttribute('href', 'https://example.com/book');
});
