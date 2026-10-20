import { expect, test, type Locator } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData, saveEditorChanges } from './helpers';

test('Arrange moves around occupied space in stages and stops scrolling after a rejected move', async ({ page, browserName }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: 'Bearer ' + token };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const layout = { positions: {
      moving: { x: 0, y: 0, width: 44, height: 100 },
      obstacle: { x: 0, y: 160, width: 44, height: 100 },
      bottom: { x: 0, y: 1600, width: 100, height: 100 },
    }, height: 1700 };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: '', bio: '', avatar: '', showAvatar: false, socialLinks: {}, social_links: {},
      appearance: { cardLayouts: { desktop: layout, mobile: layout } } } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: ['moving', 'obstacle', 'bottom'].map(id => ({ id, type: 'link', title: id, url: 'https://example.com', isActive: true })) })).ok()).toBeTruthy();
    await page.reload();
    const canvas = page.locator('.visual-site-editor__canvas .public-card-stack--layout');
    const card = canvas.locator('[data-card-layout-item="moving"]');
    const handle = card.getByRole('button', { name: 'Move card moving', exact: true });
    const position = async () => (await card.getAttribute('data-card-layout-position'))!.split(',').map(Number);
    const others = () => canvas.locator('[data-card-layout-item]:not([data-card-layout-item="moving"])').evaluateAll(items => items.map(item => item.getAttribute('data-card-layout-position')));
    const scroll = page.locator('.visual-site-editor__canvas .admin-live-preview__scroll');
    const frames = (count: number) => page.evaluate(async count => {
      for (let frame = 0; frame < count; frame++) await new Promise(requestAnimationFrame);
    }, count);
    for (const device of ['Desktop', 'Mobile']) {
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
      await frames(3);
      const initial = await position();
      const neighbors = await others();
      const scale = await canvas.evaluate(element => element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth);
      const screenWidth = (await canvas.boundingBox())!.width;
      const drag = async (dx: number, dy: number) => {
        await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
        const box = (await handle.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
        await page.mouse.up();
      };
      const start = (await handle.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 100 * scale, { steps: 5 });
      await expect(page.locator('.page-layout-overlap-warning')).toBeVisible();
      expect(await scroll.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
      const edge = (await scroll.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2, edge.y + edge.height - 8);
      await frames(3);
      const rejectedScroll = await scroll.evaluate(element => element.scrollTop);
      await frames(12);
      expect(await scroll.evaluate(element => element.scrollTop)).toBeCloseTo(rejectedScroll, 1);
      await page.mouse.up();
      await expect.poll(position).toEqual(initial);
      expect(await others()).toEqual(neighbors);

      // Route around the obstacle: right, down, left, then fine-tune all four directions.
      await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const retry = (await handle.boundingBox())!;
      await page.mouse.move(retry.x + retry.width / 2, retry.y + retry.height / 2);
      await page.mouse.down();
      await page.mouse.move(retry.x + retry.width / 2 + screenWidth * .57, retry.y + retry.height / 2, { steps: 8 });
      await expect.poll(position).toEqual([56, 0, 44, initial[3]]);
      await expect(page.locator('.page-layout-overlap-warning')).toBeHidden({ timeout: 6500 });
      await expect.poll(position).toEqual([56, 0, 44, initial[3]]);
      await page.mouse.up();
      await expect.poll(position).toEqual([56, 0, 44, initial[3]]);
      await drag(0, 320 * scale);
      await expect.poll(async () => Math.abs((await position())[1] - 320)).toBeLessThanOrEqual(1);
      const routedY = (await position())[1];
      await drag(-screenWidth * .57, 0);
      await expect.poll(position).toEqual([0, routedY, 44, initial[3]]);
      for (const key of ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Shift+ArrowRight', 'Shift+ArrowUp', 'Shift+ArrowLeft', 'Shift+ArrowDown']) await handle.press(key);
      await expect.poll(position).toEqual([0, routedY, 44, initial[3]]);
      expect(await others()).toEqual(neighbors);
      if (device === 'Mobile' && browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        const box = (await handle.boundingBox())!;
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y - 100 * scale }] });
        await frames(3);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(position).toEqual([0, routedY, 44, initial[3]]);
        await cdp.detach();
        await drag(0, -20 * scale);
        await expect.poll(async () => Math.abs((await position())[1] - (routedY - 20))).toBeLessThanOrEqual(1);
      }
      const expected = await position();
      await saveEditorChanges(page);
      await page.reload();
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await expect.poll(position).toEqual(expected);
      expect(await others()).toEqual(neighbors);
    }
    await page.goto('/');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.locator('[data-card-layout-item]').evaluateAll(items => {
        const rects = items.map(item => item.getBoundingClientRect());
        return rects.every((a, i) => rects.every((b, j) => i === j || a.right <= b.left + .1 || a.left >= b.right - .1 || a.bottom <= b.top + .1 || a.top >= b.bottom - .1));
      })).toBe(true);
    }
  } finally { await page.mouse.up(); await restore(); }
});

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
      const resizedHeight = (await position(card('orbitpage-profile')))[3] + 10;
      await card('orbitpage-profile').getByRole('button', { name: 'Resize profile card', exact: true }).press('Shift+ArrowDown');
      await expect.poll(async () => (await position(card('orbitpage-profile')))[3]).toBe(resizedHeight);
      expect(await position(card('second'))).toEqual(neighbor);
      await saveEditorChanges(page);
      await page.reload();
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await expect.poll(async () => (await position(card('orbitpage-profile')))[3]).toBe(resizedHeight);
      const savedPositions = await positions();
      await page.locator('#profile-bio').fill('A detailed description that wraps naturally. '.repeat(20));
      await expect.poll(async () => (await position(card('orbitpage-profile')))[3]).toBeGreaterThan(resizedHeight);
      const grown = await position(card('orbitpage-profile'));
      expect((await position(card('second')))[1] - neighbor[1]).toBe(grown[3] - resizedHeight);
      await page.locator('#profile-bio').fill('Short bio');
      await expect.poll(positions).toEqual(savedPositions);
      const saved = await (await page.request.get('/api/profile', { headers })).json();
      expect(saved.appearance.cardLayouts[device.toLowerCase()].profileMinHeight).toBe(resizedHeight);
    }
    const wrappedLayout = { positions: {
      first: { x: 0, y: 0, width: 100, height: 100 },
      following: { x: 0, y: 124, width: 100, height: 100 },
    }, height: 224 };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: '', bio: '', avatar: '', showAvatar: false, socialLinks: {}, social_links: {},
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
          work: { x: 0, y: 24, width: 48, height: 300 },
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
    for (const selector of ['[data-card-layout-item]', '[data-profile-layout-item], [data-profile-layout-fixed]']) {
      await expect.poll(() => page.locator(selector).evaluateAll(items => {
        const rects = items.map(item => item.getBoundingClientRect());
        return rects.length >= 2 && items.every(item => item.scrollWidth <= item.clientWidth + 1 && item.scrollHeight <= item.clientHeight + 1)
          && rects.every((a, i) => rects.every((b, j) =>
          i === j || a.right <= b.left + .1 || a.left >= b.right - .1 || a.bottom <= b.top + .1 || a.top >= b.bottom - .1));
      })).toBe(true);
    }
    expect(await page.locator('.public-page-footer').evaluate(footer => footer.getBoundingClientRect().top >= document.querySelector('.public-page-content')!.getBoundingClientRect().bottom)).toBe(true);
    expect(await page.locator('.profile-card').evaluate(card => Math.abs(card.querySelector('.profile-card__layout-item--work .profile-card__detail')!.getBoundingClientRect().top - card.querySelector('.profile-card__layout-item--location .profile-card__detail')!.getBoundingClientRect().top))).toBeLessThan(.1);
    expect(await page.locator('.profile-card').evaluate(card => Math.abs(card.querySelector('.profile-card__layout-item--work .profile-card__detail svg')!.getBoundingClientRect().top - card.querySelector('.profile-card__layout-item--location .profile-card__detail svg')!.getBoundingClientRect().top))).toBeLessThan(.1);
  }
});
