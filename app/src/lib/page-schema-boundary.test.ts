import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORBITPAGE_CONSENT_CONFIG,
  DEFAULT_ORBITPAGE_MENU,
  DEFAULT_ORBITPAGE_PROFILE,
  DEFAULT_ORBITPAGE_THEME,
  ORBITPAGE_PAGE_SCHEMA_VERSION,
  ORBITPAGE_CARD_PRESETS,
  ORBITPAGE_THEME_PRESETS,
  OrbitPageDocumentJsonSchema,
  applyOrbitPageProfilePatch,
  normalizeStoredOrbitPageDocument,
  parseOrbitPageBlockStylePatch,
  parseOrbitPageBlocks,
  parseOrbitPageDocument,
  parseOrbitPageTheme,
  isOrbitPageThemePresetConfiguration,
} from '@orbitpage/page-schema';
import { themePresets } from './theme-presets';
import { cardThemePresets } from './card-theme-presets';

const timestamp = '2026-07-29T12:00:00.000Z';

function pageDocument() {
  return {
    schemaVersion: ORBITPAGE_PAGE_SCHEMA_VERSION,
    pageId: 'page-1',
    tenantId: 'tenant-1',
    ownerUid: 'owner-1',
    profile: DEFAULT_ORBITPAGE_PROFILE,
    links: parseOrbitPageBlocks([{
      id: 'website',
      type: 'link',
      title: 'Website',
      url: 'https://example.com',
    }]),
    theme: DEFAULT_ORBITPAGE_THEME,
    menu: DEFAULT_ORBITPAGE_MENU,
    consentConfig: DEFAULT_ORBITPAGE_CONSENT_CONFIG,
    textFiles: [],
    subpages: [],
    revision: 4,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('canonical page schema boundary', () => {
  it('accepts and serializes a current canonical document', () => {
    const parsed = parseOrbitPageDocument(pageDocument());

    expect(parsed.schemaVersion).toBe(1);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
    expect(OrbitPageDocumentJsonSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
  });

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
  });

  it('migrates legacy documents by dropping unknown fields and canonicalizing aliases', () => {
    const legacy = {
      ...pageDocument(),
      schemaVersion: undefined,
      profile: {
        name: 'Legacy',
        showAvatar: false,
        unknownProfileField: 'drop-me',
      },
      links: [{
        id: 42,
        title: 'Legacy link',
        icon_type: 'emoji',
        unknownBlockField: 'drop-me',
      }],
      theme: {
        primaryColor: '#123456',
        unknownThemeField: 'drop-me',
      },
      unknownTopLevelField: 'drop-me',
    };

    const migrated = normalizeStoredOrbitPageDocument(legacy);

    expect(migrated.profile).toMatchObject({ name: 'Legacy', show_avatar: 0 });
    expect(migrated.links[0]).toMatchObject({ id: '42', iconType: 'emoji', position: 0 });
    expect(migrated.theme.primary).toBe('#123456');
    expect(migrated).not.toHaveProperty('unknownTopLevelField');
    expect(migrated.profile).not.toHaveProperty('unknownProfileField');
    expect(migrated.links[0]).not.toHaveProperty('unknownBlockField');
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
