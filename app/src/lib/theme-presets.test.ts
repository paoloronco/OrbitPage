import { describe, expect, it } from 'vitest';

import { cardThemePresets } from './card-theme-presets';
import { getContrastRatio, getReadableForeground } from './theme';
import { themePresets } from './theme-presets';

const minimumTextContrast = 4.5;

const expectReadable = (label: string, foreground: string, backgrounds: string[]) => {
  backgrounds.forEach((background) => {
    expect.soft(
      getContrastRatio(foreground, background),
      `${label}: ${foreground} on ${background}`,
    ).toBeGreaterThanOrEqual(minimumTextContrast);
  });
};

describe('theme preset accessibility', () => {
  it('ships a varied set of unique page themes', () => {
    expect(themePresets.length).toBeGreaterThanOrEqual(18);
    expect(new Set(themePresets.map((preset) => preset.id)).size).toBe(themePresets.length);
  });

  it('keeps text and controls readable across every page theme', () => {
    themePresets.forEach(({ id, theme }) => {
      expectReadable(`${id} page text`, theme.foreground, [theme.backgroundGradient.from, theme.backgroundGradient.to]);
      expectReadable(`${id} page secondary text`, theme.muted, [theme.backgroundGradient.from, theme.backgroundGradient.to]);
      expectReadable(`${id} profile text`, theme.profileCard.foreground, [theme.profileCard.background, theme.profileCard.backgroundSecondary]);
      expectReadable(`${id} profile secondary text`, theme.profileCard.muted, [theme.profileCard.background, theme.profileCard.backgroundSecondary]);
      expectReadable(`${id} profile action`, getReadableForeground(theme.profileCard.accent, theme.profileCard.foreground), [theme.profileCard.accent]);
      expectReadable(`${id} card text`, theme.contentCard.foreground, [theme.contentCard.background, theme.contentCard.backgroundSecondary]);
      expectReadable(`${id} card secondary text`, theme.contentCard.muted, [theme.contentCard.background, theme.contentCard.backgroundSecondary]);
      expectReadable(`${id} card action`, theme.contentCard.accentForeground, [theme.contentCard.accent]);

      expect(theme.cardShadow.opacity, `${id} shadow opacity`).toBeGreaterThanOrEqual(0);
      expect(theme.cardShadow.opacity, `${id} shadow opacity`).toBeLessThanOrEqual(1);
      expect(theme.cardShadow.blur, `${id} shadow blur`).toBeGreaterThanOrEqual(0);
      expect(theme.cardShadow.blur, `${id} shadow blur`).toBeLessThanOrEqual(96);
    });
  });

  it('keeps every standalone card style readable', () => {
    cardThemePresets.forEach((preset) => {
      preset.variants.forEach((variant, index) => {
        const label = `${preset.id} variant ${index + 1}`;
        const backgrounds = [variant.background, variant.backgroundSecondary];
        expectReadable(`${label} text`, variant.foreground, backgrounds);
        expectReadable(`${label} secondary text`, variant.muted, backgrounds);
        expectReadable(`${label} action`, variant.accentForeground, [variant.accent]);
      });
    });
  });
});
