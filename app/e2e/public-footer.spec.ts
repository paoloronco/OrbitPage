import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData } from './helpers';

for (const count of [0, 12]) {
  test(`public footer stays centered ${count ? 'after long content' : 'at the bottom of a short page'}`, async ({ page }) => {
    await page.addInitScript((count) => {
      (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
        page: {
          profile: { name: 'Footer fixture', bio: '', avatar: '', showAvatar: false, footerText: 'Fictional studio\nAll rights reserved' },
          links: Array.from({ length: count }, (_, index) => ({ id: `footer-${index}`, type: 'link', title: `Link ${index}`, description: 'A fictional public link.', url: 'https://example.com', isActive: true })),
          theme: {}, branding: { showOrbitPageBadge: true },
        },
        consentConfig: { mode: 'disabled', enabled: false },
      };
    }, count);
    await page.goto('/');
    const root = page.locator('.public-page-root');
    await expect(root.locator('footer')).toContainText('All rights reserved');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => root.evaluate(root => {
        const footer = root.querySelector('footer')!;
        const bounds = footer.getBoundingClientRect();
        const content = root.querySelector('.public-page-content')!.getBoundingClientRect();
        const pageBounds = root.getBoundingClientRect();
        return Math.abs(bounds.x + bounds.width / 2 - document.documentElement.clientWidth / 2) < 1
          && Math.abs(pageBounds.bottom - bounds.bottom - parseFloat(getComputedStyle(root).paddingBottom)) < 1
          && bounds.top >= content.bottom
          && pageBounds.bottom >= innerHeight
          && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
      if (!count) expect(await root.evaluate(root => root.getBoundingClientRect().bottom)).toBeCloseTo(900, 0);
      else expect(await root.evaluate(root => root.getBoundingClientRect().bottom)).toBeGreaterThan(900);
      await expect(root.locator('footer')).toHaveCSS('text-align', 'center');
    }
  });
}

test('short-page footer reaches the bottom of both preview devices', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: 'Footer fixture', bio: '', avatar: '', showAvatar: false, socialLinks: {}, appearance: {}, footerText: 'Fictional footer' } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: [] })).ok()).toBeTruthy();
    await page.reload();
    for (const device of ['Mobile', 'Desktop']) {
      await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
      await expect(page.locator('.admin-preview-device__viewport')).toHaveAttribute('data-preview-viewport-ready', 'true');
      await expect.poll(() => page.locator('.admin-live-preview__scroll').evaluate(scroll => {
        const root = scroll.querySelector('.public-page-root')!;
        const footer = root.querySelector('footer')!;
        return Math.abs((root as HTMLElement).offsetHeight - scroll.clientHeight) <= 1
          && Math.abs((root as HTMLElement).offsetHeight - ((footer as HTMLElement).offsetTop + (footer as HTMLElement).offsetHeight) - parseFloat(getComputedStyle(root).paddingBottom)) <= 1;
      })).toBe(true);
    }
  } finally { await restore(); }
});
