import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

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

  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /GitHub/ }).click();
  const githubCard = page.locator('[data-link-id]').last();
  await githubCard.hover();
  await githubCard.getByRole('button', { name: 'Edit block' }).click();
  await githubCard.getByRole('textbox', { name: /github URL/i }).fill('https://github.com/paoloronco/OrbitPage');
  await githubCard.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(githubCard.locator('[data-service-brand="github"]')).toBeVisible();
});

test('renders YouTube with the origin-preserving policy required by the player', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();
  await dialog.getByRole('button', { name: /YouTube/ }).click();

  const youtubeCard = page.locator('[data-link-id]').last();
  await youtubeCard.hover();
  await youtubeCard.getByRole('button', { name: 'Edit block' }).click();
  await youtubeCard.getByRole('textbox', { name: 'YouTube URL' }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await youtubeCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await youtubeCard.getByRole('button', { name: 'Save', exact: true }).click();

  const player = youtubeCard.locator('iframe');
  await expect(player).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ(?:\?|$)/);
  await expect(player).toHaveAttribute('referrerpolicy', 'origin');
  await expect(youtubeCard.locator('[data-service-brand="youtube"]')).toBeVisible();

  if (process.env.ORBITPAGE_EXTERNAL_EMBED_TESTS === '1') {
    await expect.poll(
      () => page.frames().some((frame) => frame.url().includes('youtube-nocookie.com/embed/dQw4w9WgXcQ')),
      { timeout: 15_000 },
    ).toBe(true);
    const youtubeFrame = page.frames().find((frame) => frame.url().includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
    await expect(youtubeFrame!.locator('body')).not.toContainText(/error\s*153|player configuration error/i);
  }
});

test('renders every remaining official media provider through its allowlisted player', async ({ page }) => {
  test.setTimeout(90_000);
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  const providers = [
    {
      label: 'Instagram',
      source: 'https://www.instagram.com/reel/ABC_123/',
      expected: 'https://www.instagram.com/reel/ABC_123/embed/captioned/',
      brand: 'instagram',
    },
    {
      label: 'Deezer',
      source: 'https://www.deezer.com/track/3135556',
      expected: 'https://widget.deezer.com/widget/auto/track/3135556',
      brand: 'deezer',
    },
    {
      label: 'SoundCloud',
      source: 'https://soundcloud.com/forss/flickermood',
      expected: `https://w.soundcloud.com/player/?url=${encodeURIComponent('https://soundcloud.com/forss/flickermood')}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`,
      brand: 'soundcloud',
    },
    {
      label: 'Vimeo',
      source: 'https://vimeo.com/76979871',
      expected: 'https://player.vimeo.com/video/76979871?dnt=1',
      brand: 'vimeo',
    },
    {
      label: 'TikTok',
      source: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
      expected: 'https://www.tiktok.com/player/v1/6718335390845095173',
      brand: 'tiktok',
    },
    {
      label: 'Giphy',
      source: 'https://giphy.com/gifs/reaction-example-3o7aD2saalBwwftBIY',
      expected: 'https://giphy.com/embed/3o7aD2saalBwwftBIY',
      brand: 'giphy',
    },
  ] as const;

  for (const provider of providers) {
    await page.getByRole('button', { name: 'Add content' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add content' });
    await dialog.getByRole('button', { name: /Connected services/ }).click();
    await dialog.getByRole('button', { name: new RegExp(provider.label, 'i') }).click();

    const card = page.locator('[data-link-id]').last();
    await card.hover();
    await card.getByRole('button', { name: 'Edit block' }).click();
    await card.getByRole('textbox', { name: new RegExp(`${provider.label} URL`, 'i') }).fill(provider.source);
    await card.getByText('Consent category').locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: /Necessary/ }).click();
    await card.getByRole('button', { name: 'Save', exact: true }).click();

    const player = card.locator('iframe');
    await expect(player).toHaveAttribute('src', provider.expected);
    await expect(player).toHaveAttribute('referrerpolicy', 'origin');
    await expect(card.locator(`[data-service-brand="${provider.brand}"]`)).toBeVisible();
  }
});

test('adds a consent-aware Typeform using the official widget', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();
  await dialog.getByRole('button', { name: /Typeform/ }).click();

  const typeformCard = page.locator('[data-link-id]').last();
  await typeformCard.hover();
  await typeformCard.getByRole('button', { name: 'Edit block' }).click();
  await expect(typeformCard.getByText('Typeform embed settings')).toBeVisible();
  await typeformCard.getByRole('textbox', { name: 'Typeform URL' }).fill('https://form.typeform.com/to/moe6aa');
  await typeformCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await typeformCard.getByRole('button', { name: 'Save', exact: true }).click();
  await typeformCard.scrollIntoViewIfNeeded();

  await expect(typeformCard.locator('iframe[data-testid="iframe"]')).toHaveAttribute('src', /https:\/\/form\.typeform\.com\/to\/moe6aa/);
  await expect(typeformCard.locator('[data-service-brand="typeform"]')).toBeVisible();
});

test('adds Google Calendar and Calendly booking pages with live availability', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();

  await page.getByRole('button', { name: 'Add content' }).click();
  const bookingDialog = page.getByRole('dialog', { name: 'Add content' });
  await bookingDialog.getByRole('button', { name: /Connected services/ }).click();
  await bookingDialog.getByRole('button', { name: /Google Calendar/ }).click();
  const googleCalendarCard = page.locator('[data-link-id]').last();
  await googleCalendarCard.hover();
  await googleCalendarCard.getByRole('button', { name: 'Edit block' }).click();
  await googleCalendarCard.getByRole('textbox', { name: 'Google Calendar URL' }).fill('https://calendar.google.com/calendar/appointments/schedules/AcZssZ0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd');
  await googleCalendarCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await googleCalendarCard.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(googleCalendarCard.locator('iframe')).toHaveAttribute('src', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd?gv=true');
  await expect(googleCalendarCard.locator('iframe')).toHaveAttribute('referrerpolicy', 'origin');
  await expect(googleCalendarCard.locator('[data-service-brand="google_calendar"]')).toBeVisible();

  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /Calendly/ }).click();
  const calendlyCard = page.locator('[data-link-id]').last();
  await calendlyCard.hover();
  await calendlyCard.getByRole('button', { name: 'Edit block' }).click();
  await calendlyCard.getByRole('textbox', { name: 'Calendly URL' }).fill('https://calendly.com/orbitpage-demo/30min');
  await calendlyCard.getByText('Consent category').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: /Necessary/ }).click();
  await calendlyCard.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(calendlyCard.locator('iframe')).toHaveAttribute('src', 'https://calendly.com/orbitpage-demo/30min');
  await expect(calendlyCard.locator('[data-service-brand="calendly"]')).toBeVisible();
});

test('keeps connected service blocks selectable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add content' }).click();

  const dialog = page.getByRole('dialog', { name: 'Add content' });
  await dialog.getByRole('button', { name: /Connected services/ }).click();
  await expect(dialog.getByRole('button', { name: /Instagram/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Typeform/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /GitHub/ })).toBeVisible();
});
