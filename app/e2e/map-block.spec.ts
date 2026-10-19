import { expect, test } from '@playwright/test';
import { contentSaveButton, openAuthenticatedAdmin, openPreviewContentCard } from './helpers';

test('uses the dedicated Maps URL without asking for a generic card destination', async ({ page }) => {
  let resolutionRequests = 0;
  await page.route('**/api/map-preview**', async (route) => {
    resolutionRequests++;
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
  const googleFrame = previewCard.locator('iframe[src*="google.com/maps?"]');
  await expect(googleFrame).toHaveAttribute('src', /q=Turin&output=embed/);
  await contentSaveButton(page).click();

  await expect(googleFrame).toHaveCount(1);
  await expect(googleFrame).toHaveAttribute('title', /Map preview for/i);
  expect(resolutionRequests).toBe(0);
  await expect(previewCard.getByText('Map preview unavailable')).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  const savedPreview = page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${await previewCard.getAttribute('data-public-editor-link-id')}"]`);
  const { editor: reopenedMapCard } = await openPreviewContentCard(page, savedPreview);
  await expect(reopenedMapCard.getByLabel('Maps URL')).toHaveValue('https://www.google.com/maps?q=Turin');
  await expect(savedPreview.locator('iframe[src*="google.com/maps?"]')).toHaveCount(1);

  await reopenedMapCard.getByLabel('Maps URL').fill('https://maps.app.goo.gl/torino');
  await contentSaveButton(page).click();
  await expect(savedPreview.locator('iframe[src*="openstreetmap.org/export/embed.html"]')).toHaveCount(1);
  expect(resolutionRequests).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await expect(savedPreview.locator('iframe[src*="openstreetmap.org/export/embed.html"]')).toHaveCount(1);
  expect(resolutionRequests).toBe(1);

  await page.evaluate(() => {
    window.OrbitPageConsent!.init({ mode: 'hardcoded', enabled: true });
    window.OrbitPageConsent!.rejectAll();
  });
  await expect(savedPreview.locator('iframe')).toHaveCount(0);
  await expect(savedPreview.getByText('Map blocked until consent')).toBeVisible();
  await page.evaluate(() => window.OrbitPageConsent!.savePreferences({ preferences: true }));
  await expect(savedPreview.locator('iframe')).toHaveCount(1);
  await page.evaluate(() => window.OrbitPageConsent!.rejectAll());
  await expect(savedPreview.locator('iframe')).toHaveCount(0);
});
