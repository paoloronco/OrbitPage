import { expect, test } from '@playwright/test';
import { contentSaveButton, openAdminSection, openAuthenticatedAdmin, openPreviewContentCard } from './helpers';

test('adds official service blocks and renders an allowlisted Spotify player', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();

  for (const service of ['Instagram', 'WhatsApp', 'YouTube', 'Spotify', 'Deezer', 'SoundCloud', 'Vimeo', 'TikTok', 'Giphy', 'Google Calendar', 'Calendly', 'Typeform', 'GitHub']) {
    await expect(dialog.getByRole('button', { name: new RegExp(service, 'i') })).toBeVisible();
  }

  await dialog.getByRole('button', { name: /Spotify/ }).click();
  await contentSaveButton(page).click();
  const spotifyPreview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
  const { editor: spotifyCard } = await openPreviewContentCard(page, spotifyPreview);
  await expect(spotifyCard.getByText('Spotify embed settings')).toBeVisible();
  await spotifyCard.getByRole('textbox', { name: 'Spotify URL' }).fill('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');

  await spotifyCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await contentSaveButton(page).click();

  await expect(spotifyPreview.locator('iframe')).toHaveAttribute('src', 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT');
  await expect(spotifyPreview.locator('[data-service-brand="spotify"]')).toBeVisible();

  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /WhatsApp/ }).click();
  await contentSaveButton(page).click();
  const whatsappPreview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
  const { editor: whatsappCard } = await openPreviewContentCard(page, whatsappPreview);
  await whatsappCard.getByRole('textbox', { name: /whatsapp URL/i }).fill('https://wa.me/391234567890');
  await contentSaveButton(page).click();
  await expect(whatsappPreview.locator('[data-service-brand="whatsapp"]')).toBeVisible();

  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /GitHub/ }).click();
  await contentSaveButton(page).click();
  const githubPreview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
  const { editor: githubCard } = await openPreviewContentCard(page, githubPreview);
  await githubCard.getByRole('textbox', { name: /github URL/i }).fill('https://github.com/paoloronco/OrbitPage');
  await contentSaveButton(page).click();
  await expect(githubPreview.locator('[data-service-brand="github"]')).toBeVisible();
});

test('renders YouTube with the origin-preserving policy required by the player', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();
  await dialog.getByRole('button', { name: /YouTube/ }).click();
  await contentSaveButton(page).click();

  const youtubePreview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
  const { editor: youtubeCard } = await openPreviewContentCard(page, youtubePreview);
  await youtubeCard.getByRole('textbox', { name: 'YouTube URL' }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await youtubeCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await contentSaveButton(page).click();

  const player = youtubePreview.locator('iframe');
  await expect(player).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ(?:\?|$)/);
  await expect(player).toHaveAttribute('referrerpolicy', 'origin');
  await expect(youtubePreview.locator('[data-service-brand="youtube"]')).toBeVisible();

  if (process.env.ORBITPAGE_EXTERNAL_EMBED_TESTS === '1') {
    await expect.poll(
      () => page.frames().some((frame) => frame.url().includes('youtube-nocookie.com/embed/dQw4w9WgXcQ')),
      { timeout: 15_000 },
    ).toBe(true);
    const youtubeFrame = page.frames().find((frame) => frame.url().includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
    await expect(youtubeFrame!.locator('body')).not.toContainText(/error\s*153|player configuration error/i);
  }
});

test('adds a consent-aware Typeform using the official widget', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();
  await dialog.getByRole('button', { name: /Typeform/ }).click();
  await contentSaveButton(page).click();

  const typeformPreview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last();
  const { editor: typeformCard } = await openPreviewContentCard(page, typeformPreview);
  await expect(typeformCard.getByText('Typeform embed settings')).toBeVisible();
  await typeformCard.getByRole('textbox', { name: 'Typeform URL' }).fill('https://form.typeform.com/to/moe6aa');
  await typeformCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await contentSaveButton(page).click();
  await typeformPreview.scrollIntoViewIfNeeded();

  await expect(typeformPreview.locator('iframe[data-testid="iframe"]')).toHaveAttribute('src', /https:\/\/form\.typeform\.com\/to\/moe6aa/);
  await expect(typeformPreview.locator('[data-service-brand="typeform"]')).toBeVisible();
});

test('keeps connected service blocks selectable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Content');
  await page.getByRole('button', { name: 'Add content' }).click();

  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();
  await expect(dialog.getByRole('button', { name: /Instagram/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Typeform/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /GitHub/ })).toBeVisible();
});
