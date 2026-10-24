import { expect, test, type Locator } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData, saveEditorChanges } from './helpers';

const positions = (canvas: Locator) => canvas.locator('[data-card-layout-item]').evaluateAll(items => Object.fromEntries(items.map(item => [item.getAttribute('data-card-layout-item')!, item.getAttribute('data-card-layout-position')!.split(',').map(Number)])));
const separated = (canvas: Locator) => canvas.locator('[data-card-layout-item]').evaluateAll(items => {
  const rects = items.map(item => item.getBoundingClientRect());
  return rects.every((a, i) => rects.every((b, j) => i === j || a.right <= b.left + .1 || a.left >= b.right - .1 || a.bottom <= b.top + .1 || a.top >= b.bottom - .1));
});

for (const wrapping of [false, true]) test(`Arrange ${wrapping ? 'narrows descriptions and makes room' : 'reorders occupied rows and cancels atomically'}`, async ({ page, browserName }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: 'Bearer ' + token };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const ids = ['first', 'second', 'third'];
    const layout = { positions: Object.fromEntries(ids.map((id, i) => [id, { x: 0, y: i * 124, width: 100, height: 100 }])), height: 348 };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: '', bio: '', avatar: '', showAvatar: false, socialLinks: {}, social_links: {},
      appearance: { cardLayouts: { desktop: layout, mobile: layout } } } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: ids.map(id => ({ id, type: 'link', title: id,
      description: wrapping && id === 'first' ? 'Wrapping text needs more vertical space. '.repeat(8) : '', url: 'https://example.com', isActive: true })) })).ok()).toBeTruthy();
    await page.reload();
    const canvas = page.locator('.visual-site-editor__canvas .public-card-stack--layout');
    for (const device of ['Desktop', 'Mobile']) {
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await page.getByRole('button', { name: 'Arrange', exact: true }).click();
      const handle = canvas.getByRole('button', { name: wrapping ? 'Resize card first' : 'Move card third', exact: true });
      await handle.evaluate(element => element.scrollIntoView({ block: 'center' }));
      const initial = await positions(canvas);
      const scale = await canvas.evaluate(element => element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth);
      const width = (await canvas.boundingBox())!.width;
      const start = async () => {
        const box = (await handle.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - (wrapping ? width / 2 : 0), box.y + box.height / 2 - (wrapping ? 0 : 248 * scale), { steps: 10 });
      };
      await start();
      await expect.poll(() => separated(canvas)).toBe(true);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect.poll(() => positions(canvas)).toEqual(initial);
      await start();
      await page.mouse.up();
      if (wrapping) {
        await expect.poll(async () => (await positions(canvas)).first[2]).toBeLessThan(55);
        await expect.poll(async () => (await positions(canvas)).first[3]).toBeGreaterThan(initial.first[3]);
        expect(await canvas.locator('[data-card-content-layout-item="description"]').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      } else {
        await expect.poll(async () => (await positions(canvas)).third[1]).toBe(0);
        expect((await positions(canvas)).first[1]).toBe(124);
        expect((await positions(canvas)).second[1]).toBe(248);
        for (let i = 0; i < 3; i++) await canvas.getByRole('button', { name: 'Resize card third', exact: true }).press('Shift+ArrowDown');
        expect((await positions(canvas)).first[1]).toBe(154);
        if (device === 'Mobile' && browserName === 'chromium') {
          const cdp = await page.context().newCDPSession(page);
          const box = (await handle.boundingBox())!;
          const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 170 * scale }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await expect.poll(async () => (await positions(canvas)).first[1]).toBe(0);
          await cdp.detach();
        }
      }
      await expect.poll(() => separated(canvas)).toBe(true);
      await expect(page.locator('.page-layout-overlap-warning')).toBeHidden();
      const expected = await positions(canvas);
      await saveEditorChanges(page);
      await page.reload();
      await page.getByRole('button', { name: device + ' preview', exact: true }).click();
      await expect.poll(() => positions(canvas)).toEqual(expected);
    }
    await page.goto('/');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => separated(page.locator('.public-card-stack--layout'))).toBe(true);
    }
  } finally { await page.mouse.up(); await restore(); }
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
