import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData } from './helpers';

test('self-hosted snapshots load footer, default avatar and preset icons from the mount path', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page, ['/api/profile', '/api/links', '/api/subpages']);
  const basePath = (process.env.BASE_PATH || '').replace(/\/+$/, '');
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const link = { id: 'brand-fixture', type: 'link', title: 'Asset fixture', url: 'https://example.com', icon: '/block-icons/star.svg', iconType: 'svg', isActive: true };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: 'Brand fixture', avatar: '', showAvatar: true } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: [link] })).ok()).toBeTruthy();
    expect((await page.request.put('/api/subpages', { headers, data: [{ id: 'brand-page', slug: 'brand-assets', title: 'Brand assets', enabled: true, links: [link] }] })).ok()).toBeTruthy();

    for (const route of ['/', '/brand-assets']) {
      await page.goto(`${basePath}${route}`);
      await expect(page.locator('.public-page-root')).toBeVisible();
      expect(await page.evaluate(() => Boolean(window.__ORBITPAGE_STATIC_SNAPSHOT__))).toBe(true);
      const footerMark = page.locator('footer img[src$="/brand/orbitpage-mark-192.png"]');
      await expect(footerMark).toHaveAttribute('src', `${basePath}/brand/orbitpage-mark-192.png`);
      for (const asset of ['/brand/orbitpage-mark-192.png', '/block-icons/star.svg']) {
        const images = page.locator(`.public-page-root img[src="${basePath}${asset}"]`);
        expect(await images.count()).toBeGreaterThanOrEqual(asset.includes('/brand/') ? 2 : 1);
        for (const image of await images.all()) {
          await expect(image).toBeVisible();
          await expect.poll(() => image.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
        }
        const response = await page.request.get(`${basePath}${asset}`);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toMatch(/^image\//);
      }
    }
  } finally { await restore(); }
});
