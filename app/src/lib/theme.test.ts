import { describe, expect, it } from 'vitest';

import { getCardShadowCss, getCardSurfaceGradient, getContentCardVariant, getContentCardVariantCssVariables, getThemeCssVariables, normalizeTheme } from './theme';

describe('theme normalization', () => {
  it('keeps legacy light themes readable when card settings are absent', () => {
    const theme = normalizeTheme({
      primaryColor: '#2563eb',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
    });

    expect(theme.cardGradient).toMatchObject({
      from: '#ffffff',
      to: '#ffffff',
    });
    expect(theme.contentCard).toMatchObject({
      background: '#ffffff',
      backgroundSecondary: '#ffffff',
      foreground: '#0f172a',
    });
  });

  it('migrates legacy glow values to a bounded card shadow', () => {
    const theme = normalizeTheme({
      primaryGlow: '#336699',
      glowIntensity: 0.65,
      blurIntensity: 42,
    });

    expect(theme.cardShadow).toEqual({
      color: '#336699',
      offsetX: 0,
      offsetY: 8,
      blur: 42,
      spread: 0,
      opacity: 0.65,
    });
    expect(getCardShadowCss(theme.cardShadow)).toBe('0px 8px 42px 0px rgba(51, 102, 153, 0.65)');
  });

  it('clamps imported shadow values before rendering CSS', () => {
    const theme = normalizeTheme({
      cardShadow: {
        color: '#123456',
        offsetX: 100,
        offsetY: -100,
        blur: 200,
        spread: -100,
        opacity: 4,
      },
    });

    expect(theme.cardShadow).toEqual({
      color: '#123456',
      offsetX: 32,
      offsetY: -32,
      blur: 96,
      spread: -32,
      opacity: 1,
    });
  });

  it('keeps existing themes opaque and clamps imported card opacity', () => {
    const existingTheme = normalizeTheme({ primary: '#2563eb' });
    const importedTheme = normalizeTheme({ profileCardOpacity: 0, contentCardOpacity: 4 });

    expect(existingTheme.profileCardOpacity).toBe(1);
    expect(existingTheme.contentCardOpacity).toBe(1);
    expect(importedTheme.profileCardOpacity).toBe(0);
    expect(importedTheme.contentCardOpacity).toBe(1);
  });

  it('applies transparency to card surfaces without changing their content colors', () => {
    const theme = normalizeTheme({ profileCardOpacity: 0.4, contentCardOpacity: 0.25 });
    const variables = getThemeCssVariables(theme);

    expect(variables['--profile-card-background']).toContain('rgba(28, 36, 51, 0.4)');
    expect(variables['--content-card-background']).toContain('rgba(28, 36, 51, 0.25)');
    expect(variables['--content-card-foreground']).toBe(theme.contentCard.foreground);
    expect(variables['--profile-card-opacity-percent']).toBe('40%');
    expect(variables['--content-card-opacity-percent']).toBe('25%');
    expect(getCardSurfaceGradient(theme.contentCard, 0)).toContain(', 0)');
  });

  it('keeps valid card surface effects and safely falls back for older or invalid themes', () => {
    const customizedTheme = normalizeTheme({
      profileCardEffect: 'transparent',
      contentCardEffect: 'liquid-glass',
    });
    const invalidTheme = normalizeTheme({ profileCardEffect: 'invisible', contentCardEffect: null });

    expect(customizedTheme.profileCardEffect).toBe('transparent');
    expect(customizedTheme.contentCardEffect).toBe('liquid-glass');
    expect(invalidTheme.profileCardEffect).toBe('solid');
    expect(invalidTheme.contentCardEffect).toBe('solid');
  });

  it('returns the inherited content-card colors for mono themes', () => {
    const theme = normalizeTheme({
      contentCardMode: 'mono',
      contentCard: {
        ...normalizeTheme({}).contentCard,
        background: '#123456',
        foreground: '#f8fafc',
      },
    });

    expect(getContentCardVariant(theme, 4)).toMatchObject({
      background: '#123456',
      foreground: '#f8fafc',
    });
    expect(getContentCardVariantCssVariables(theme, 4)['--content-card-surface-tint']).toBe('#123456');
  });

  it('cycles through the effective content-card colors for multi themes', () => {
    const baseTheme = normalizeTheme({});
    const theme = normalizeTheme({
      contentCardMode: 'multi',
      contentCardVariants: [
        { ...baseTheme.contentCard, background: '#102030', foreground: '#ffffff' },
        { ...baseTheme.contentCard, background: '#f4f5f6', foreground: '#111827' },
      ],
    });

    expect(getContentCardVariant(theme, 0).background).toBe('#102030');
    expect(getContentCardVariant(theme, 1).foreground).toBe('#111827');
    expect(getContentCardVariant(theme, 2).background).toBe('#102030');
  });
});
