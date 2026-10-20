import { expect, test, type Locator } from '@playwright/test';
import type { LinkData } from '../src/components/LinkCard';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, preservePageData } from './helpers';

const examples: Partial<LinkData>[] = [
  { id: 'plain', type: 'link', url: 'https://example.invalid' },
  { id: 'icon', type: 'link', url: 'https://example.invalid', icon: 'link' },
  { id: 'cover', type: 'link', url: 'https://example.invalid', coverImage: '/brand/orbitpage-mark-192.png' },
  { id: 'text', type: 'text', content: 'Body copy' },
  { id: 'list', type: 'text', content: 'Body copy', textItems: [{ text: 'List entry', url: 'https://example.invalid' }] },
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
      return Math.abs(alignment === 'center' ? (text.left + text.right - frame.left - frame.right) / 2 / scale
        : alignment === 'right' ? (frame.right - text.right) / scale - 17 : (text.left - frame.left) / scale - 17);
    }, alignment)).toBeLessThanOrEqual(.1);
  }
}

test('every content block shares exact left, center and right text frames across fonts and themes', async ({ page }) => {
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
      const links = blocks(alignment).filter(link => ['plain', 'icon', 'text', 'heading', 'cta', 'menu'].includes(link.id));
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
