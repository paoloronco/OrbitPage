import { expect, test } from '@playwright/test';

test('creates and serves an independent subpage from the Pages workspace', async ({ page }) => {
  await page.goto('/admin');

  const password = 'PagesTest123!';
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Complete Setup' }).click();

  await expect(page.locator('h1.admin-title, .admin-title')).toHaveText('OrbitPage Admin');
  await page.getByRole('tab', { name: 'Pages' }).click();
  await page.locator('.admin-empty-state').getByRole('button', { name: 'Create page' }).click();

  await page.getByLabel('Title').fill('Summer events');
  await page.getByLabel('Slug').fill('events');
  await page.getByLabel('Description').fill('Dates, guests and booking details.');
  await page.getByRole('button', { name: 'Save details' }).click();

  await page.getByRole('button', { name: 'Add link' }).click();
  const linkCard = page.locator('.admin-link-list [data-link-id]').first();
  await linkCard.hover();
  await linkCard.getByRole('button', { name: 'Edit block' }).click();
  await page.getByPlaceholder('Link title').fill('Book a table');
  await page.getByPlaceholder('https://example.com', { exact: true }).fill('https://example.com/book');
  await linkCard.getByRole('button', { name: 'Save' }).click();
  await page.locator('.admin-link-actions button:has-text("Save")').click();

  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Summer events' })).toBeVisible();
  await expect(page.getByText('Dates, guests and booking details.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book a table' })).toHaveAttribute('href', 'https://example.com/book');
});
