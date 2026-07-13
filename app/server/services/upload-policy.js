import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';

export const UPLOAD_FILE_MODE = 0o644;
export const DEFAULT_UPLOAD_STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;
export const DEFAULT_VIDEO_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

export class UploadQuotaExceededError extends Error {
  constructor({ quotaBytes, totalBytes }) {
    super('Upload storage quota exceeded');
    this.name = 'UploadQuotaExceededError';
    this.quotaBytes = quotaBytes;
    this.totalBytes = totalBytes;
  }
}

export function createUploadFilename(prefix, originalName) {
  const normalizedPrefix = prefix === 'bg' ? 'bg' : 'img';
  const extension = path.extname(originalName || '').toLowerCase();

  return `${normalizedPrefix}-${Date.now()}-${randomUUID()}${extension}`;
}

export function getUploadStorageQuotaBytes(env = process.env) {
  const value = Number(env.UPLOAD_STORAGE_QUOTA_MB);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_UPLOAD_STORAGE_QUOTA_BYTES;
  }

  return Math.floor(value * 1024 * 1024);
}

export function getVideoUploadLimitBytes(env = process.env) {
  const value = Number(env.VIDEO_UPLOAD_LIMIT_MB);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_VIDEO_UPLOAD_LIMIT_BYTES;
  return Math.floor(value * 1024 * 1024);
}

function getDirectorySizeBytes(directoryPath) {
  let total = 0;

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      total += getDirectorySizeBytes(fullPath);
    } else if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    }
  }

  return total;
}

export function enforceUploadStorageQuota({ uploadsPath, filePath, quotaBytes }) {
  const totalBytes = getDirectorySizeBytes(uploadsPath);

  if (totalBytes <= quotaBytes) {
    return { totalBytes, quotaBytes };
  }

  fs.rmSync(filePath, { force: true });
  throw new UploadQuotaExceededError({ quotaBytes, totalBytes });
}
