import { expect, test } from '@playwright/test';
import { contentSaveButton, E2E_ADMIN_PASSWORD, openAdminSection, openAuthenticatedAdmin, openPreviewContentCard, preservePageData } from './helpers';

test('content fields and all three icon sources survive save and public rendering', async ({ page }) => {
  test.setTimeout(90_000);
  await openAuthenticatedAdmin(page);
  await page.context().route('https://cdn.jsdelivr.net/npm/emoji-datasource-google/**', route => route.fulfill({
    contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'),
  }));
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const links = ['link', 'text'].map(type => ({ id: `icon-${type}`, type, title: `Icon ${type}`, description: '', content: type === 'text' ? 'Body' : '', url: 'https://example.invalid', isActive: true }));
    expect((await page.request.put('/api/links', { headers, data: links })).ok()).toBeTruthy();
    await page.reload();
    await openAdminSection(page, 'Content');
    const preview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id="icon-link"]');
    let { editor } = await openPreviewContentCard(page, preview);
    await editor.locator('#link-card-title-font-icon-link').click();
    await expect(page.getByRole('listbox')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.getByRole('option', { name: 'Georgia', exact: true }).click();
    await editor.locator('#link-card-alignment-icon-link').click();
    await expect(page.getByRole('listbox')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.getByRole('option', { name: 'Center', exact: true }).click();
    await expect(editor.locator('.admin-content-section-title').first()).toHaveCSS('color', 'rgb(55, 106, 196)');
    await editor.getByRole('group', { name: 'Preset icons' }).getByRole('button', { name: 'Star', exact: true }).click();
    await contentSaveButton(page).click();
    await expect.poll(async () => (await (await page.request.get('/api/links')).json()).find((link: { id: string }) => link.id === 'icon-link').icon).toBe('/block-icons/star.svg');
    await expect(preview.locator('img[src$="/block-icons/star.svg"]')).toBeVisible();
    expect(await preview.locator('img[src$="/block-icons/star.svg"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await page.reload();
    await openAdminSection(page, 'Content');
    ({ editor } = await openPreviewContentCard(page, preview));
    await editor.getByRole('tab', { name: 'Emoji', exact: true }).click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(editor.getByRole('textbox', { name: 'Search emoji' })).toBeVisible();
      await editor.locator('.admin-block-icon-picker').scrollIntoViewIfNeeded();
      await expect.poll(() => editor.locator('.admin-block-icon-picker').evaluate(picker => picker.scrollWidth - picker.clientWidth), `Emoji picker fits ${width}px`).toBeLessThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await editor.getByRole('textbox', { name: 'Search emoji' }).fill('grinning');
    const emoji = editor.locator('button[data-epr-unified="1f600"]').first();
    await expect(emoji).toBeVisible();
    await emoji.click();
    await contentSaveButton(page).click();
    await expect.poll(async () => (await (await page.request.get('/api/links')).json()).find((link: { id: string }) => link.id === 'icon-link').icon).toContain('emoji-datasource-google/');
    const textPreview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id="icon-text"]');
    await textPreview.click();
    ({ editor } = await openPreviewContentCard(page, textPreview));
    await editor.getByRole('tab', { name: 'Upload custom' }).click();
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 600;
      canvas.getContext('2d')!.fillRect(0, 0, 1200, 600);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await editor.getByLabel('Upload custom icon', { exact: true }).setInputFiles({ name: 'wide-icon.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    const selected = editor.getByRole('img', { name: 'Selected icon' });
    await expect(selected).toBeVisible();
    await expect.poll(() => selected.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([256, 128]);
    await contentSaveButton(page).click();
    await expect.poll(async () => (await (await page.request.get('/api/links')).json()).find((link: { id: string }) => link.id === 'icon-text').icon).toMatch(/uploads/);
    await page.goto('/');
    const customIcon = page.locator('.glass-card').filter({ has: page.getByRole('link', { name: 'Icon text', exact: true }) }).locator('img').first();
    await expect(customIcon).toHaveCSS('object-fit', 'contain');
    await expect.poll(() => customIcon.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([256, 128]);
  } finally { await restore(); }
});
