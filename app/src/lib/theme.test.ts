import { describe, expect, it } from 'vitest';

import { normalizeTheme } from './theme';

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
});
