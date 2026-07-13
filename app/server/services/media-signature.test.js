import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { assertUploadedMediaSignature, detectUploadedMediaType } from './media-signature.js';

function withTempFile(bytes, run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpage-media-'));
  const filePath = path.join(directory, 'upload.bin');
  fs.writeFileSync(filePath, Buffer.from(bytes));
  try {
    return run(filePath);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe('uploaded media signatures', () => {
  it('detects MP4 and WebM containers from binary headers', () => {
    withTempFile([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], (filePath) => {
      expect(detectUploadedMediaType(filePath)).toBe('video/mp4');
    });
    withTempFile([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81], (filePath) => {
      expect(detectUploadedMediaType(filePath)).toBe('video/webm');
    });
  });

  it('rejects content whose signature does not match its MIME type', () => {
    withTempFile(Buffer.from('not a video'), (filePath) => {
      expect(() => assertUploadedMediaSignature({ filePath, contentType: 'video/mp4' })).toThrow('does not match');
    });
  });
});
