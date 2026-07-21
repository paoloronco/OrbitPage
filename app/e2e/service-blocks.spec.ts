import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('adds official service blocks and renders an allowlisted Spotify player', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();

  for (const service of ['Instagram', 'WhatsApp', 'YouTube', 'Spotify', 'Deezer', 'SoundCloud', 'Vimeo', 'TikTok', 'Giphy', 'GitHub']) {
    await expect(dialog.getByRole('button', { name: new RegExp(service, 'i') })).toBeVisible();
  }

  await dialog.getByRole('button', { name: /Spotify/ }).click();
  const spotifyCard = page.locator('[data-link-id]').last();
  await spotifyCard.hover();
  await spotifyCard.getByRole('button', { name: 'Edit block' }).click();
  await expect(spotifyCard.getByText('Spotify embed settings')).toBeVisible();
  await spotifyCard.getByRole('textbox', { name: 'Spotify URL' }).fill('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');

  await spotifyCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await spotifyCard.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(spotifyCard.locator('iframe')).toHaveAttribute('src', 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT');
  await expect(spotifyCard.locator('[data-service-brand="spotify"]')).toBeVisible();

  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /WhatsApp/ }).click();
  const whatsappCard = page.locator('[data-link-id]').last();
  await whatsappCard.hover();
  await whatsappCard.getByRole('button', { name: 'Edit block' }).click();
  await whatsappCard.getByRole('textbox', { name: /whatsapp URL/i }).fill('https://wa.me/391234567890');
  await whatsappCard.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(whatsappCard.locator('[data-service-brand="whatsapp"]')).toBeVisible();
});

test('keeps connected service blocks selectable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add content' }).click();

  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();
  await expect(dialog.getByRole('button', { name: /Instagram/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /GitHub/ })).toBeVisible();
});
