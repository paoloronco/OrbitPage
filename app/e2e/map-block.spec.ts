import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('uses the dedicated Maps URL without asking for a generic card destination', async ({ page }) => {
  await openAuthenticatedAdmin(page);

  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add block' }).click();
  await page.getByRole('button', { name: /^Map/ }).click();

  const mapCard = page.locator('[data-link-id]').last();
  await mapCard.hover();
  await mapCard.getByRole('button', { name: 'Edit block' }).click();

  await expect(mapCard.getByText('Map destination')).toBeVisible();
  await expect(mapCard.getByText('Description & link')).toHaveCount(0);
  await expect(mapCard.getByText('Show URL on card')).toHaveCount(0);
  await expect(mapCard.locator('[placeholder="https://example.com"]:visible')).toHaveCount(0);

  const mapsUrl = mapCard.getByLabel('Maps URL');
  await mapsUrl.fill('https://www.google.com/maps?q=Turin');
  await mapCard.getByRole('button', { name: 'Save', exact: true }).click();

  await mapCard.hover();
  await mapCard.getByRole('button', { name: 'Edit block' }).click();
  await expect(mapCard.getByLabel('Maps URL')).toHaveValue('https://www.google.com/maps?q=Turin');
});
