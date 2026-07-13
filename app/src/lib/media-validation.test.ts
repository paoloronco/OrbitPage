import { describe, expect, it } from 'vitest';

import { isAllowedRasterImageFile, isAllowedVideoFile, validateVideoFile } from './media-validation';

describe('media validation', () => {
  it('allows common raster image files', () => {
    expect(isAllowedRasterImageFile({ name: 'avatar.webp', type: 'image/webp' })).toBe(true);
    expect(isAllowedRasterImageFile({ name: 'cover.png', type: 'image/png' })).toBe(true);
  });

  it('rejects svg files even when the browser provides an image MIME type', () => {
    expect(isAllowedRasterImageFile({ name: 'icon.svg', type: 'image/svg+xml' })).toBe(false);
    expect(isAllowedRasterImageFile({ name: 'icon.svg', type: 'image/png' })).toBe(false);
  });

  it('requires matching MP4 or WebM extensions and MIME types', () => {
    expect(isAllowedVideoFile({ name: 'intro.mp4', type: 'video/mp4' })).toBe(true);
    expect(isAllowedVideoFile({ name: 'intro.webm', type: 'video/webm' })).toBe(true);
    expect(isAllowedVideoFile({ name: 'intro.exe', type: 'video/mp4' })).toBe(false);
    expect(isAllowedVideoFile({ name: 'intro.mp4', type: 'application/octet-stream' })).toBe(false);
  });

  it('rejects empty and oversized video files before upload', () => {
    const oneMb = 1024 * 1024;
    expect(() => validateVideoFile({ name: 'intro.mp4', type: 'video/mp4', size: 0 }, oneMb)).toThrow('empty');
    expect(() => validateVideoFile({ name: 'intro.mp4', type: 'video/mp4', size: oneMb + 1 }, oneMb)).toThrow('1 MB or smaller');
  });
});
