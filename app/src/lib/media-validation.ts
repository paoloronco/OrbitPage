export const RASTER_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';
export const VIDEO_ACCEPT = 'video/mp4,video/webm';
export const DEFAULT_SELF_HOSTED_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const ALLOWED_RASTER_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const isSvgFileName = (name: string | undefined) =>
  Boolean(name?.toLowerCase().endsWith('.svg'));

export function isAllowedRasterImageFile(file: Pick<File, 'name' | 'type'>) {
  if (isSvgFileName(file.name)) return false;
  return ALLOWED_RASTER_IMAGE_TYPES.has(file.type);
}

export function isAllowedVideoFile(file: Pick<File, 'name' | 'type'>) {
  const expectedExtension = VIDEO_EXTENSIONS[file.type];
  return ALLOWED_VIDEO_TYPES.has(file.type)
    && Boolean(expectedExtension)
    && file.name.toLowerCase().endsWith(expectedExtension);
}

export function validateVideoFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  maxBytes = DEFAULT_SELF_HOSTED_VIDEO_MAX_BYTES,
) {
  if (!isAllowedVideoFile(file)) {
    throw new Error('Unsupported video. Use an MP4 or WebM file with the correct extension.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('The selected video is empty or unreadable.');
  }
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`Video files must be ${limitMb} MB or smaller.`);
  }
}
