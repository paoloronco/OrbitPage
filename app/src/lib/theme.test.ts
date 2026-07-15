import { describe, expect, it } from 'vitest';

import { getCardShadowCss, normalizeTheme } from './theme';

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
});
