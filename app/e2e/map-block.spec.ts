import { expect, test } from '@playwright/test';
import { contentSaveButton, openAuthenticatedAdmin, openPreviewContentCard } from './helpers';

test('uses the dedicated Maps URL without asking for a generic card destination', async ({ page }) => {
  await page.route('**/api/map-preview**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        lat: '45.0703',
        lon: '7.6869',
        displayName: 'Torino',
        source: 'geocoding',
      }),
    });
  });
  await openAuthenticatedAdmin(page);

  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('button', { name: /^Map/ }).click();
  await contentSaveButton(page).click();

  const previewCard = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').filter({ hasText: 'Map' }).last();
  const { editor: mapCard } = await openPreviewContentCard(page, previewCard);

  await expect(mapCard.getByText('Map destination')).toBeVisible();
  await expect(mapCard.getByText('Description & link')).toHaveCount(0);
  await expect(mapCard.getByText('Show URL on card')).toHaveCount(0);
  await expect(mapCard.locator('[placeholder="https://example.com"]:visible')).toHaveCount(0);

  const mapsUrl = mapCard.getByLabel('Maps URL');
  await mapsUrl.fill('https://www.google.com/maps?q=Turin');
  await contentSaveButton(page).click();

  const mapFrame = previewCard.locator('iframe[src*="openstreetmap.org/export/embed.html"]');
  await expect(mapFrame).toHaveCount(1);
  await expect(mapFrame).toHaveAttribute('title', /Map preview for/i);
  await expect(previewCard.getByText('Map preview unavailable')).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  const savedPreview = page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${await previewCard.getAttribute('data-public-editor-link-id')}"]`);
  const { editor: reopenedMapCard } = await openPreviewContentCard(page, savedPreview);
  await expect(reopenedMapCard.getByLabel('Maps URL')).toHaveValue('https://www.google.com/maps?q=Turin');
});
