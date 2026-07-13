import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_UPLOAD_STORAGE_QUOTA_BYTES,
  DEFAULT_VIDEO_UPLOAD_LIMIT_BYTES,
  UploadQuotaExceededError,
  UPLOAD_FILE_MODE,
  createUploadFilename,
  enforceUploadStorageQuota,
  getUploadStorageQuotaBytes,
  getVideoUploadLimitBytes,
} from './upload-policy.js';

describe('upload policy', () => {
  it('creates non-guessable raster image filenames with a normalized extension', () => {
    const filename = createUploadFilename('img', 'Avatar.PNG');

    expect(filename).toMatch(
      /^img-\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/i,
    );
  });

  it('creates separate background media filenames', () => {
    const filename = createUploadFilename('bg', 'intro.WEBM');

    expect(filename).toMatch(/^bg-\d{13}-[0-9a-f-]+\.webm$/i);
  });

  it('uses owner-writable, non-world-writable upload permissions', () => {
    expect(UPLOAD_FILE_MODE).toBe(0o644);
  });

  it('uses a safe default upload storage quota', () => {
    expect(getUploadStorageQuotaBytes({})).toBe(DEFAULT_UPLOAD_STORAGE_QUOTA_BYTES);
  });

  it('reads upload storage quota from megabytes', () => {
    expect(getUploadStorageQuotaBytes({ UPLOAD_STORAGE_QUOTA_MB: '2' })).toBe(2 * 1024 * 1024);
  });

  it('uses a configurable video upload limit', () => {
    expect(getVideoUploadLimitBytes({})).toBe(DEFAULT_VIDEO_UPLOAD_LIMIT_BYTES);
    expect(getVideoUploadLimitBytes({ VIDEO_UPLOAD_LIMIT_MB: '25' })).toBe(25 * 1024 * 1024);
  });

  it('removes the newly uploaded file when storage quota is exceeded', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpage-upload-quota-'));
    const existingPath = path.join(tempDir, 'existing.png');
    const newPath = path.join(tempDir, 'new.png');

    fs.writeFileSync(existingPath, Buffer.alloc(8));
    fs.writeFileSync(newPath, Buffer.alloc(8));

    expect(() =>
      enforceUploadStorageQuota({
        uploadsPath: tempDir,
        filePath: newPath,
        quotaBytes: 12,
      }),
    ).toThrow(UploadQuotaExceededError);
    expect(fs.existsSync(newPath)).toBe(false);
    expect(fs.existsSync(existingPath)).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
