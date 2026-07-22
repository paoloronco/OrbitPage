import { expect, test } from '@playwright/test';

const delayedSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#2563eb"/></svg>';

test('reveals a static public page only after critical images are ready', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: {
        profile: {
          name: 'Ready page',
          bio: 'No placeholder flash',
          avatar: 'http://localhost:3123/e2e-avatar.svg',
          showAvatar: true,
        },
        links: [{
          id: 'link-one',
          title: 'Contact',
          description: '',
          url: 'https://example.com',
          icon: 'http://localhost:3123/e2e-icon.svg',
          iconType: 'image',
          isActive: true,
        }],
        theme: {},
        branding: { showOrbitPageBadge: false },
      },
      consentConfig: { mode: 'disabled', enabled: false },
    };
  });

  await page.route(/\/e2e-(?:avatar|icon)\.svg$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    await route.fulfill({ body: delayedSvg, contentType: 'image/svg+xml', status: 200 });
  });

  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('body')).toHaveClass(/orbitpage-booting/);
  await expect(page.locator('.profile-card__avatar-fallback')).toBeHidden();
  await expect(page.locator('.public-link-icon-fallback')).toBeHidden();

  await page.waitForSelector('.profile-card', { state: 'attached' });
  await page.waitForLoadState('load');
  await expect(page.locator('body')).not.toHaveClass(/orbitpage-booting/);
  await expect(page.locator('.profile-card__avatar img')).toBeVisible();
  await expect(page.locator('.public-link-icon-image')).toBeVisible();
  await expect(page.locator('.profile-card__avatar-fallback')).toBeHidden();
  await expect(page.locator('.public-link-icon-fallback')).toBeHidden();
});
