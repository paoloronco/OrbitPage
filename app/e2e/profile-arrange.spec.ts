import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData, saveEditorChanges } from './helpers';

test('Arrange places profile elements on a grid, locks the bio and saves independent layouts without overlaps', async ({ page }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    const layout = { positions: {
      avatar: { x: 0, y: 0, width: 32, height: 112 }, name: { x: 40, y: 0, width: 60, height: 64 },
      work: { x: 0, y: 144, width: 45, height: 40 }, location: { x: 55, y: 144, width: 45, height: 40 },
      socials: { x: 0, y: 208, width: 100, height: 48 }, bio: { x: 0, y: 0, width: 12, height: 36 },
    }, height: 256 };
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, name: 'Alex', bio: 'This description always follows the arranged profile elements.', avatar: '/brand/orbitpage-mark-192.png', showAvatar: true,
      social_links: { github: 'fictional-profile' }, appearance: { profileDetails: { primary: 'Software designer', secondary: 'Turin (Italy)' }, layouts: { desktop: layout, mobile: layout } },
    } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: [{ id: 'following', type: 'link', title: 'Following card', url: 'https://example.invalid', isActive: true }] })).ok()).toBeTruthy();
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Arrange', exact: true }).click();
    const card = page.locator('.visual-site-editor__canvas .profile-card');
    const position = async (item: string) => (await card.locator(`[data-profile-layout-item="${item}"]`).getAttribute('data-profile-layout-position'))!.split(',').map(Number);
    for (const label of ['Profile image', 'Name', 'Work', 'Location', 'Social links']) await expect(card.getByRole('button', { name: `Move ${label}`, exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: /^(Move|Resize|Align).*Description/ })).toHaveCount(0);
    await expect(card.locator('[data-profile-layout-item="bio"]')).toHaveCount(0);
    await expect(card.locator('[data-profile-layout-fixed="bio"]')).toBeVisible();
    expect(await card.evaluate(card => Math.abs(card.querySelector('.profile-card__layout-item--work .profile-card__detail')!.getBoundingClientRect().top - card.querySelector('.profile-card__layout-item--location .profile-card__detail')!.getBoundingClientRect().top))).toBeLessThan(.1);

    await card.getByRole('button', { name: 'Reset profile arrangement', exact: true }).click();
    await expect.poll(async () => (await position('work'))[1]).toBe(208);
    expect((await position('location'))[1]).toBe(208);
    await page.reload();
    await page.getByRole('button', { name: 'Arrange', exact: true }).click();

    const nameHandle = card.getByRole('button', { name: 'Move Name', exact: true });
    const dragName = async (dy: number, alt = false, cancel = false) => {
      await nameHandle.scrollIntoViewIfNeeded();
      const bounds = (await nameHandle.boundingBox())!;
      const scale = await card.locator('.profile-card__layout').evaluate(element => element.getBoundingClientRect().width / Number.parseFloat(getComputedStyle(element).width));
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + dy * scale, { steps: 4 });
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
    };
    await dragName(71);
    const snappedY = (await position('name'))[1];
    expect(snappedY).toBeGreaterThan(0);
    expect(snappedY % 8).toBe(0);
    await dragName(-5, true);
    const freeY = (await position('name'))[1];
    expect(Math.abs(freeY - (snappedY - 5))).toBeLessThanOrEqual(2);
    expect(freeY % 8).not.toBe(0);
    await dragName(5, false, true);
    await expect.poll(async () => (await position('name'))[1]).toBe(freeY);

    await card.getByRole('button', { name: 'Move Profile image', exact: true }).press('ArrowRight');
    expect((await position('avatar'))[0]).toBeGreaterThan(0);
    const nameWidth = (await position('name'))[2];
    await card.getByRole('button', { name: 'Resize Name', exact: true }).press('ArrowLeft');
    expect((await position('name'))[2]).toBeLessThan(nameWidth);

    const moveWork = card.getByRole('button', { name: 'Move Work', exact: true });
    await moveWork.press('ArrowDown');
    await expect.poll(async () => (await position('work'))[1]).toBe(145);
    await moveWork.press('Shift+ArrowDown');
    await moveWork.press('Shift+ArrowDown');
    await expect.poll(async () => (await position('work'))[1]).toBe(161);
    await moveWork.press('Shift+ArrowDown');
    expect((await position('work'))[1]).toBe(161);
    await expect(page.locator('.page-layout-overlap-warning')).toContainText('Change not applied');
    await card.getByRole('button', { name: 'Move Social links', exact: true }).press('Shift+ArrowDown');
    await expect.poll(async () => (await position('socials'))[1]).toBe(216);
    await expect.poll(() => page.locator('.visual-site-editor__canvas').getByRole('heading', { name: 'Following card', exact: true }).evaluate(next => next.closest('.glass-card')!.getBoundingClientRect().top >= document.querySelector('.visual-site-editor__canvas .profile-card')!.getBoundingClientRect().bottom)).toBe(true);
    await card.getByRole('button', { name: 'Align left Location', exact: true }).click();
    await expect(card.locator('[data-profile-layout-item="location"]')).toHaveAttribute('data-profile-layout-align', 'left');
    await saveEditorChanges(page);
    await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
    await page.getByRole('button', { name: 'Arrange', exact: true }).click();
    expect((await position('work'))[1]).toBe(144);
    await card.getByRole('button', { name: 'Move Location', exact: true }).press('ArrowDown');
    await expect.poll(async () => (await position('location'))[1]).toBe(145);
    await saveEditorChanges(page);

    await page.goto('/');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const publicCard = page.locator('.profile-card');
      await expect.poll(async () => (await publicCard.locator('[data-profile-layout-item="work"]').getAttribute('data-profile-layout-position'))!.split(',').map(Number)[1]).toBe(width === 1440 ? 161 : 144);
      await expect.poll(() => publicCard.evaluate(card => {
        const rects = [...card.querySelectorAll('[data-profile-layout-item], [data-profile-layout-fixed]')].map(item => item.getBoundingClientRect());
        return rects.every((a, i) => rects.every((b, j) => i === j || a.right <= b.left + .1 || a.left >= b.right - .1 || a.bottom <= b.top + .1 || a.top >= b.bottom - .1));
      })).toBe(true);
      expect(await publicCard.evaluate(card => card.scrollWidth <= card.clientWidth + 1 && card.querySelector('.profile-card__fixed-bio')!.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom)).toBe(true);
      expect(await publicCard.locator('[data-profile-layout-item]').evaluateAll(items => items.every(item => item.scrollWidth <= item.clientWidth + 1))).toBe(true);
      expect(await page.getByRole('heading', { name: 'Following card', exact: true }).evaluate(next => next.closest('.glass-card')!.getBoundingClientRect().top >= document.querySelector('.profile-card')!.getBoundingClientRect().bottom)).toBe(true);
    }
  } finally { await restore(); }
});
