import { describe, expect, it, vi } from 'vitest';
import { prepareHostedRestoreBackup } from './hosted-backup-import';

describe('hosted backup import', () => {
  it('converts an OSS application backup without carrying admin credentials', async () => {
    const upload = vi.fn(async ({ slot }: { slot: string }) => `https://media.example/${slot}`);
    const result = await prepareHostedRestoreBackup({
      schemaVersion: 1,
      appVersion: '4.7.0',
      createdAt: '2026-07-16T14:35:34.176Z',
      tables: {
        admin_users: [{ username: 'admin', password_hash: 'secret' }],
        profile_data: [{
          name: 'Paolo',
          avatar: 'data:image/png;base64,aGVsbG8=',
          social_links: '{"github":"https://github.com/example"}',
          show_avatar: 1,
          appearance: '{"avatarShape":"round"}',
        }],
        links: [{
          id: 'link-1',
          title: 'GitHub',
          description: 'icon.png',
          url: 'https://github.com/example',
          type: 'link',
          icon: '/uploads/icon.png',
          icon_type: 'image',
          sort_order: 0,
          is_active: 1,
          hide_url: 1,
        }],
        theme_config: [{ full_config: '{"primary":"#167d91"}' }],
        cookie_consent_config: [{ full_config: '{"enabled":true}' }],
      },
      uploads: [
        { path: 'icon.png', data: 'aWNvbg==' },
        { path: 'unused.mp4', data: 'dmlkZW8=' },
      ],
    }, upload);

    expect(result.source).toBe('self-hosted');
    expect(result.migratedMedia).toBe(2);
    expect(result.skippedUploads).toBe(1);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(result.backup).not.toHaveProperty('tables');
    expect(result.backup).not.toHaveProperty('uploads');
    expect(JSON.stringify(result.backup)).not.toContain('password_hash');
    expect(result.backup).toMatchObject({
      format: 'orbitpage-managed-page',
      runtimeVersion: '4.7.0',
      source: { username: 'self-hosted' },
      content: {
        profile: {
          name: 'Paolo',
          social_links: { github: 'https://github.com/example' },
          avatar: 'https://media.example/backup-import-content-profile-avatar',
        },
        links: [{
          id: 'link-1',
          description: 'icon.png',
          hideUrl: true,
          icon: 'https://media.example/backup-import-content-links-0-icon',
        }],
        theme: { primary: '#167d91' },
        consentConfig: { enabled: true },
      },
    });
  });

  it('keeps supported managed backups portable', async () => {
    const backup = {
      format: 'orbitpage-managed-page',
      schemaVersion: 1,
      runtimeVersion: '4.7.0',
      createdAt: '2026-07-16T14:35:34.176Z',
      source: { username: 'paolo' },
      content: { profile: {}, links: [], theme: {}, consentConfig: {} },
    };
    const result = await prepareHostedRestoreBackup(backup, vi.fn());
    expect(result.source).toBe('managed');
    expect(result.backup).toEqual(backup);
  });

  it('rejects unknown backup formats', async () => {
    await expect(prepareHostedRestoreBackup({ hello: 'world' }, vi.fn())).rejects.toThrow(
      'This is not a supported OrbitPage backup.',
    );
  });
});
