import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData, saveEditorChanges } from './helpers';

test.use({ hasTouch: true });

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`public navigation cards keep stable dimensions over time with ${reducedMotion} motion`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const items = ['links', 'menu', 'shop', 'services'].map(path => ({ id: path, kind: 'page', path: '/' + path, label: path }));
      const links = ['stacked', 'grid', 'buttons', 'tabs'].map(layout => ({
        id: layout, type: 'internal_links', title: '', description: '', size: 'small', isActive: true,
        content: JSON.stringify({ items, layout, columns: 2, showIcons: false }),
      }));
      const layout = (mobile: boolean) => ({ positions: Object.fromEntries(links.map((link, index) => [link.id, {
        x: mobile ? 0 : index % 2 * 43, y: mobile ? index * 324 : Math.floor(index / 2) * 1224,
        width: mobile ? 100 : 36.11, height: mobile ? 300 : 1200,
      }])), height: mobile ? 1272 : 2424 });
      (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
        page: { profile: { name: '', bio: '', avatar: '', showAvatar: false, appearance: { cardLayouts: { desktop: layout(false), mobile: layout(true) } } }, links, theme: {}, branding: { showOrbitPageBadge: false } },
        consentConfig: { mode: 'disabled', enabled: false },
      };
    });
    for (const width of [1440, 1366, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('.public-internal-links')).toHaveCount(4);
      expect(await page.locator('.public-internal-links__items--stacked .public-internal-link').first().evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(90);
      await page.locator('.public-page-root').evaluate(async root => {
        await document.fonts.ready;
        await Promise.all(root.getAnimations({ subtree: true }).map(animation => animation.finished));
      });
      // Observe movement directly instead of letting hover wait for stable geometry.
      await page.locator('.public-internal-link').first().hover({ force: true });
      const samples = await page.locator('[data-card-layout-item]').evaluateAll(async cards => {
        const samples: number[][] = [];
        const start = performance.now();
        do {
          await new Promise(requestAnimationFrame);
          samples.push(cards.flatMap(card => {
            const bounds = card.getBoundingClientRect();
            return [bounds.width, bounds.height, bounds.top + scrollY];
          }));
        } while (performance.now() - start < 1100);
        return samples;
      });
      expect(samples.length).toBeGreaterThan(5);
      for (let coordinate = 0; coordinate < samples[0].length; coordinate++) {
        const values = samples.map(sample => sample[coordinate]);
        expect(Math.max(...values) - Math.min(...values), `Stable card geometry at ${width}px`).toBeLessThanOrEqual(.1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

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
      await page.keyboard.down('Alt');
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 28, { steps: 5 });
      await expect.poll(async () => (await position())[1]).toBe(Math.round(before[1] + 28 / scale));
      expect(await others()).toEqual(otherPositions);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await page.keyboard.up('Alt');
      await expect(canvas).toBeVisible();
      await expect(card).toBeVisible();
      expect(await position()).toEqual(before);
      if (width === 390 && browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        const touch = (await handle.boundingBox())!;
        const point = { x: touch.x + touch.width / 2, y: touch.y + touch.height / 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 20 }] });
        await expect.poll(async () => (await position())[1]).not.toBe(before[1]);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await expect.poll(position).toEqual(before);
        await cdp.detach();
      }
      const commitStart = (await handle.boundingBox())!;
      await page.keyboard.down('Alt');
      await page.mouse.move(commitStart.x + commitStart.width / 2, commitStart.y + commitStart.height / 2);
      await page.mouse.down();
      await page.mouse.move(commitStart.x + commitStart.width / 2, commitStart.y + commitStart.height / 2 + 20, { steps: 5 });
      const committedY = Math.round(before[1] + 20 / scale);
      await expect.poll(async () => (await position())[1]).toBe(committedY);
      await page.mouse.up();
      await page.keyboard.up('Alt');
      await expect.poll(async () => (await position())[1]).toBe(committedY);
      await handle.press('Shift+ArrowDown');
      await expect.poll(async () => (await position())[1]).toBe(committedY + 10);
      expect(await others()).toEqual(otherPositions);
      await expect(card.locator('[data-card-layout-mode]')).toHaveCount(0);
      await expect(card.locator('.page-card-layout__surface')).toHaveAttribute('inert', '');
      await saveEditorChanges(page);
      await page.reload();
      if (width === 390) await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
      await expect.poll(async () => (await position())[1]).toBe(committedY + 10);
    } finally {
      await restore();
    }
  });
}
