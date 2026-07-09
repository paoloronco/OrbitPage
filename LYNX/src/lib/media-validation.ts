export const RASTER_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

const ALLOWED_RASTER_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const isSvgFileName = (name: string | undefined) =>
  Boolean(name?.toLowerCase().endsWith('.svg'));

export function isAllowedRasterImageFile(file: Pick<File, 'name' | 'type'>) {
  if (isSvgFileName(file.name)) return false;
  return ALLOWED_RASTER_IMAGE_TYPES.has(file.type);
}
