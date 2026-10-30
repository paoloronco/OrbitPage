import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData } from './helpers';

for (const hasProfile of [false, true]) {
  test(`footer follows visible cards instead of obsolete canvas height with profile=${hasProfile}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(hasProfile => {
      const layout = (mobile: boolean) => ({
        height: 6000, profileMinHeight: 160,
        positions: {
          ...(hasProfile ? { 'orbitpage-profile': { x: 0, y: 0, width: mobile ? 100 : 44, height: 160 } } : {}),
          first: { x: mobile ? 0 : 54, y: 300, width: mobile ? 100 : 44, height: 180 },
          last: { x: 0, y: mobile ? 1500 : 1200, width: mobile ? 100 : 44, height: 180 },
          hidden: { x: 0, y: 4000, width: 100, height: 180 },
        },
      });
      (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
        page: {
          profile: { name: hasProfile ? 'Canvas' : '', bio: '', avatar: '', showAvatar: false, footerText: 'Fictional footer', appearance: { cardLayouts: { desktop: layout(false), mobile: layout(true) } } },
          links: ['first', 'last', 'hidden'].map(id => ({ id, type: 'link', title: id, description: '', url: 'https://example.com', isActive: id !== 'hidden' })),
          theme: { maxWidth: '72rem' }, branding: { showOrbitPageBadge: true },
        },
        consentConfig: { mode: 'disabled', enabled: false },
      };
    }, hasProfile);
    await page.goto('/');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('[data-card-layout-item="hidden"]')).toHaveCount(0);
      await expect(page.locator('[data-card-layout-item="first"]')).toHaveAttribute('data-card-layout-position', `${width < 768 ? '0' : '54'},300,${width < 768 ? '100' : '44'},180`);
      await expect(page.locator('[data-card-layout-item="last"]')).toHaveAttribute('data-card-layout-position', `0,${width < 768 ? 1500 : 1200},${width < 768 ? 100 : 44},180`);
      await expect.poll(() => page.locator('.public-page-root').evaluate(root => {
        const lastBottom = Math.max(...Array.from(root.querySelectorAll('[data-card-layout-item]')).map(card => card.getBoundingClientRect().bottom));
        return Math.abs(root.querySelector('footer')!.getBoundingClientRect().top - lastBottom);
      })).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => window.__ORBITPAGE_STATIC_SNAPSHOT__!.page.profile.appearance!.cardLayouts!.desktop!.height)).toBe(6000);
    }
  });
}

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

for (const beforeMount of [true, false]) {
  test(`hides the inline iubenda box inserted ${beforeMount ? 'before' : 'after'} mount while retaining the floating preferences button`, async ({ page }) => {
    await page.addInitScript(beforeMount => {
      (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
        page: { profile: { name: 'Privacy footer fixture', bio: '', avatar: '', showAvatar: false, privacyPolicyUrl: '/privacy', cookiePolicyUrl: '/cookies' }, links: [], theme: {} },
        consentConfig: { mode: 'disabled', enabled: false },
      };
      const install = () => {
        const widget = document.createElement('div'); widget.className = 'iub__us-widget';
        widget.textContent = 'Inline US privacy controls';
        const button = document.createElement('button');
        button.className = 'iubenda-tp-btn iubenda-cs-preferences-link';
        button.textContent = 'Privacy choices';
        button.style.cssText = 'position:fixed;right:16px;bottom:16px;height:44px';
        button.addEventListener('click', () => button.dataset.clicks = String(Number(button.dataset.clicks || 0) + 1));
        document.body.append(widget, button);
      };
      window.addEventListener('install-fictional-iubenda', install);
      if (beforeMount) document.addEventListener('DOMContentLoaded', install);
    }, beforeMount);
    await page.goto('/');
    const root = page.locator('.public-page-root');
    await expect(root).toBeVisible();
    if (!beforeMount) await page.evaluate(() => window.dispatchEvent(new Event('install-fictional-iubenda')));
    const control = page.getByRole('button', { name: 'Privacy choices', exact: true });
    await expect(page.locator('.iub__us-widget')).toHaveCount(1);
    await expect(root.locator('footer .iub__us-widget')).toHaveCount(0);
    await expect(root.locator('footer').getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute('href', '/privacy');
    await expect(root.locator('footer').getByRole('link', { name: 'Cookie Policy', exact: true })).toHaveAttribute('href', '/cookies');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('.iub__us-widget')).toBeHidden();
      await expect(control).toBeVisible();
      await expect(control).toHaveCSS('position', 'fixed');
      await expect.poll(() => root.evaluate(root => {
        const footer = root.querySelector('footer')!.getBoundingClientRect(), button = document.querySelector('.iubenda-tp-btn')!.getBoundingClientRect();
        return Math.abs(footer.bottom + parseFloat(getComputedStyle(root).paddingBottom) - innerHeight) < 1
          && Math.abs(button.right + 16 - document.documentElement.clientWidth) < 1
          && Math.abs(button.bottom + 16 - innerHeight) < 1
          && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
    }
    await control.click(); await expect(control).toHaveAttribute('data-clicks', '1');
    await page.evaluate(() => { history.pushState({}, '', '/cookies'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await expect(root).toHaveCount(0);
    await expect(page.locator('.iub__us-widget')).toBeHidden();
    await control.click(); await expect(control).toHaveAttribute('data-clicks', '2');
  });
}
