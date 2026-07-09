import { describe, expect, it } from 'vitest';

import { isAllowedRasterImageFile } from './media-validation';

describe('media validation', () => {
  it('allows common raster image files', () => {
    expect(isAllowedRasterImageFile({ name: 'avatar.webp', type: 'image/webp' })).toBe(true);
    expect(isAllowedRasterImageFile({ name: 'cover.png', type: 'image/png' })).toBe(true);
  });

  it('rejects svg files even when the browser provides an image MIME type', () => {
    expect(isAllowedRasterImageFile({ name: 'icon.svg', type: 'image/svg+xml' })).toBe(false);
    expect(isAllowedRasterImageFile({ name: 'icon.svg', type: 'image/png' })).toBe(false);
  });
});
