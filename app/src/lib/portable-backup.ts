import { BACKUP_SECTION_IDS, inspectOrbitPageBackup, prepareSelfHostedRestoreBackup } from './hosted-backup-import';

export const MAX_PORTABLE_BACKUP_BYTES = 256 * 1024 * 1024;

const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const MAX_IMAGES = 500;

export type PortableImage = {
  path: string;
  bytes: Uint8Array;
  reference?: string;
};

type JsonRecord = Record<string, unknown>;

function safeImagePath(value: string) {
  const path = value;
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || /^[a-z]:/i.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..') || !IMAGE_EXTENSION.test(path)) {
    throw new Error(`Invalid backup image path: ${value}`);
  }
  return path;
}

function replaceReferences(value: unknown, replacements: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object') return JSON.stringify(replaceReferences(parsed, replacements));
    } catch {
      // Most media fields are URLs, not serialized JSON.
    }
    for (const [source, destination] of replacements) {
      if (value === source) return destination;
      try {
        const pathname = decodeURIComponent(new URL(value, 'https://portable.invalid').pathname);
        if (pathname.includes(source)) return destination;
      } catch {
        // Leave non-URL content unchanged.
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceReferences(entry, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceReferences(entry, replacements)]));
  }
  return value;
}

function bytesFromBase64(value: string) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64FromBytes(value: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
  }
  return globalThis.btoa(binary);
}

export function embeddedBackupImages(backup: unknown): PortableImage[] {
  if (!backup || typeof backup !== 'object' || !Array.isArray((backup as JsonRecord).uploads)) return [];
  return ((backup as JsonRecord).uploads as unknown[]).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { path, data } = entry as JsonRecord;
    if (typeof path !== 'string' || typeof data !== 'string' || !IMAGE_EXTENSION.test(path)) return [];
    return [{ path: safeImagePath(path), bytes: bytesFromBase64(data) }];
  });
}

export async function createPortableBackupArchive(input: unknown, images: readonly PortableImage[]) {
  if (images.length === 0) throw new Error('This backup has no images to include.');
  if (images.length > MAX_IMAGES) throw new Error(`A portable backup can contain at most ${MAX_IMAGES} images.`);

  const source = inspectOrbitPageBackup(input).source;
  const paths = new Set<string>();
  const normalized = images.map((image, index) => {
    const sourcePath = safeImagePath(image.path);
    const path = source === 'managed'
      ? `portable/${index + 1}-${sourcePath.split('/').at(-1)}`
      : sourcePath;
    const collisionKey = path.toLowerCase();
    if (paths.has(collisionKey)) throw new Error(`Duplicate backup image path: ${path}`);
    paths.add(collisionKey);
    return { ...image, path };
  });
  const totalBytes = normalized.reduce((total, image) => total + image.bytes.byteLength, 0);
  if (totalBytes > MAX_PORTABLE_BACKUP_BYTES) throw new Error('Backup images exceed the portable backup size limit.');

  const replacements = new Map(normalized
    .flatMap((image) => image.reference ? [[image.reference, `/uploads/${image.path}`] as const] : [])
    .sort(([left], [right]) => right.length - left.length));
  const rewritten = replacements.size ? replaceReferences(input, replacements) : input;
  const restored = prepareSelfHostedRestoreBackup(rewritten) as JsonRecord;
  const sections = inspectOrbitPageBackup(restored).sections;
  const portableBackup = {
    ...restored,
    schemaVersion: 2,
    includedSections: [...new Set([...sections, 'media'])].filter((section) => BACKUP_SECTION_IDS.includes(section)),
    uploads: [],
  };
  const backupJson = JSON.stringify(portableBackup, null, 2);
  if (totalBytes + new TextEncoder().encode(backupJson).byteLength > MAX_PORTABLE_BACKUP_BYTES) {
    throw new Error('Portable backup exceeds the size limit.');
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('backup.json', backupJson);
  for (const image of normalized) zip.file(`uploads/${image.path}`, image.bytes);
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
}

export async function readPortableBackupArchive(input: Blob | ArrayBuffer | Uint8Array) {
  const { default: JSZip } = await import('jszip');
  const source = input instanceof Blob ? await input.arrayBuffer() : input;
  const zip = await JSZip.loadAsync(source);
  const backupEntry = zip.file('backup.json');
  if (!backupEntry) throw new Error('Portable backup is missing backup.json.');

  const declaredBytes = Object.values(zip.files).reduce((total, entry) => {
    const size = (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0;
    return total + size;
  }, 0);
  if (declaredBytes > MAX_PORTABLE_BACKUP_BYTES) throw new Error('Portable backup exceeds the size limit.');

  const backupText = await backupEntry.async('string');
  let backup: JsonRecord;
  try {
    backup = JSON.parse(backupText) as JsonRecord;
  } catch {
    throw new Error('Portable backup contains an invalid backup.json file.');
  }
  if (inspectOrbitPageBackup(backup).source !== 'self-hosted') {
    throw new Error('Portable backup.json must use the self-hosted backup format.');
  }

  const imageEntries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith('uploads/'));
  if (imageEntries.length === 0) throw new Error('Portable backup contains no images.');
  if (imageEntries.length > MAX_IMAGES) throw new Error(`A portable backup can contain at most ${MAX_IMAGES} images.`);

  const uploads: Array<{ path: string; data: string }> = [];
  const paths = new Set<string>();
  let totalBytes = new TextEncoder().encode(backupText).byteLength;
  for (const entry of imageEntries) {
    const originalName = entry.unsafeOriginalName || entry.name;
    if (!originalName.startsWith('uploads/')) throw new Error('Portable backup contains an unsafe image path.');
    const path = safeImagePath(originalName.slice('uploads/'.length));
    const collisionKey = path.toLowerCase();
    if (paths.has(collisionKey)) throw new Error(`Duplicate backup image path: ${path}`);
    paths.add(collisionKey);
    const bytes = await entry.async('uint8array');
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_PORTABLE_BACKUP_BYTES) throw new Error('Portable backup exceeds the size limit.');
    uploads.push({ path, data: base64FromBytes(bytes) });
  }

  const sections = inspectOrbitPageBackup(backup).sections;
  return {
    ...backup,
    schemaVersion: 2,
    includedSections: [...new Set([...sections, 'media'])],
    uploads,
  };
}
