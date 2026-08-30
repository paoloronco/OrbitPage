import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  BACKUP_SCHEMA_VERSION,
  SELECTIVE_BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  createApplicationBackup,
  restoreApplicationBackup,
} from './backup-service.js';

const makeTempUploadsDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpage-backup-'));
const pngBytes = (suffix = '') => Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from(suffix),
]);

describe('backup service', () => {
  it('exports all application tables and upload files', async () => {
    const uploadsPath = makeTempUploadsDir();
    fs.mkdirSync(path.join(uploadsPath, 'covers'));
    fs.writeFileSync(path.join(uploadsPath, 'avatar.png'), Buffer.from('avatar'));
    fs.writeFileSync(path.join(uploadsPath, 'covers', 'hero.webp'), Buffer.from('hero'));

    const dbAll = vi.fn(async (sql) => {
      const table = BACKUP_TABLES.find((name) => sql.includes(`FROM ${name}`));
      return table === 'profile_data' ? [{ id: 1, name: 'Paolo' }] : [];
    });

    const backup = await createApplicationBackup({
      appVersion: '4.3.17',
      dbAll,
      uploadsPath,
    });

    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.appVersion).toBe('4.3.17');
    expect(backup.tables.profile_data).toEqual([{ id: 1, name: 'Paolo' }]);
    expect(Object.keys(backup.tables)).toEqual(BACKUP_TABLES);
    expect(backup.uploads).toEqual([
      { path: 'avatar.png', data: Buffer.from('avatar').toString('base64') },
      { path: 'covers/hero.webp', data: Buffer.from('hero').toString('base64') },
    ]);

    fs.rmSync(uploadsPath, { recursive: true, force: true });
  });

  it('restores tables and replaces upload files', async () => {
    const uploadsPath = makeTempUploadsDir();
    fs.writeFileSync(path.join(uploadsPath, 'stale.png'), Buffer.from('stale'));
    const dbRun = vi.fn().mockResolvedValue({ changes: 1 });

    await restoreApplicationBackup({
      backup: {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        tables: {
          admin_users: [{ id: 1, username: 'admin', password_hash: 'hash', salt: 'salt' }],
          profile_data: [{ id: 1, name: 'Restored' }],
          links: [],
          theme_config: [],
          cookie_consent_config: [],
        },
        uploads: [
          { path: 'avatar.png', data: pngBytes('restored').toString('base64') },
        ],
      },
      dbRun,
      uploadsPath,
    });

    expect(dbRun).toHaveBeenCalledWith('DELETE FROM admin_users');
    expect(dbRun).toHaveBeenCalledWith(
      'INSERT INTO profile_data (id, name) VALUES (?, ?)',
      [1, 'Restored'],
    );
    expect(fs.existsSync(path.join(uploadsPath, 'stale.png'))).toBe(false);
    expect(fs.readFileSync(path.join(uploadsPath, 'avatar.png'))).toEqual(pngBytes('restored'));

    fs.rmSync(uploadsPath, { recursive: true, force: true });
  });

  it('exports only selected sections using the selective schema', async () => {
    const uploadsPath = makeTempUploadsDir();
    fs.writeFileSync(path.join(uploadsPath, 'avatar.png'), Buffer.from('avatar'));
    const dbAll = vi.fn(async () => [{ id: 1 }]);

    const backup = await createApplicationBackup({
      appVersion: '4.7.0',
      dbAll,
      uploadsPath,
      sections: ['profile', 'media'],
    });

    expect(backup.schemaVersion).toBe(SELECTIVE_BACKUP_SCHEMA_VERSION);
    expect(backup.includedSections).toEqual(['profile', 'media']);
    expect(Object.keys(backup.tables)).toEqual(['profile_data']);
    expect(backup.uploads).toHaveLength(1);
    expect(dbAll).toHaveBeenCalledTimes(1);

    fs.rmSync(uploadsPath, { recursive: true, force: true });
  });

  it('restores selected legacy sections without touching excluded data or uploads', async () => {
    const uploadsPath = makeTempUploadsDir();
    fs.writeFileSync(path.join(uploadsPath, 'keep.png'), Buffer.from('keep'));
    const dbRun = vi.fn().mockResolvedValue({ changes: 1 });

    await restoreApplicationBackup({
      backup: {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        tables: {
          profile_data: [{ id: 1, name: 'Restored' }],
          links: [{ id: 2, title: 'Do not restore' }],
        },
        uploads: [],
      },
      sections: ['profile'],
      dbRun,
      uploadsPath,
    });

    expect(dbRun).toHaveBeenCalledWith('DELETE FROM profile_data');
    expect(dbRun).not.toHaveBeenCalledWith('DELETE FROM links');
    expect(dbRun).not.toHaveBeenCalledWith('DELETE FROM admin_users');
    expect(fs.readFileSync(path.join(uploadsPath, 'keep.png'), 'utf8')).toBe('keep');

    fs.rmSync(uploadsPath, { recursive: true, force: true });
  });

  it('rejects restoring a section that is absent from a selective backup', async () => {
    await expect(restoreApplicationBackup({
      backup: {
        schemaVersion: SELECTIVE_BACKUP_SCHEMA_VERSION,
        includedSections: ['profile'],
        tables: { profile_data: [] },
        uploads: [],
      },
      sections: ['links'],
      dbRun: vi.fn(),
      uploadsPath: makeTempUploadsDir(),
    })).rejects.toThrow('Backup does not contain section: links');
  });

  it('rejects unsafe upload paths before deleting existing files', async () => {
    const uploadsPath = makeTempUploadsDir();
    fs.writeFileSync(path.join(uploadsPath, 'keep.png'), Buffer.from('keep'));

    await expect(
      restoreApplicationBackup({
        backup: {
          schemaVersion: BACKUP_SCHEMA_VERSION,
          tables: {},
          uploads: [{ path: '../escape.png', data: Buffer.from('bad').toString('base64') }],
        },
        dbRun: vi.fn(),
        uploadsPath,
      }),
    ).rejects.toThrow('Unsafe backup upload path');
    expect(fs.existsSync(path.join(uploadsPath, 'keep.png'))).toBe(true);

    fs.rmSync(uploadsPath, { recursive: true, force: true });
  });

  it.each([
    ['active HTML', { path: 'payload.html', data: Buffer.from('<script>alert(1)</script>').toString('base64') }, 'Unsupported backup media type'],
    ['mismatched content', { path: 'photo.png', data: Buffer.from('<svg/>').toString('base64') }, 'does not match its extension'],
    ['malformed base64', { path: 'photo.png', data: 'not-base64!' }, 'Invalid base64 backup media'],
  ])('rejects %s without replacing live uploads', async (_label, upload, expectedError) => {
    const uploadsPath = makeTempUploadsDir();
    fs.writeFileSync(path.join(uploadsPath, 'keep.png'), pngBytes('keep'));

    await expect(restoreApplicationBackup({
      backup: { schemaVersion: BACKUP_SCHEMA_VERSION, tables: {}, uploads: [upload] },
      dbRun: vi.fn().mockResolvedValue({ changes: 1 }),
      uploadsPath,
    })).rejects.toThrow(expectedError);
    expect(fs.readFileSync(path.join(uploadsPath, 'keep.png'))).toEqual(pngBytes('keep'));

    fs.rmSync(uploadsPath, { recursive: true, force: true });
  });

  it('keeps the previous upload directory when a deferred restore is rolled back', async () => {
    const uploadsPath = makeTempUploadsDir();
    fs.writeFileSync(path.join(uploadsPath, 'keep.png'), pngBytes('keep'));
    const result = await restoreApplicationBackup({
      backup: {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        tables: {},
        uploads: [{ path: 'new.png', data: pngBytes('new').toString('base64') }],
      },
      dbRun: vi.fn().mockResolvedValue({ changes: 1 }),
      uploadsPath,
      deferMediaCommit: true,
    });

    result.mediaRestore.activate();
    result.mediaRestore.rollback();
    expect(fs.existsSync(path.join(uploadsPath, 'new.png'))).toBe(false);
    expect(fs.readFileSync(path.join(uploadsPath, 'keep.png'))).toEqual(pngBytes('keep'));

    fs.rmSync(uploadsPath, { recursive: true, force: true });
  });
});
