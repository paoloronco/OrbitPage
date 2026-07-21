import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUnusedMedia, collectUploadReferences } from './media-cleanup.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true })));
});

describe('media cleanup', () => {
  it('finds local upload references inside nested JSON and absolute URLs', () => {
    expect([...collectUploadReferences({
      avatar: '/uploads/avatar.webp',
      content: JSON.stringify({ mediaUrl: 'https://example.test/uploads/events/night%20one.jpg?width=900' }),
    })]).toEqual(expect.arrayContaining(['avatar.webp', 'events/night one.jpg']));
  });

  it('deletes only old files that are not referenced by the database', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'orbitpage-media-'));
    temporaryDirectories.push(directory);
    await fs.promises.writeFile(path.join(directory, 'used.jpg'), 'used');
    await fs.promises.writeFile(path.join(directory, 'orphan.jpg'), 'orphan');
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await Promise.all(['used.jpg', 'orphan.jpg'].map((file) => fs.promises.utimes(path.join(directory, file), old, old)));
    const dbAll = async (sql) => sql.includes('sqlite_master')
      ? [{ name: 'profile_data' }]
      : [{ avatar: '/uploads/used.jpg' }];

    const preview = await cleanupUnusedMedia({ dbAll, uploadsPath: directory, graceMs: 60_000 });
    expect(preview).toMatchObject({ scanned: 2, referenced: 1, unused: 1, deleted: 0 });
    expect(fs.existsSync(path.join(directory, 'orphan.jpg'))).toBe(true);

    const cleaned = await cleanupUnusedMedia({ dbAll, uploadsPath: directory, graceMs: 60_000, dryRun: false });
    expect(cleaned.deleted).toBe(1);
    expect(fs.existsSync(path.join(directory, 'used.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(directory, 'orphan.jpg'))).toBe(false);
  });
});
