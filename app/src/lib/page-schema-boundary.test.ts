import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORBITPAGE_PROFILE,
  DEFAULT_ORBITPAGE_THEME,
  ORBITPAGE_CARD_PRESETS,
  ORBITPAGE_THEME_PRESETS,
  applyOrbitPageProfilePatch,
  normalizeOrbitPageSocialHref,
  parseOrbitPageBlockStylePatch,
  parseOrbitPageBlocks,
  parseOrbitPageTheme,
  isOrbitPageThemePresetConfiguration,
} from '@orbitpage/page-schema';
import { themePresets } from './theme-presets';
import { cardThemePresets } from './card-theme-presets';

describe('canonical page schema boundary', () => {
  it('rejects arbitrary agent fields at profile, theme, block and patch boundaries', () => {
    expect(() => applyOrbitPageProfilePatch(DEFAULT_ORBITPAGE_PROFILE, {
      bio: 'Valid update',
      ownerUid: 'attacker-controlled',
    })).toThrow(/unrecognized|unsupported/i);

    expect(() => parseOrbitPageTheme({
      ...DEFAULT_ORBITPAGE_THEME,
      rawCss: 'body { display: none }',
    })).toThrow(/unrecognized|unsupported/i);

    expect(() => parseOrbitPageBlocks([{
      id: 'unsafe',
      type: 'link',
      title: 'Unsafe',
      arbitraryAgentField: { nested: true },
    }])).toThrow(/unrecognized|unsupported/i);

    expect(() => parseOrbitPageBlockStylePatch({
      backgroundColor: '#112233',
      title: 'This endpoint cannot edit content',
    })).toThrow(/unrecognized|unsupported/i);
  });

  it('rejects unsafe URLs and malformed structured block content', () => {
    expect(() => parseOrbitPageBlocks([{
      id: 'private',
      type: 'link',
      title: 'Private service',
      url: 'http://127.0.0.1:8080/admin',
    }])).toThrow(/public HTTP|relative-path/i);

    expect(() => parseOrbitPageBlocks([{
      id: 'video',
      type: 'video',
      title: 'Video',
      content: JSON.stringify({
        mediaUrl: 'https://cdn.example.com/video.mp4',
        executable: 'not-supported',
      }),
    }])).toThrow(/unrecognized|invalid video/i);

    expect(() => parseOrbitPageBlocks([{
      id: 'unsafe-navigation',
      type: 'internal_links',
      title: 'Explore',
      content: JSON.stringify({
        items: [{ id: 'outside', kind: 'page', path: '//attacker.test', label: 'Leave' }],
      }),
    }])).toThrow(/invalid internal-links|items\.0\.path|must match pattern/i);
  });

  it('preserves customizable internal OrbitPage navigation blocks', () => {
    const [navigation] = parseOrbitPageBlocks([{
      id: 'navigation',
      type: 'internal_links',
      title: 'Explore',
      description: 'Choose a destination',
      content: JSON.stringify({
        items: [
          { id: 'menu-link', kind: 'menu', path: '/menu', label: 'Menu', description: 'Food and drinks', icon: '🍽️' },
          { id: 'shop-link', kind: 'shop', path: '/shop', label: 'Shop', description: 'Products and services' },
        ],
        layout: 'grid',
        columns: 2,
        itemStyle: 'outline',
        showDescriptions: true,
        showIcons: true,
      }),
    }]);

    expect(navigation).toMatchObject({ type: 'internal_links', url: '' });
    expect(JSON.parse(navigation.content || '{}')).toMatchObject({
      layout: 'grid',
      columns: 2,
      itemStyle: 'outline',
      items: [
        expect.objectContaining({ kind: 'menu', path: '/menu' }),
        expect.objectContaining({ kind: 'shop', path: '/shop' }),
      ],
    });
  });

  it('canonicalizes legitimate editor URL shortcuts before persistence', () => {
    const [website, contact, social] = parseOrbitPageBlocks([
      {
        id: 'website',
        type: 'link',
        title: 'Website',
        url: 'orbitpage.com/docs',
      },
      {
        id: 'contact',
        type: 'contact',
        title: 'Contact',
        content: JSON.stringify({
          website: 'orbitpage.com',
        }),
      },
      {
        id: 'social',
        type: 'social_row',
        title: '',
        content: JSON.stringify({
          items: [
            { label: 'Instagram', platform: 'instagram', url: '@orbitpage' },
            { label: 'WhatsApp', platform: 'whatsapp', url: '+39 123 456 7890' },
            { label: 'Email', platform: 'email', url: 'hello@orbitpage.com' },
          ],
        }),
      },
    ]);

    expect(website.url).toBe('https://orbitpage.com/docs');
    expect(JSON.parse(contact.content || '{}')).toMatchObject({
      website: 'https://orbitpage.com/',
    });
    expect(JSON.parse(social.content || '{}').items).toEqual([
      expect.objectContaining({ platform: 'instagram', url: 'https://www.instagram.com/orbitpage/' }),
      expect.objectContaining({ platform: 'whatsapp', url: 'https://wa.me/391234567890' }),
      expect.objectContaining({ platform: 'email', url: 'mailto:hello@orbitpage.com' }),
    ]);

    expect(applyOrbitPageProfilePatch(DEFAULT_ORBITPAGE_PROFILE, {
      privacyPolicyUrl: 'orbitpage.com/privacy',
      showOrbitPageBadge: false,
      socialLinks: {
        instagram: '@orbitpage',
        whatsapp: '+39 123 456 7890',
      },
    })).toMatchObject({
      privacy_policy_url: 'https://orbitpage.com/privacy',
      show_orbitpage_badge: false,
      social_links: {
        instagram: 'https://www.instagram.com/orbitpage',
        whatsapp: 'https://wa.me/391234567890',
      },
    });
  });

  it('normalizes social shortcuts in linear time without changing accepted values', () => {
    expect(normalizeOrbitPageSocialHref('instagram', '@///orbitpage///'))
      .toBe('https://www.instagram.com/orbitpage/');
    expect(normalizeOrbitPageSocialHref('email', 'hello@orbitpage.com'))
      .toBe('mailto:hello@orbitpage.com');
    expect(normalizeOrbitPageSocialHref('email', 'hello @orbitpage.com')).toBeNull();

    const repeatedSlashes = `@${'/'.repeat(100_000)}invalid`;
    const repeatedEmailSegments = `!@!.${'!.'.repeat(100_000)}`;
    const startedAt = performance.now();
    expect(normalizeOrbitPageSocialHref('instagram', repeatedSlashes))
      .toBe('https://www.instagram.com/invalid/');
    expect(normalizeOrbitPageSocialHref('email', repeatedEmailSegments)).toBeNull();
    expect(performance.now() - startedAt).toBeLessThan(250);
  });

  it('canonicalizes the legacy circle avatar shape at the profile patch boundary', () => {
    expect(applyOrbitPageProfilePatch(DEFAULT_ORBITPAGE_PROFILE, {
      appearance: {
        avatarShape: 'circle',
      },
    })).toMatchObject({
      appearance: {
        avatarShape: 'round',
      },
    });
  });

  it('accepts the bounded responsive profile layout and rejects duplicate items', () => {
    expect(applyOrbitPageProfilePatch(DEFAULT_ORBITPAGE_PROFILE, {
      appearance: {
        layout: {
          order: ['avatar', 'name', 'bio'],
          spans: { avatar: 1, name: 1, bio: 2 },
          gap: 20,
        },
      },
    })).toMatchObject({
      appearance: {
        layout: {
          order: ['avatar', 'name', 'bio'],
          spans: { avatar: 1, name: 1, bio: 2 },
          gap: 20,
        },
      },
    });

    expect(() => applyOrbitPageProfilePatch(DEFAULT_ORBITPAGE_PROFILE, {
      appearance: { layout: { order: ['name', 'name'] } },
    })).toThrow(/unique|unsupported/i);
  });

  it('binds non-advanced plan metadata to real preset values', () => {
    const essential = ORBITPAGE_THEME_PRESETS['midnight-signal'];
    expect(isOrbitPageThemePresetConfiguration(essential, 'essential')).toBe(true);
    expect(isOrbitPageThemePresetConfiguration({
      ...essential,
      background: '#ffffff',
    }, 'essential')).toBe(false);

    const pagePreset = ORBITPAGE_THEME_PRESETS['paper-ink'];
    const cardPreset = ORBITPAGE_CARD_PRESETS['porcelain'];
    const premium = {
      ...pagePreset,
      orbitPageAccess: {
        mode: 'preset' as const,
        presetId: 'paper-ink',
        cardPresetId: 'porcelain',
      },
      card: cardPreset.card.background,
      cardGradient: {
        from: cardPreset.card.background,
        to: cardPreset.card.backgroundSecondary,
        direction: cardPreset.card.direction,
      },
      contentCard: cardPreset.card,
      contentCardMode: cardPreset.mode,
      contentCardVariants: cardPreset.variants,
    };
    expect(isOrbitPageThemePresetConfiguration(premium, 'premium')).toBe(true);
    expect(isOrbitPageThemePresetConfiguration({
      ...premium,
      contentCard: { ...premium.contentCard, accent: '#abcdef' },
    }, 'premium')).toBe(false);
  });

  it('keeps the editor preset catalog identical to the server policy catalog', () => {
    for (const preset of themePresets) {
      expect(JSON.parse(JSON.stringify(parseOrbitPageTheme(preset.theme))))
        .toEqual(JSON.parse(JSON.stringify(ORBITPAGE_THEME_PRESETS[preset.id])));
    }
    for (const preset of cardThemePresets) {
      expect(JSON.parse(JSON.stringify({
        id: preset.id,
        mode: preset.mode,
        card: preset.card,
        variants: preset.variants,
      }))).toEqual(JSON.parse(JSON.stringify(ORBITPAGE_CARD_PRESETS[preset.id])));
    }
  });
});
