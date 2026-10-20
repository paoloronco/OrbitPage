import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData, saveEditorChanges } from './helpers';

test.use({ hasTouch: true });

test('profile cards fit their visible content in the editor and public page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const layout = (height: number) => ({
      positions: {
        'orbitpage-profile': { x: 0, y: 0, width: 100, height },
        'profile-following': { x: 0, y: height + 24, width: 100, height: 100 },
      },
      height: height + 124,
    });
    const draft = { ...profile, name: 'Sample profile', bio: 'A short description', avatar: '', showAvatar: false,
      appearance: { cardLayouts: { desktop: layout(208), mobile: layout(224) } } };
    expect((await page.request.put('/api/profile', { headers, data: draft })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: [{ id: 'profile-following', type: 'link', title: 'Following card', url: 'https://example.com', isActive: true }] })).ok()).toBeTruthy();

    const compactProfile = async (selector: string) => {
      await expect.poll(() => page.locator(`${selector} .profile-card`).evaluate(card => {
        const bounds = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        const scale = bounds.width / (card as HTMLElement).offsetWidth;
        const contentBottom = card.querySelector('.profile-card__bio')!.getBoundingClientRect().bottom;
        const padding = Number.parseFloat(style.paddingBottom) + Number.parseFloat(style.borderBottomWidth);
        return Math.abs((bounds.bottom - contentBottom) / scale - padding);
      })).toBeLessThanOrEqual(1);
      await expect.poll(() => page.locator(selector).evaluate(root => {
        const card = root.querySelector('.profile-card')!.getBoundingClientRect();
        const next = root.querySelector('[data-card-layout-item="profile-following"]')!.getBoundingClientRect();
        const item = root.querySelector('[data-card-layout-item="orbitpage-profile"]') as HTMLElement;
        const scale = item.getBoundingClientRect().width / item.offsetWidth;
        return Math.abs((next.top - card.bottom) / scale - 24);
      })).toBeLessThanOrEqual(1);
    };

    await page.setViewportSize({ width: 1440, height: 980 });
    await page.reload();
    const preview = '.visual-site-editor__canvas';
    for (const device of ['Desktop', 'Mobile']) {
      await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
      await compactProfile(preview);
    }
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await compactProfile('.public-page-root');
    }
    const unchanged = await (await page.request.get('/api/profile', { headers })).json();
    expect(unchanged.appearance.cardLayouts).toEqual(draft.appearance.cardLayouts);

    draft.appearance.cardLayouts = { desktop: layout(356), mobile: layout(356) };
    expect((await page.request.put('/api/profile', { headers, data: draft })).ok()).toBeTruthy();
    await page.reload();
    await expect(page.locator('.profile-card')).toHaveCSS('min-height', '356px');
    const saved = await (await page.request.get('/api/profile', { headers })).json();
    expect(saved.appearance.cardLayouts).toEqual(draft.appearance.cardLayouts);
  } finally {
    await restore();
  }
});

test('public cards wrap long text and ignore legacy text coordinates at every width', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const links = ['link', 'text', 'cta'].map((type, index) => ({
      id: `long-${index}`, type, title: `Long ${type} title ${'unbroken'.repeat(10)}`,
      description: 'A complete description with useful details. '.repeat(18),
      content: type === 'text' ? 'Information that must always remain readable. '.repeat(20) : '',
      url: `https://example.com/${'long-url-'.repeat(24)}`, isActive: true,
      alignment: ['left', 'center', 'right'][index],
    }));
    const layout = {
      positions: Object.fromEntries(links.map((link, index) => [link.id, { x: 0, y: index * 156, width: 100, height: 132 }])),
      contents: { 'long-0': { positions: { title: { x: 80, y: 800, width: 20, height: 24 } } } },
      height: 444,
    };
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: { profile: { name: '', bio: '', avatar: '', showAvatar: false, appearance: { cardLayouts: { desktop: layout, mobile: layout } } }, links, theme: {}, branding: { showOrbitPageBadge: false } },
      consentConfig: { mode: 'disabled', enabled: false },
    };
  });
  await page.goto('/');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('[data-card-layout-item]')).toHaveCount(3);
    await expect.poll(() => page.locator('[data-card-layout-item]').evaluateAll(cards => {
      const bounds = cards.map(card => card.getBoundingClientRect());
      return cards.every((card, index) => {
        const surface = card.querySelector('.glass-card, .public-cta-card')!;
        return surface.scrollWidth <= surface.clientWidth + 1
          && surface.scrollHeight <= surface.clientHeight + 1
          && (index === 0 || bounds[index].top >= bounds[index - 1].bottom);
      }) && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await expect(page.locator('.public-link-card__layout-item, [data-card-layout-mode]')).toHaveCount(0);
    await expect(page.locator('[data-card-content-layout-item="title"] h3')).toHaveCSS('text-align', 'left');
  }
  expect(errors).toEqual([]);
});

test('profile content and manual resizing reflow following cards and survive saving', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const layout = { profileMinHeight: 48, positions: {
      'orbitpage-profile': { x: 0, y: 0, width: 80, height: 208 },
      following: { x: 0, y: 232, width: 100, height: 160 },
      last: { x: 0, y: 416, width: 100, height: 160 },
    }, height: 576 };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: 'Dynamic profile', bio: 'Short bio', avatar: '', showAvatar: false, socialLinks: {}, social_links: {},
      appearance: { cardLayouts: { desktop: layout, mobile: layout } } } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: ['following', 'last'].map(id => ({ id, type: 'link', title: `Card ${id}`, url: 'https://example.com', isActive: true })) })).ok()).toBeTruthy();
    await page.reload();
    const card = page.locator('.visual-site-editor__canvas [data-card-layout-item="orbitpage-profile"]');
    const position = async () => (await card.getAttribute('data-card-layout-position'))!.split(',').map(Number);
    const height = async () => (await position())[3];
    const gaps = async () => page.locator('.visual-site-editor__canvas').evaluate(root => {
      const rect = (id: string) => root.querySelector(`[data-card-layout-item="${id}"]`)!.getAttribute('data-card-layout-position')!.split(',').map(Number);
      const [profile, following, last] = ['orbitpage-profile', 'following', 'last'].map(rect);
      return [following[1] - profile[1] - profile[3], last[1] - following[1] - following[3]];
    });
    const longBio = 'A detailed description that wraps naturally. '.repeat(45);
    for (const device of ['Desktop', 'Mobile']) {
      await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
      const initialHeight = await height();
      await page.locator('#profile-bio').fill(longBio);
      await expect.poll(height).toBeGreaterThan(initialHeight);
      const bioHeight = await height();
      await page.locator('#profile-primary-detail').fill('Independent designer');
      await page.locator('#profile-secondary-detail').fill('Turin, Italy');
      await page.getByRole('switch', { name: 'Show profile image', exact: true }).click();
      await expect.poll(height).toBeGreaterThan(bioHeight + 90);
      await expect.poll(gaps).toEqual([24, 24]);
      await page.getByRole('switch', { name: 'Show profile image', exact: true }).click();
      await page.locator('#profile-primary-detail').fill('');
      await page.locator('#profile-secondary-detail').fill('');
      await page.locator('#profile-bio').fill('Short bio');
      await expect.poll(height).toBe(initialHeight);
      await expect.poll(gaps).toEqual([24, 24]);

      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      const handle = card.getByRole('button', { name: 'Resize profile card', exact: true });
      await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const before = await position();
      const scale = await card.evaluate(element => element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth);
      const start = (await handle.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 60 * scale, { steps: 5 });
      await expect.poll(async () => Math.abs(await height() - before[3] - 60)).toBeLessThanOrEqual(1);
      await expect.poll(gaps).toEqual([24, 24]);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect.poll(position).toEqual(before);
      await expect.poll(gaps).toEqual([24, 24]);
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 60 * scale, { steps: 5 });
      await page.mouse.up();
      await expect.poll(async () => Math.abs(await height() - before[3] - 60)).toBeLessThanOrEqual(1);
      await expect.poll(gaps).toEqual([24, 24]);
      const manualHeight = await height();
      await handle.press('Shift+ArrowUp');
      await expect.poll(height).toBe(manualHeight - 10);
      await handle.press('Shift+ArrowDown');
      await expect.poll(height).toBe(manualHeight);
      await expect.poll(gaps).toEqual([24, 24]);
      await saveEditorChanges(page);
      await page.reload();
      await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
      await expect.poll(height).toBe(manualHeight);
      await page.locator('#profile-bio').fill(longBio);
      await expect.poll(height).toBeGreaterThan(manualHeight);
      await expect.poll(gaps).toEqual([24, 24]);
      await saveEditorChanges(page);
      await page.reload();
      await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
      await expect.poll(height).toBeGreaterThan(manualHeight);
      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      await handle.press('Shift+ArrowRight');
      await expect.poll(gaps).toEqual([24, 24]);
      await saveEditorChanges(page);
      await page.reload();
      await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
      await expect.poll(gaps).toEqual([24, 24]);
      await page.locator('#profile-bio').fill('Short bio');
      await expect.poll(height).toBe(manualHeight);
      await expect.poll(gaps).toEqual([24, 24]);
      await saveEditorChanges(page);
      const saved = await (await page.request.get('/api/profile', { headers })).json();
      expect(saved.appearance.cardLayouts[device.toLowerCase()].profileMinHeight).toBe(manualHeight);
    }
    await page.goto('/');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.locator('.public-page-root').evaluate(root => {
        const profile = root.querySelector('.profile-card')!.getBoundingClientRect();
        const following = root.querySelector('[data-card-layout-item="following"]')!.getBoundingClientRect();
        return Math.abs(following.top - profile.bottom - 24);
      })).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  } finally {
    await restore();
  }
});

for (const width of [1440, 390]) {
  test(`Arrange tracks the pointer, cancels and preserves other cards in the ${width === 390 ? "mobile" : "desktop"} preview`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1440, height: 980 });
    await openAuthenticatedAdmin(page);
    const restore = await preservePageData(page);
    try {
      // Seed the scrolling fixture through the API; this test measures Arrange, not six add dialogs.
      const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
      const headers = { Authorization: `Bearer ${token}` };
      const extra = Array.from({ length: 6 }, (_, index) => ({ id: `arrange-${width}-${index}`, type: 'link', title: `Arrange fixture ${index}`, url: 'https://example.invalid', isActive: true }));
      expect((await page.request.put('/api/links', { headers, data: extra })).ok()).toBeTruthy();
      await page.reload();
      await page.getByRole('button', { name: 'Content', exact: true }).click();
      const id = await page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').last().getAttribute('data-public-editor-link-id');
      if (width === 390) await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      const card = page.locator(`[data-card-layout-item="${id}"]`);
      const handle = card.getByRole('button', { name: /^Move card/ });
      await handle.evaluate(async element => { await Promise.all(element.closest('.admin-preview-device__hardware')!.getAnimations().map(animation => animation.finished)); });
      await handle.focus();
      await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const position = async () => (await card.getAttribute('data-card-layout-position'))!.split(',').map(Number);
      const before = await position();
      const others = () => page.locator(`[data-card-layout-item]:not([data-card-layout-item="${id}"])`).evaluateAll(cards => cards.map(card => card.getAttribute('data-card-layout-position')));
      const otherPositions = await others();
      const start = (await handle.boundingBox())!;
      expect(start.width).toBeGreaterThanOrEqual(43.5);
      expect(start.height).toBeGreaterThanOrEqual(43.5);
      const canvas = page.locator('.public-card-stack--layout');
      const scale = await canvas.evaluate(element => element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth);
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 - 28, { steps: 5 });
      await expect.poll(async () => (await position())[1]).toBe(Math.round(before[1] - 28 / scale));
      expect(await others()).toEqual(otherPositions);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(await position()).toEqual(before);
      if (width === 390 && browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        const touch = (await handle.boundingBox())!;
        const point = { x: touch.x + touch.width / 2, y: touch.y + touch.height / 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y - 20 }] });
        await expect.poll(async () => (await position())[1]).not.toBe(before[1]);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await expect.poll(position).toEqual(before);
        await cdp.detach();
      }
      const commitStart = (await handle.boundingBox())!;
      await page.mouse.move(commitStart.x + commitStart.width / 2, commitStart.y + commitStart.height / 2);
      await page.mouse.down();
      await page.mouse.move(commitStart.x + commitStart.width / 2, commitStart.y + commitStart.height / 2 - 20, { steps: 5 });
      const committedY = Math.round(before[1] - 20 / scale);
      await expect.poll(async () => (await position())[1]).toBe(committedY);
      await page.mouse.up();
      await expect.poll(async () => (await position())[1]).toBe(committedY);
      await handle.press('Shift+ArrowUp');
      await expect.poll(async () => (await position())[1]).toBe(committedY - 10);
      expect(await others()).toEqual(otherPositions);
      await expect(card.locator('[data-card-layout-mode]')).toHaveCount(0);
      await expect(card.locator('.page-card-layout__surface')).toHaveAttribute('inert', '');
      await saveEditorChanges(page);
      await page.reload();
      if (width === 390) await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
      await expect.poll(async () => (await position())[1]).toBe(committedY - 10);
    } finally {
      await restore();
    }
  });
}
