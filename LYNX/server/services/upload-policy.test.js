import { describe, expect, it } from 'vitest';
import {
  UPLOAD_FILE_MODE,
  createUploadFilename,
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
});
