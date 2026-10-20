import { expect, test, type Locator } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, openPreviewContentCard, preservePageData, saveEditorChanges } from './helpers';

async function checkSeparators(root: Locator) {
  const results = await root.locator('.public-separator').evaluateAll(cards => cards.map(card => {
    const frame = card.getBoundingClientRect(), style = getComputedStyle(card);
    const title = card.querySelector<HTMLElement>('.public-separator__title');
    const lines = [...card.querySelectorAll('.public-separator__line')].map(line => line.getBoundingClientRect());
    const position = card.getAttribute('data-line-position'), alignment = card.getAttribute('data-alignment');
    const scale = frame.width / parseFloat(style.width);
    const left = frame.left + (parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth)) * scale;
    const right = frame.right - (parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)) * scale;
    let correct = card.scrollWidth <= card.clientWidth + 1 && lines.every(line => line.width > 0);
    if (title) {
      const text = title.getBoundingClientRect();
      correct &&= text.left >= left - 1 && text.right <= right + 1;
      if (position === 'inline') {
        correct &&= lines.length === (alignment === 'center' ? 2 : 1)
          && lines.every(line => line.left >= text.right - 1 || line.right <= text.left + 1);
        if (alignment === 'center') correct &&= Math.abs((text.left + text.right - left - right) / scale) <= .1;
      } else {
        correct &&= lines.length === 1 && Math.abs((lines[0].left - left) / scale) <= .1
          && Math.abs((lines[0].right - right) / scale) <= .1
          && (position === 'above' ? lines[0].bottom <= text.top : lines[0].top >= text.bottom)
          && getComputedStyle(title).textAlign === alignment;
      }
    } else correct &&= lines.length === 1;
    return { position, alignment, title: title?.textContent, correct };
  }));
  expect(results.length).toBeGreaterThan(0);
  expect(results.filter(result => !result.correct)).toEqual([]);
}

test('separator positions and alignments wrap inside transparent and boxed cards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const links = [false, true].flatMap(boxed => ['inline', 'above', 'below'].flatMap(linePosition => ['left', 'center', 'right'].map(alignment => ({
      id: `${boxed}-${linePosition}-${alignment}`, type: 'separator', title: 'Section', alignment,
      content: JSON.stringify({ boxed, linePosition }), titleFontSize: boxed ? '28px' : '12px',
    }))));
    links.push(
      { id: 'long', type: 'separator', title: 'Averylongsectiontitlewithoutspaces'.repeat(8), alignment: 'center', content: '{"linePosition":"inline"}', titleFontSize: '28px' },
      { id: 'empty', type: 'separator', title: '', alignment: 'left', content: '{}', titleFontSize: '12px' },
    );
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: { profile: { name: '', bio: '', avatar: '', showAvatar: false }, links, theme: {}, branding: { showOrbitPageBadge: false } },
      consentConfig: { mode: 'disabled', enabled: false },
    };
  });
  for (const width of [1440, 768, 390, 320, 160]) {
    await page.setViewportSize({ width, height: 980 });
    await page.goto('/');
    await expect(page.locator('.public-separator')).toHaveCount(20);
    for (const dir of ['ltr', 'rtl']) {
      await page.evaluate(dir => { document.documentElement.dir = dir; }, dir);
      await checkSeparators(page.locator('body'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
});

test('separator controls update preview, save through the API and survive reload on the public page', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, appearance: {} } })).ok()).toBeTruthy();
    expect((await page.request.put('/api/links', { headers, data: [{ id: 'separator', type: 'separator', title: 'My section', content: '{"boxed":false}' }] })).ok()).toBeTruthy();
    for (const [position, label, alignment, boxed] of [
      ['above', 'Above text', 'Center', 'Full background'],
      ['below', 'Below text', 'Right', 'Transparent line'],
      ['inline', 'Beside text', 'Left', 'Full background'],
    ]) {
      await page.goto('/admin');
      const canvas = page.locator('.visual-site-editor__canvas');
      const preview = canvas.locator('[data-public-editor-link-id="separator"]');
      const { editor } = await openPreviewContentCard(page, preview);
      await editor.getByLabel('Line position', { exact: true }).click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await editor.getByLabel('Alignment', { exact: true }).click();
      await page.getByRole('option', { name: alignment, exact: true }).click();
      await editor.getByLabel('Separator background', { exact: true }).click();
      await page.getByRole('option', { name: boxed, exact: true }).click();
      await expect(preview.locator('.public-separator')).toHaveAttribute('data-line-position', position);
      await saveEditorChanges(page);
      const saved = await (await page.request.get('/api/links', { headers })).json();
      expect(JSON.parse(saved[0].content)).toEqual({ boxed: boxed === 'Full background', linePosition: position });
      expect(saved[0].alignment).toBe(alignment.toLowerCase());
      await page.reload();
      await expect(preview.locator('.public-separator')).toHaveAttribute('data-line-position', position);
      for (const device of ['Desktop', 'Mobile']) {
        await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
        await checkSeparators(canvas);
      }
      await page.goto('/');
      await expect(page.locator('.public-separator')).toHaveAttribute('data-line-position', position);
      await checkSeparators(page.locator('body'));
    }
  } finally { await restore(); }
});
