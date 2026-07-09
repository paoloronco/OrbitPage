import { describe, expect, it, vi } from 'vitest';

import {
  commitPendingTheme,
  parseImportedTheme,
  prepareThemeExport,
} from './theme-save-state';

describe('theme save state helpers', () => {
  it('exports the pending theme instead of the last persisted theme', () => {
    const pendingTheme = { primary: '#ffffff', cardRadius: 16 };

    expect(prepareThemeExport(pendingTheme)).toContain('"primary": "#ffffff"');
  });

  it('imports a theme as an unsaved pending change', () => {
    const normalizeTheme = vi.fn((raw) => ({ ...raw, normalized: true }));

    const result = parseImportedTheme('{"primary":"#123456"}', normalizeTheme);

    expect(result).toEqual({
      theme: { primary: '#123456', normalized: true },
      isDirty: true,
      error: '',
    });
  });

  it('keeps theme changes dirty and returns an inline error when saving fails', async () => {
    const pendingTheme = { primary: '#ffffff' };
    const onSave = vi.fn().mockRejectedValue(new Error('Session expired'));

    const result = await commitPendingTheme({
      isDirty: true,
      theme: pendingTheme,
      onSave,
    });

    expect(onSave).toHaveBeenCalledWith(pendingTheme);
    expect(result).toEqual({
      saved: false,
      isDirty: true,
      error: 'Session expired',
    });
  });
});
