import { describe, expect, it } from 'vitest';
import { prepareHostedRestoreBackup } from './hosted-backup-import';
import { createPortableBackupArchive, readPortableBackupArchive } from './portable-backup';

describe('portable backup archive', () => {
  it('turns a managed backup and its image into a restorable OSS backup', async () => {
    const key = 'tenants/t1/pages/p1/avatar.png';
    const archive = await createPortableBackupArchive({
      format: 'orbitpage-managed-page',
      schemaVersion: 2,
      runtimeVersion: '4.21.2',
      createdAt: '2026-09-14T00:00:00.000Z',
      source: { username: 'paolo' },
      includedSections: ['profile'],
      content: { profile: { avatar: `/api/orbitpage/assets/${key}` } },
    }, [{ path: 'avatar.png', reference: key, bytes: new Uint8Array([1, 2, 3]) }]);

    const restored = await readPortableBackupArchive(archive) as Record<string, unknown>;
    expect(restored).toMatchObject({ schemaVersion: 2, includedSections: ['profile', 'media'] });
    expect(restored.uploads).toEqual([{ path: 'portable/1-avatar.png', data: 'AQID' }]);
    expect(restored).toHaveProperty('tables.profile_data.0.avatar', '/uploads/portable/1-avatar.png');

    const hosted = await prepareHostedRestoreBackup(restored, async () => 'https://media.example/avatar.png');
    expect(hosted.migratedMedia).toBe(1);
    expect(hosted.backup).toHaveProperty('content.profile.avatar', 'https://media.example/avatar.png');
  });
});
