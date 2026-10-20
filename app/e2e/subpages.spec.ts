import { expect, test } from '@playwright/test';
import { contentSaveButton, E2E_ADMIN_PASSWORD, openAdminSection, openAuthenticatedAdmin, preservePageData } from './helpers';

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

  let linkCard = manager.locator('.admin-link-list > div').filter({ hasText: 'Book a table' }).first();
  if (await linkCard.count() === 0) {
    await manager.getByRole('button', { name: 'Add content' }).click();
    await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /^Link\b/ }).click();
    linkCard = manager.locator('.admin-link-list > div').last();
  }
  await expect(linkCard).toBeVisible();
  const editButton = linkCard.getByRole('button', { name: 'Edit block' });
  if (await editButton.count()) {
    await linkCard.hover();
    await editButton.click();
  }
  await expect(manager.locator('.admin-block-editor-shell')).toBeVisible();
  await page.getByPlaceholder('Link title').fill('Book a table');
  await page.getByPlaceholder('https://example.com', { exact: true }).fill('https://example.com/book');
  await expect(canvas.getByRole('link', { name: 'Book a table' })).toBeVisible();
  if (await contentSaveButton(page).isEnabled()) {
    await contentSaveButton(page).click();
    await expect(contentSaveButton(page)).toBeDisabled();
  }

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
  await page.goto('/en-US/events');
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole('heading', { name: 'Summer events' })).toBeVisible();
  await expect(page.getByText('Dates, guests and booking details.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book a table' }).first()).toHaveAttribute('href', 'https://example.com/book');
});

test('subpages keep normal card spacing without inheriting the home card layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page, ['/api/profile', '/api/links', '/api/subpages']);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const layout = {
      positions: {
        'orbitpage-profile': { x: 0, y: 0, width: 100, height: 400 },
        'home-link': { x: 0, y: 650, width: 100, height: 120 },
      },
      height: 770,
    };
    const link = { id: 'home-link', type: 'link', title: 'Home link', url: 'https://example.com/home', isActive: true };
    expect((await page.request.put('/api/profile', { headers, data: {
      ...profile, name: 'Home profile', bio: 'Main page description', avatar: '', showAvatar: false,
      appearance: { cardBackgroundColor: '#123456', cardLayouts: { mobile: layout, desktop: layout } },
    } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: [link] })).ok()).toBeTruthy();
    expect((await page.request.put('/api/subpages', { headers, data: [{
      id: 'spacing-page', slug: 'jawatengah', title: 'Jawa Tengah', description: 'Regional links', enabled: true,
      links: [{ ...link, id: 'subpage-link', title: 'Regional website', url: 'https://example.com/region' }],
    }] })).ok()).toBeTruthy();
    const subpage = await (await page.request.get('/api/public-page?subpage=jawatengah')).json();
    expect(subpage.profile.appearance).toEqual({ cardBackgroundColor: '#123456' });

    await page.reload();
    await openAdminSection(page, 'Pages');
    await page.locator('.subpage-page-card').filter({ hasText: 'Jawa Tengah' }).click();
    const preview = page.locator('.visual-site-editor__canvas');
    await expect(preview.getByRole('link', { name: 'Regional website' })).toBeVisible();
    await expect(preview.locator('[data-card-layout-item]')).toHaveCount(0);

    for (const width of [390, 320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/jawatengah');
      const card = page.getByRole('link', { name: 'Regional website' });
      await expect(card).toBeVisible();
      await expect(page.locator('[data-card-layout-item]')).toHaveCount(0);
      const gap = await card.evaluate(element => element.closest('.glass-card, .public-cta-card')!.getBoundingClientRect().top
        - document.querySelector('.profile-card')!.getBoundingClientRect().bottom);
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(32);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await expect(card).toHaveAttribute('href', 'https://example.com/region');

      await page.goto('/');
      await expect(page.locator('[data-card-layout-item="home-link"]')).toHaveAttribute('data-card-layout-position', '0,650,100,120');
    }
    const savedProfile = await (await page.request.get('/api/profile', { headers })).json();
    expect(savedProfile.appearance.cardLayouts).toEqual({ mobile: layout, desktop: layout });
  } finally {
    await restore();
  }
});
