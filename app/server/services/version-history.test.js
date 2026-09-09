import { describe, expect, it, vi } from 'vitest';
import { captureApplicationVersion, listApplicationVersions } from './version-history.js';

describe('local version history', () => {
  it('stores one local snapshot per page revision and exposes the current version', async () => {
    const dbGet = vi.fn()
      .mockResolvedValueOnce({ revision: 7 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ revision: 7 });
    const dbAll = vi.fn(async (sql) => sql.startsWith('SELECT revision,')
      ? [{ revision: 7, size_bytes: 120, created_at: '2026-09-09T10:00:00.000Z' }]
      : []);
    const dbRun = vi.fn().mockResolvedValue({ changes: 1 });

    await captureApplicationVersion({ appVersion: '4.20.0', dbAll, dbGet, dbRun, uploadsPath: '/unused' });
    const history = await listApplicationVersions({ dbAll, dbGet });

    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO page_versions'),
      expect.arrayContaining([7]),
    );
    expect(history).toMatchObject({ currentRevision: 7, retention: 25, versions: [{ revision: 7, current: true }] });
  });
});
