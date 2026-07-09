import path from 'path';
import { randomUUID } from 'crypto';

export const UPLOAD_FILE_MODE = 0o644;

export function createUploadFilename(prefix, originalName) {
  const normalizedPrefix = prefix === 'bg' ? 'bg' : 'img';
  const extension = path.extname(originalName || '').toLowerCase();

  return `${normalizedPrefix}-${Date.now()}-${randomUUID()}${extension}`;
}
