import { expect, test, type Locator } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData, saveEditorChanges } from './helpers';

test('Arrange rejects overlapping moves and resizes atomically and preserves automatic profile growth', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: 'Bearer ' + token };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const layout = { profileMinHeight: 200, positions: {
      'orbitpage-profile': { x: 0, y: 0, width: 100, height: 200 },
      first: { x: 0, y: 224, width: 50, height: 160 },
      second: { x: 50, y: 224, width: 50, height: 160 },
      following: { x: 0, y: 408, width: 100, height: 160 },
    }, height: 568 };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: 'Collision fixture', bio: 'Short bio', avatar: '', showAvatar: false, socialLinks: {}, social_links: {},
      appearance: { cardLayouts: { desktop: layout, mobile: layout } } } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: ['first', 'second', 'following'].map(id => ({ id, type: 'link', title: id, url: 'https://example.com', isActive: true })) })).ok()).toBeTruthy();
    await page.reload();
    const canvas = page.locator('.visual-site-editor__canvas');
    const card = (id: string) => canvas.locator('[data-card-layout-item="' + id + '"]');
    const position = async (item: Locator) => (await item.getAttribute('data-card-layout-position'))!.split(',').map(Number);
    const positions = () => canvas.locator('[data-card-layout-item]').evaluateAll(items => items.map(item => item.getAttribute('data-card-layout-position')));
    const warning = page.locator('.page-layout-overlap-warning');
    const drag = async (handle: Locator, dx: number, dy: number) => {
      await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 });
      await page.mouse.up();
    };
    for (const device of ['Desktop', 'Mobile']) {
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      await expect(canvas.locator('[data-card-layout-item]')).toHaveCount(4);
      const initial = await positions();
      const scale = await card('first').evaluate(element => element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth);
      await drag(card('orbitpage-profile').getByRole('button', { name: 'Move profile card', exact: true }), 0, 80 * scale);
      await expect.poll(positions).toEqual(initial);
      await expect(warning).toContainText('Change not applied: space occupied');
      expect((await warning.boundingBox())!.y).toBeLessThan(80);
      await expect(warning).toBeHidden({ timeout: 6500 });
      await drag(card('orbitpage-profile').getByRole('button', { name: 'Resize profile card', exact: true }), 0, 80 * scale);
      await expect.poll(positions).toEqual(initial);
      await drag(card('first').getByRole('button', { name: 'Move card first', exact: true }), 12 * scale, -80 * scale);
      await expect.poll(positions).toEqual(initial);
      await drag(card('first').getByRole('button', { name: 'Resize card first', exact: true }), 0, 100 * scale);
      await expect.poll(positions).toEqual(initial);
      await drag(card('first').getByRole('button', { name: 'Resize card first', exact: true }), 40 * scale, 0);
      await expect.poll(positions).toEqual(initial);
      await card('first').getByRole('button', { name: 'Resize card first', exact: true }).press('ArrowRight');
      await expect.poll(positions).toEqual(initial);
      const before = await (await page.request.get('/api/profile', { headers })).json();
      expect(before.appearance.cardLayouts[device.toLowerCase()]).toEqual(layout);
      await card('first').getByRole('button', { name: 'Move card first', exact: true }).press('Shift+ArrowDown');
      const neighbor = await position(card('second'));
      await card('orbitpage-profile').getByRole('button', { name: 'Resize profile card', exact: true }).press('Shift+ArrowDown');
      await expect.poll(async () => (await position(card('orbitpage-profile')))[3]).toBe(210);
      expect(await position(card('second'))).toEqual(neighbor);
      await saveEditorChanges(page);
      await page.reload();
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await expect.poll(async () => (await position(card('orbitpage-profile')))[3]).toBe(210);
      const savedPositions = await positions();
      await page.locator('#profile-bio').fill('A detailed description that wraps naturally. '.repeat(20));
      await expect.poll(async () => (await position(card('orbitpage-profile')))[3]).toBeGreaterThan(210);
      const grown = await position(card('orbitpage-profile'));
      expect((await position(card('second')))[1] - neighbor[1]).toBe(grown[3] - 210);
      await page.locator('#profile-bio').fill('Short bio');
      await expect.poll(positions).toEqual(savedPositions);
      const saved = await (await page.request.get('/api/profile', { headers })).json();
      expect(saved.appearance.cardLayouts[device.toLowerCase()].profileMinHeight).toBe(210);
    }
    const wrappedLayout = { positions: {
      first: { x: 0, y: 0, width: 100, height: 100 },
      following: { x: 0, y: 124, width: 100, height: 100 },
    }, height: 224 };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: '', bio: '', avatar: '', showAvatar: false,
      appearance: { cardLayouts: { desktop: wrappedLayout, mobile: wrappedLayout } } } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: [
      { id: 'first', type: 'link', title: 'Wrapping card', description: 'Wrapping text needs more vertical space. '.repeat(25), url: 'https://example.com', isActive: true },
      { id: 'following', type: 'link', title: 'Following', url: 'https://example.com', isActive: true },
    ] })).ok()).toBeTruthy();
    await page.goto('/admin');
    for (const device of ['Desktop', 'Mobile']) {
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      await expect.poll(async () => (await position(card('first')))[3]).toBeGreaterThan(100);
      const initial = await positions();
      const screenWidth = await canvas.locator('.public-card-stack--layout').evaluate(element => element.getBoundingClientRect().width);
      await drag(card('first').getByRole('button', { name: 'Resize card Wrapping card', exact: true }), -screenWidth / 2, 0);
      await expect.poll(positions).toEqual(initial);
      await expect(warning).toBeVisible();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Arrange', exact: true })).toBeVisible();
    }
    await page.goto('/');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.locator('[data-card-layout-item]').evaluateAll(items => {
        const rects = items.map(item => item.getBoundingClientRect());
        return rects.every((a, i) => rects.every((b, j) => i === j || a.right <= b.left + .1 || a.left >= b.right - .1 || a.bottom <= b.top + .1 || a.top >= b.bottom - .1));
      })).toBe(true);
    }
  } finally { await restore(); }
});

test('legacy overlaps and growing profile elements stay separated at every public width', async ({ page }) => {
  await page.addInitScript(() => {
    const layout = { positions: {
      'orbitpage-profile': { x: 0, y: 0, width: 100, height: 200 },
      first: { x: 0, y: 40, width: 100, height: 100 },
      second: { x: 0, y: 80, width: 100, height: 100 },
    }, height: 200 };
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: { profile: { name: 'Legacy profile', bio: 'A long description needs room to remain readable. '.repeat(20), avatar: '', showAvatar: false,
        footerText: 'Footer follows the complete page',
        appearance: { profileDetails: { primary: 'Unbroken'.repeat(30), secondary: 'City'.repeat(15) }, layout: { positions: {
          name: { x: 0, y: 0, width: 100, height: 64 },
          work: { x: 0, y: 24, width: 48, height: 40 },
          location: { x: 52, y: 24, width: 48, height: 40 },
          bio: { x: 0, y: 24, width: 100, height: 80 },
        }, height: 104 }, cardLayouts: { desktop: layout, mobile: layout } },
      }, links: ['first', 'second'].map(id => ({ id, type: 'link', title: id, url: 'https://example.com', isActive: true })), theme: {}, branding: { showOrbitPageBadge: false } },
      consentConfig: { mode: 'disabled', enabled: false },
    };
  });
  await page.goto('/');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const selector of ['[data-card-layout-item]', '[data-profile-layout-item]']) {
      await expect.poll(() => page.locator(selector).evaluateAll(items => {
        const rects = items.map(item => item.getBoundingClientRect());
        return rects.length >= 2 && items.every(item => item.scrollWidth <= item.clientWidth + 1 && item.scrollHeight <= item.clientHeight + 1)
          && rects.every((a, i) => rects.every((b, j) =>
          i === j || a.right <= b.left + .1 || a.left >= b.right - .1 || a.bottom <= b.top + .1 || a.top >= b.bottom - .1));
      })).toBe(true);
    }
    expect(await page.locator('.public-page-footer').evaluate(footer => footer.getBoundingClientRect().top >= document.querySelector('.public-page-content')!.getBoundingClientRect().bottom)).toBe(true);
  }
});
