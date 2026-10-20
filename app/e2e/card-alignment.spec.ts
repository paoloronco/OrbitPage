import { expect, test, type Locator } from '@playwright/test';
import type { LinkData } from '../src/components/LinkCard';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData } from './helpers';

const examples: Partial<LinkData>[] = [
  { id: 'plain', type: 'link', url: 'https://example.invalid' },
  { id: 'icon', type: 'link', url: 'https://example.invalid', icon: 'link' },
  { id: 'cover', type: 'link', url: 'https://example.invalid', coverImage: '/brand/orbitpage-mark-192.png' },
  { id: 'text', type: 'text', content: 'Body copy' },
  { id: 'list', type: 'text', icon: '📁', iconType: 'emoji', content: 'Body copy', textItems: [{ text: 'List entry', url: 'https://example.invalid' }] },
  { id: 'list-image', type: 'text', icon: '/brand/orbitpage-mark-192.png', iconType: 'image', coverImage: '/brand/orbitpage-mark-192.png', textItems: [{ text: 'List entry', url: 'https://example.invalid/a-long-list-item-address-that-wraps' }] },
  { id: 'heading', type: 'heading' },
  { id: 'cta', type: 'cta', url: 'https://example.invalid', ctaAction: 'book' },
  { id: 'image', type: 'image', url: '/brand/orbitpage-mark-192.png' },
  { id: 'video', type: 'video', content: JSON.stringify({ mediaUrl: '/fictional-video.mp4', controls: true }) },
  { id: 'contact', type: 'contact', content: JSON.stringify({ role: 'Designer', email: 'fictional@example.invalid' }) },
  { id: 'internal', type: 'internal_links', content: JSON.stringify({ items: [{ id: 'page', kind: 'page', path: '/about', label: 'About' }], layout: 'grid', columns: 2, showIcons: true }) },
  { id: 'social', type: 'social_row', content: JSON.stringify({ items: [{ id: 'social', label: 'Social', url: 'fictional', platform: 'github' }], showLabels: true }) },
  { id: 'callout', type: 'callout', url: 'https://example.invalid', content: JSON.stringify({ badge: 'Notice' }) },
  { id: 'map', type: 'map', content: JSON.stringify({ address: 'Turin, Italy' }) },
  { id: 'event', type: 'event', content: JSON.stringify({ date: '2030-01-01', location: 'Fictional venue', showCountdown: false }) },
  { id: 'embed', type: 'embed', content: JSON.stringify({ provider: 'youtube', snippet: 'https://www.youtube.com/watch?v=abcdefghijk', height: 200 }) },
  { id: 'newsletter', type: 'newsletter' },
  { id: 'separator', type: 'separator' },
  { id: 'menu', type: 'menu', url: '/menu' },
  { id: 'shop', type: 'link', url: '/shop' },
];

const blocks = (alignment: LinkData['alignment']) => examples.map((example, index) => ({
  title: example.id === 'social' ? 'Social' : `Aligned ${example.id}`,
  description: 'Supporting copy', url: '', isActive: true, alignment,
  size: (['small', 'medium', 'large'] as const)[index % 3],
  titleFontSize: `${[12, 18, 24][index % 3]}px`,
  titleFontFamily: ['Arial', 'Georgia', 'monospace'][index % 3],
  descriptionFontSize: `${[11, 15, 20][index % 3]}px`,
  descriptionFontFamily: ['Georgia', 'monospace', 'Arial'][index % 3],
  surfaceEffect: (['solid', 'transparent', 'liquid-glass'] as const)[index % 3],
  backgroundColor: index % 2 ? '#ffffff' : '#302356',
  textColor: index % 2 ? '#121212' : '#ffffff',
  ...example,
} as LinkData));

test('mobile link icons and navigation stay on compact horizontal rows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const items = ['Services', 'Resources', 'Contact'].map(label => ({ id: label, kind: 'page', path: '/' + label.toLowerCase(), label, description: 'Useful information', icon: '📁' }));
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: {
        profile: { name: '', bio: '', avatar: '', showAvatar: false },
        links: [
          { id: 'compact', type: 'link', title: 'Sampling schedule', description: 'View the schedule', url: 'https://example.invalid', hideUrl: true, icon: '📅', iconType: 'emoji', alignment: 'center' },
          { id: 'long', type: 'link', title: 'Detailed instructions', description: 'Keep all the useful details readable. '.repeat(20), url: 'https://example.invalid', hideUrl: true, icon: '📁', iconType: 'emoji' },
          { id: 'list', type: 'text', title: 'Useful links', icon: '📁', iconType: 'emoji', textItems: [{ text: 'A useful resource', url: 'https://example.invalid/a-long-list-item-address-that-wraps' }] },
          ...['stacked', 'buttons'].map(layout => ({ id: layout, type: 'internal_links', title: '', content: JSON.stringify({ items, layout, showIcons: true, showDescriptions: true }) })),
        ], theme: {}, branding: { showOrbitPageBadge: false },
      }, consentConfig: { mode: 'disabled', enabled: false },
    };
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const card = page.locator('[data-card-content-layout="compact"]');
    await expect(card).toBeVisible();
    const row = await card.evaluate(element => {
      const icon = element.querySelector('[data-card-content-layout-item="icon"]')!.getBoundingClientRect();
      const title = element.querySelector('h3')!.getBoundingClientRect();
      const copy = element.querySelector('.public-block-copy')!.getBoundingClientRect();
      const card = element.closest('.glass-card')!;
      const style = getComputedStyle(card);
      const padding = [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth].reduce((sum, value) => sum + Number.parseFloat(value), 0);
      return { overlap: Math.min(icon.bottom, title.bottom) - Math.max(icon.top, title.top), emptyHeight: card.getBoundingClientRect().height - Math.max(icon.height, copy.height) - padding };
    });
    expect(row.overlap, `Icon and title share a row at ${width}px`).toBeGreaterThan(0);
    expect(Math.abs(row.emptyHeight)).toBeLessThanOrEqual(.1);
    const long = await page.locator('[data-card-content-layout="long"]').evaluate(element => {
      const icon = element.querySelector('[data-card-content-layout-item="icon"]')!.getBoundingClientRect();
      const title = element.querySelector('h3')!.getBoundingClientRect();
      const description = element.querySelector('[data-card-content-layout-item="description"]')!.getBoundingClientRect();
      const card = element.closest('.glass-card')!.getBoundingClientRect();
      return { overlap: Math.min(icon.bottom, title.bottom) - Math.max(icon.top, title.top), fits: description.bottom <= card.bottom };
    });
    expect(long.overlap).toBeGreaterThan(0);
    expect(long.fits).toBe(true);
    expect(await page.getByRole('heading', { name: 'Useful links', exact: true }).evaluate(title => {
      const icon = title.closest('.glass-card')!.querySelector('[data-card-content-layout-item="icon"]')!.getBoundingClientRect();
      const heading = title.getBoundingClientRect();
      return Math.min(icon.bottom, heading.bottom) - Math.max(icon.top, heading.top);
    })).toBeGreaterThan(0);
    for (const item of await page.locator('.public-internal-link').all()) {
      const row = await item.evaluate(element => {
        const icon = element.querySelector('.public-internal-link__icon')!.getBoundingClientRect();
        const title = element.querySelector('strong')!.getBoundingClientRect();
        const copy = element.querySelector('.public-internal-link__copy')!.getBoundingClientRect();
        const style = getComputedStyle(element);
        const padding = [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth].reduce((sum, value) => sum + Number.parseFloat(value), 0);
        const expected = Math.max(Number.parseFloat(style.minHeight), Math.max(icon.height, copy.height) + padding);
        return { overlap: Math.min(icon.bottom, title.bottom) - Math.max(icon.top, title.top), emptyHeight: element.getBoundingClientRect().height - expected };
      });
      expect(row.overlap).toBeGreaterThan(0);
      expect(Math.abs(row.emptyHeight)).toBeLessThanOrEqual(.1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  expect(await page.locator('[data-card-content-layout="compact"]').evaluate(element => {
    const icon = element.querySelector('[data-card-content-layout-item="icon"]')!.getBoundingClientRect();
    const action = element.querySelector('button')!.getBoundingClientRect();
    return icon.right <= action.left || action.right <= icon.left;
  })).toBe(true);
  await page.setViewportSize({ width: 160, height: 900 });
  for (const card of await page.locator('.glass-card').all()) {
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});

async function checkTextFrame(root: Locator, links: LinkData[], alignment: LinkData['alignment']) {
  const targets = [
    ...links.map(link => root.getByText(link.title, { exact: true })),
    ...await root.getByText('Supporting copy', { exact: true }).all(),
    ...await root.getByText('Body copy', { exact: true }).all(),
    ...await root.getByText('List entry', { exact: true }).all(),
    ...await root.locator('[data-card-content-layout-item="url"]').all(),
  ];
  for (const title of targets) {
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('text-align', alignment!);
    await expect.poll(() => title.evaluate((element, alignment) => {
      const card = element.closest<HTMLElement>('.glass-card, .public-unboxed-block, .public-cta-card, .public-separator')!;
      const frame = card.getBoundingClientRect();
      const scale = frame.width / Number.parseFloat(getComputedStyle(card).width);
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const inset = 17 + (element.closest('.public-text-card__list') ? 24 : element.closest('.public-link-card__row') ? 44 : 0);
      return Math.abs(alignment === 'center' ? (text.left + text.right - frame.left - frame.right) / 2 / scale
        : alignment === 'right' ? (frame.right - text.right) / scale - inset : (text.left - frame.left) / scale - inset);
    }, alignment)).toBeLessThanOrEqual(.1);
  }
  for (const link of links.filter(link => link.type === 'text' && link.icon)) {
    await expect.poll(() => root.getByText(link.title, { exact: true }).evaluate(title => {
      const icon = title.closest('.glass-card')!.querySelector('.flex-shrink-0')!.getBoundingClientRect();
      const heading = title.getBoundingClientRect();
      return Math.min(icon.bottom, heading.bottom) - Math.max(icon.top, heading.top);
    }), `Text-card icon and title share a row: ${link.id}`).toBeGreaterThan(0);
  }
}

test('content blocks keep consistent left, center and right text frames across fonts and themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', route => new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort());
  await page.addInitScript(({ left, center, right }) => {
    const alignment = new URL(location.href).searchParams.get('alignment') || 'left';
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: { profile: { name: '', bio: '', avatar: '', showAvatar: false }, links: { left, center, right }[alignment], theme: {}, branding: { showOrbitPageBadge: false } },
      consentConfig: { mode: 'disabled', enabled: false },
    };
  }, { left: blocks('left'), center: blocks('center'), right: blocks('right') });
  for (const alignment of ['left', 'center', 'right'] as const) {
    await page.goto(`/?alignment=${alignment}`);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkTextFrame(page.locator('.public-card-stack'), blocks(alignment), alignment);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('list bodies share an inset below their headers with or without icons and wrap long items', async ({ page }) => {
  test.setTimeout(60_000);
  const textItems = Array.from({ length: 6 }, (_, index) => ({
    text: index ? `Resource ${index}: ${'A long resource name '.repeat(3)}` : 'UnbrokenResourceName'.repeat(8),
    url: `https://example.invalid/${'long-repository-address-'.repeat(4)}${index}`,
    fontSize: `${[12, 20, 28][index % 3]}px`, fontFamily: ['Arial', 'Georgia', 'monospace'][index % 3],
  }));
  const links = ['left', 'center', 'right'].flatMap(alignment => [
    { id: `plain-${alignment}`, title: 'Repository collection', textItems },
    { id: `emoji-${alignment}`, title: 'Resources', icon: '🛍️', iconType: 'emoji', textItems: textItems.slice(0, 2) },
    { id: `image-${alignment}`, title: 'Image list', icon: '/brand/orbitpage-mark-192.png', iconType: 'image', coverImage: '/brand/orbitpage-mark-192.png', textItems: textItems.slice(0, 2) },
    { id: `markdown-${alignment}`, title: 'Written list', icon: '📁', iconType: 'emoji', content: `- ${'UnbrokenResourceName'.repeat(8)}\n- Another resource (https://example.invalid/resource)` },
  ].map(link => ({ ...link, type: 'text', alignment, url: '', isActive: true })));
  await page.addInitScript(links => {
    (window as unknown as { __ORBITPAGE_STATIC_SNAPSHOT__: unknown }).__ORBITPAGE_STATIC_SNAPSHOT__ = {
      page: { profile: { name: '', bio: '', avatar: '', showAvatar: false }, links, theme: {}, branding: { showOrbitPageBadge: false } },
      consentConfig: { mode: 'disabled', enabled: false },
    };
  }, links);
  await page.goto('/');
  await expect(page.locator('.public-text-card__list')).toHaveCount(12);
  for (const width of [1440, 768, 390, 320, 160]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dir of ['ltr', 'rtl']) {
      await page.evaluate(dir => { document.documentElement.dir = dir; }, dir);
      await expect.poll(() => page.locator('.public-text-card__list').evaluateAll(lists => lists.every(list => {
        const frame = list.getBoundingClientRect(), body = list.closest('.public-text-card__body')!.getBoundingClientRect();
        const style = getComputedStyle(list), inset = Math.max(16, Math.min(24, frame.width * .1));
        const card = list.closest<HTMLElement>('.glass-card')!;
        return Math.abs(frame.left - body.left) <= .1 && Math.abs(frame.right - body.right) <= .1
          && Math.abs(Number.parseFloat(style.paddingInlineStart) - inset) <= .1
          && style.listStyleType === 'disc' && style.listStylePosition === 'outside'
          && [...list.querySelectorAll('li')].every(item => {
            const itemFrame = item.getBoundingClientRect(), marker = getComputedStyle(item, '::marker');
            return Math.abs(itemFrame.left - frame.left - inset) <= .1 && Math.abs(frame.right - itemFrame.right - inset) <= .1
              && marker.fontSize === '16px' && marker.fontFamily.startsWith('Arial')
              && item.scrollWidth <= item.clientWidth + 1;
          }) && card.scrollWidth <= card.clientWidth + 1;
      })), `List gutters and wrapping at ${width}px, ${dir}`).toBe(true);
    }
  }
});

test('preview and saved public card alignment use the same geometry, including hover and copy controls', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, appearance: {} } })).ok()).toBeTruthy();
    for (const alignment of ['left', 'center', 'right'] as const) {
      const links = blocks(alignment).filter(link => ['plain', 'icon', 'text', 'list', 'list-image', 'heading', 'cta', 'menu'].includes(link.id));
      expect((await page.request.put('/api/links', { headers, data: links })).ok()).toBeTruthy();
      await page.goto('/admin');
      for (const device of ['Desktop', 'Mobile']) {
        await page.getByRole('button', { name: `${device} preview`, exact: true }).click();
        await checkTextFrame(page.locator('.visual-site-editor__canvas'), links, alignment);
      }
      await page.goto('/');
      const publicCards = page.locator('.public-card-stack');
      await checkTextFrame(publicCards, links, alignment);
      await publicCards.getByText('Aligned plain', { exact: true }).hover();
      await checkTextFrame(publicCards, links, alignment);
      await publicCards.getByRole('button', { name: 'Copy link', exact: true }).first().focus();
      await checkTextFrame(publicCards, links, alignment);
    }
  } finally {
    await restore();
  }
});
