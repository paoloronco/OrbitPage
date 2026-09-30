import { expect, it, vi } from 'vitest';
import { checkApplicationUpdate } from './application-updates';

it('checks only stable official releases, compares versions numerically, and fails closed', async () => {
  const fetchRelease = vi.fn();
  vi.stubGlobal('fetch', fetchRelease);
  const release = (tag_name: string, extra = {}) => ({ tag_name, draft: false, prerelease: false, ...extra });
  try {
    for (const [installed, latest, available] of [
      ['4.21.9', 'v4.21.10', true], ['4.21.30', 'v4.21.30', false],
      ['5.0.0', 'v4.99.99', false], ['4.99.99', 'v5.0.0', true],
    ] as const) {
      fetchRelease.mockResolvedValue({ ok: true, json: async () => release(latest, { html_url: 'https://untrusted.example/' }) });
      expect(await checkApplicationUpdate(installed)).toEqual({ version: latest.slice(1), updateAvailable: available, releaseUrl: `https://github.com/paoloronco/OrbitPage/releases/tag/${latest}` });
    }
    expect(fetchRelease).toHaveBeenCalledWith('https://api.github.com/repos/paoloronco/OrbitPage/releases/latest', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
    for (const body of [release('v4.22.0-beta'), release('v4.22.0', { prerelease: true }), release('v4.22.0', { draft: true }), release('v999999999999999999999.0.0'), {}]) {
      fetchRelease.mockResolvedValue({ ok: true, json: async () => body });
      await expect(checkApplicationUpdate('4.21.30')).rejects.toThrow();
    }
    fetchRelease.mockResolvedValue({ ok: false, status: 403 });
    await expect(checkApplicationUpdate('4.21.30')).rejects.toThrow('Update check unavailable.');
    fetchRelease.mockRejectedValue(new Error('Network unavailable'));
    await expect(checkApplicationUpdate('4.21.30')).rejects.toThrow('Network unavailable');
  } finally { vi.unstubAllGlobals(); }
});
