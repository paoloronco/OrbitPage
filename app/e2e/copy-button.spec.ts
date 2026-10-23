import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, openAdminSection, openPreviewContentCard, preservePageData, saveEditorChanges } from './helpers';

test('opts existing cards into copying and preserves the choice through save, export and import', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page, ['/api/links']);
  const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  try {
    expect((await page.request.put('/api/links', { headers, data: [{ id: 'copy-test', title: 'Copy preference', url: 'https://example.com' }] })).ok()).toBeTruthy();
    await page.reload();
    await openAdminSection(page, 'Content');
    const preview = page.locator('.visual-site-editor__canvas [data-public-editor-link-id="copy-test"]');
    const { editor } = await openPreviewContentCard(page, preview);
    const copy = editor.getByRole('switch', { name: 'Show copy button', exact: true });
    await expect(copy).not.toBeChecked();
    await expect(preview.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(0);
    await copy.click();
    await expect(preview.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
    await editor.getByRole('switch', { name: 'Show URL on card', exact: true }).click();
    await expect(preview.locator('[data-card-content-layout-item="url"]')).toHaveCount(0);
    await expect(preview.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();
    await saveEditorChanges(page);
    await page.reload();
    await openPreviewContentCard(page, preview);
    await expect(copy).toBeChecked();

    const exported = await (await page.request.get('/api/links/export', { headers })).json();
    expect(exported[0].showCopyButton).toBe(true);
    expect((await page.request.post('/api/links/import', { headers, data: exported })).ok()).toBeTruthy();
    await page.goto('/');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.copiedUrl = value; } } }));
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-copied-url', 'https://example.com');
    await expect(page.getByRole('button', { name: 'Link copied', exact: true })).toBeVisible();

    expect((await page.request.put('/api/links', { headers, data: [{ ...exported[0], showCopyButton: false }] })).ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Open Copy preference', exact: true })).toHaveAttribute('href', 'https://example.com');
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(0);
  } finally {
    await restore();
  }
});
