import fs from 'fs';
import path from 'path';
import { quarantineRestoredPrivacy } from './privacy-restore.js';
import { validateShopFile, matchesShopFileSignature } from '../../packages/shop/files.js';

export const SHOP_BACKUP_TABLES = ['shop_settings', 'shop_products', 'shop_files', 'shop_orders', 'shop_customers', 'shop_bookings', 'shop_events', 'shop_emails'];

export const BACKUP_SCHEMA_VERSION = 1;
export const SELECTIVE_BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_TABLES = [
  'admin_users',
  'profile_data',
  'links',
  'theme_config',
  'menu_config',
  'subpages_config',
  'campaign_links',
  'cookie_consent_config',
  'text_files',
  'sitemap_config',
  ...SHOP_BACKUP_TABLES,
];
export const BACKUP_SECTIONS = [
  'profile',
  'links',
  'pages',
  'theme',
  'menu',
  'privacy',
  'discovery',
  'accounts',
  'media',
  'shop',
];

const SECTION_TABLES = {
  profile: ['profile_data'],
  links: ['links', 'campaign_links'],
  pages: ['subpages_config'],
  theme: ['theme_config'],
  menu: ['menu_config'],
  privacy: ['cookie_consent_config'],
  discovery: ['text_files', 'sitemap_config'],
  accounts: ['admin_users'],
  media: [],
  shop: SHOP_BACKUP_TABLES,
};

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_BACKUP_MEDIA_LIMIT_BYTES = 128 * 1024 * 1024;
const ALLOWED_MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.mp4', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const OPTIONAL_COMPAT_TABLES = new Set(['campaign_links']);

const backupMediaLimitBytes = () => {
  const configuredMb = Number(process.env.ORBITPAGE_BACKUP_MEDIA_LIMIT_MB);
  return Number.isFinite(configuredMb) && configuredMb > 0
    ? Math.floor(configuredMb * 1024 * 1024)
    : DEFAULT_BACKUP_MEDIA_LIMIT_BYTES;
};

const isAllowedMediaSignature = (extension, buffer) => {
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === '.jpg' || extension === '.jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (extension === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (extension === '.avif') return buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    && [buffer.subarray(8, 12), ...Array.from({ length: Math.floor((buffer.length - 16) / 4) }, (_, index) => buffer.subarray(16 + index * 4, 20 + index * 4))]
      .some((brand) => ['avif', 'avis'].includes(brand.toString('ascii')));
  if (extension === '.mp4') return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  if (extension === '.webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
};

const decodeBackupMedia = (upload) => {
  const extension = path.posix.extname(upload.path).toLowerCase();
  if (!ALLOWED_MEDIA_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported backup media type: ${upload.path}`);
  }
  const encoded = String(upload.data || '');
  if (!encoded || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error(`Invalid base64 backup media: ${upload.path}`);
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (!isAllowedMediaSignature(extension, buffer)) {
    throw new Error(`Backup media content does not match its extension: ${upload.path}`);
  }
  return buffer;
};

function assertSafeIdentifier(identifier) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Unsafe backup identifier: ${identifier}`);
  }
}

function readUploadFiles(uploadsPath, currentPath = uploadsPath, state = { bytes: 0 }) {
  if (!fs.existsSync(currentPath)) {
    return [];
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  const uploads = [];

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      uploads.push(...readUploadFiles(uploadsPath, fullPath, state));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(uploadsPath, fullPath).split(path.sep).join('/');
    state.bytes += fs.statSync(fullPath).size;
    if (state.bytes > backupMediaLimitBytes()) {
      throw new Error('Backup media exceeds the configured size limit');
    }
    uploads.push({
      path: relativePath,
      data: fs.readFileSync(fullPath).toString('base64'),
    });
  }

  return uploads.sort((a, b) => a.path.localeCompare(b.path));
}

function collectBackupImages(uploadsPath, currentPath, includeData, state) {
  if (!fs.existsSync(currentPath)) return [];
  return fs.readdirSync(currentPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) return collectBackupImages(uploadsPath, fullPath, includeData, state);
    if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return [];
    const sizeBytes = fs.statSync(fullPath).size;
    if (includeData) {
      state.bytes += sizeBytes;
      if (state.bytes > backupMediaLimitBytes()) throw new Error('Backup images exceed the configured size limit');
    }
    return [{
      path: path.relative(uploadsPath, fullPath).split(path.sep).join('/'),
      sizeBytes,
      ...(includeData ? { data: fs.readFileSync(fullPath).toString('base64') } : {}),
    }];
  });
}

export function listBackupImages(uploadsPath, { includeData = false } = {}) {
  return collectBackupImages(uploadsPath, uploadsPath, includeData, { bytes: 0 })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeBackupUploadPath(uploadPath) {
  if (typeof uploadPath !== 'string' || !uploadPath.trim()) {
    throw new Error('Unsafe backup upload path');
  }

  if (path.isAbsolute(uploadPath) || uploadPath.includes('\\')) {
    throw new Error('Unsafe backup upload path');
  }

  const normalized = path.posix.normalize(uploadPath);
  if (normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('Unsafe backup upload path');
  }

  return normalized;
}

export function normalizeBackupSections(input, fallback = BACKUP_SECTIONS) {
  if (input === undefined || input === null) return [...fallback];
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Select at least one backup section');
  }

  const sections = [...new Set(input.map((value) => String(value)))];
  const invalid = sections.find((section) => !BACKUP_SECTIONS.includes(section));
  if (invalid) throw new Error(`Unsupported backup section: ${invalid}`);
  return sections;
}

function tablesForSections(sections) {
  return new Set(sections.flatMap((section) => SECTION_TABLES[section]));
}

function normalizeBackupPayload(backup) {
  const schemaVersion = backup?.schemaVersion;
  if (schemaVersion !== BACKUP_SCHEMA_VERSION && schemaVersion !== SELECTIVE_BACKUP_SCHEMA_VERSION) {
    throw new Error('Unsupported backup schema version');
  }

  const tables = backup.tables && typeof backup.tables === 'object' ? backup.tables : {};
  const uploads = Array.isArray(backup.uploads) ? backup.uploads : [];
  if (schemaVersion === SELECTIVE_BACKUP_SCHEMA_VERSION && !Array.isArray(backup.includedSections)) {
    throw new Error('Selective backup is missing its included sections');
  }
  const availableSections = schemaVersion === BACKUP_SCHEMA_VERSION
    ? BACKUP_SECTIONS.filter(section => section !== 'shop' || Array.isArray(tables.shop_settings))
    : normalizeBackupSections(backup.includedSections, []);

  if (schemaVersion === SELECTIVE_BACKUP_SCHEMA_VERSION) {
    const includedTables = tablesForSections(availableSections);
    for (const tableName of includedTables) {
      if (!Array.isArray(tables[tableName]) && !OPTIONAL_COMPAT_TABLES.has(tableName)) {
        throw new Error(`Backup section is incomplete: ${tableName}`);
      }
    }
    if (availableSections.includes('media') && !Array.isArray(backup.uploads)) {
      throw new Error('Backup section is incomplete: media');
    }
  }

  const normalizedUploads = uploads.map((entry) => ({
    path: normalizeBackupUploadPath(entry?.path),
    data: String(entry?.data || ''),
  }));
  const uploadPaths = new Set();
  for (const upload of normalizedUploads) {
    const collisionKey = upload.path.toLowerCase();
    if (uploadPaths.has(collisionKey)) throw new Error(`Duplicate backup upload path: ${upload.path}`);
    uploadPaths.add(collisionKey);
  }

  if (availableSections.includes('shop')) {
    if (!Array.isArray(backup.shopFiles) || SHOP_BACKUP_TABLES.some(table => !Array.isArray(tables[table]))) throw new Error('Backup section is incomplete: shop');
    const ids = new Set();
    for (const file of backup.shopFiles) {
      if (!/^[a-f0-9]{64}$/.test(file?.path) || ids.has(file.path)) throw new Error('Unsafe or duplicate Shop backup file');
      ids.add(file.path);
    }
    for (const row of tables.shop_files) if (!ids.has(row.id)) throw new Error('Shop backup is missing a private file');
  }
  return { tables, uploads: normalizedUploads, shopFiles: backup.shopFiles || [], availableSections };
}

async function insertRows({ dbRun, tableName, rows }) {
  assertSafeIdentifier(tableName);

  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) {
      continue;
    }

    columns.forEach(assertSafeIdentifier);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    await dbRun(sql, columns.map((column) => row[column]));
  }
}

export function stageUploads({ uploadsPath, uploads, decodeFile = decodeBackupMedia }) {
  const resolvedUploadsPath = path.resolve(uploadsPath);
  const parentPath = path.dirname(resolvedUploadsPath);
  fs.mkdirSync(parentPath, { recursive: true });
  const stagingPath = fs.mkdtempSync(path.join(parentPath, `.${path.basename(resolvedUploadsPath)}-restore-`));
  let previousPath = null;
  let activated = false;
  let totalBytes = 0;

  try {
    for (const upload of uploads) {
      const encodedLength = String(upload.data || '').length;
      const estimatedBytes = Math.floor((encodedLength * 3) / 4);
      if (totalBytes + estimatedBytes > backupMediaLimitBytes()) {
        throw new Error('Backup media exceeds the configured size limit');
      }
      const buffer = decodeFile(upload);
      totalBytes += buffer.length;
      if (totalBytes > backupMediaLimitBytes()) throw new Error('Backup media exceeds the configured size limit');
      const destination = path.resolve(stagingPath, ...upload.path.split('/'));

      if (!destination.startsWith(`${stagingPath}${path.sep}`)) throw new Error('Unsafe backup upload path');

      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, buffer, { mode: 0o600 });
    }
  } catch (error) {
    fs.rmSync(stagingPath, { recursive: true, force: true });
    throw error;
  }

  return {
    activate() {
      if (activated) return;
      if (fs.existsSync(resolvedUploadsPath)) {
        previousPath = `${stagingPath}-previous`;
        fs.renameSync(resolvedUploadsPath, previousPath);
      }
      try {
        fs.renameSync(stagingPath, resolvedUploadsPath);
        activated = true;
      } catch (error) {
        if (previousPath && fs.existsSync(previousPath)) fs.renameSync(previousPath, resolvedUploadsPath);
        previousPath = null;
        throw error;
      }
    },
    rollback() {
      if (activated && fs.existsSync(resolvedUploadsPath)) fs.rmSync(resolvedUploadsPath, { recursive: true, force: true });
      if (previousPath && fs.existsSync(previousPath)) fs.renameSync(previousPath, resolvedUploadsPath);
      if (fs.existsSync(stagingPath)) fs.rmSync(stagingPath, { recursive: true, force: true });
      activated = false;
      previousPath = null;
    },
    finalize() {
      if (previousPath && fs.existsSync(previousPath)) fs.rmSync(previousPath, { recursive: true, force: true });
      if (fs.existsSync(stagingPath)) fs.rmSync(stagingPath, { recursive: true, force: true });
      previousPath = null;
    },
  };
}

function decodeShopBackupFile(file) {
  if (!/^[a-f0-9]{64}$/.test(file.path) || typeof file.data !== 'string' || file.data.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw new Error('Invalid Shop backup file');
  const buffer = Buffer.from(file.data, 'base64');
  validateShopFile({ filename: file.path, contentType: file.contentType, sizeBytes: buffer.length, maximumBytes: 50 * 1024 * 1024 });
  if (!matchesShopFileSignature(file.contentType, buffer.subarray(0, 32))) throw new Error('Invalid Shop backup file content');
  return buffer;
}
export const stageShopFiles = (shopFilesPath, files = []) => stageUploads({ uploadsPath: shopFilesPath, uploads: files, decodeFile: decodeShopBackupFile });

export async function createApplicationBackup({ appVersion, dbAll, uploadsPath, sections: requestedSections }) {
  const sections = normalizeBackupSections(requestedSections);
  const includedTables = tablesForSections(sections);
  const tables = {};

  for (const tableName of BACKUP_TABLES) {
    if (includedTables.has(tableName)) {
      tables[tableName] = await dbAll(`SELECT * FROM ${tableName}`);
    }
  }

  const isComplete = BACKUP_SECTIONS.every((section) => sections.includes(section));
  const shopFilesPath = path.join(path.dirname(uploadsPath), 'shop-files');
  let privateBytes = 0;
  const shopFiles = sections.includes('shop') ? tables.shop_files.map(row => {
    if (!/^[a-f0-9]{64}$/.test(row.id)) throw new Error('Invalid Shop file identifier');
    const data = fs.readFileSync(path.join(shopFilesPath, row.id));
    privateBytes += data.length;
    if (privateBytes > backupMediaLimitBytes()) throw new Error('Shop backup files exceed the configured size limit');
    return { path: row.id, contentType: JSON.parse(row.data).contentType, data: data.toString('base64') };
  }) : [];
  return {
    schemaVersion: isComplete ? BACKUP_SCHEMA_VERSION : SELECTIVE_BACKUP_SCHEMA_VERSION,
    appVersion,
    createdAt: new Date().toISOString(),
    ...(!isComplete ? { includedSections: sections } : {}),
    tables,
    uploads: sections.includes('media') ? readUploadFiles(uploadsPath) : [],
    ...(sections.includes('shop') ? { shopFiles } : {}),
  };
}

export async function restoreApplicationBackup({ backup, dbRun, uploadsPath, sections: requestedSections, deferMediaCommit = false }) {
  const normalizedBackup = normalizeBackupPayload(backup);
  const sections = normalizeBackupSections(requestedSections, normalizedBackup.availableSections);
  const unavailable = sections.find((section) => !normalizedBackup.availableSections.includes(section));
  if (unavailable) throw new Error(`Backup does not contain section: ${unavailable}`);
  const includedTables = tablesForSections(sections);
  const restorableTables = new Set([...includedTables].filter((tableName) => (
    !OPTIONAL_COMPAT_TABLES.has(tableName) || Array.isArray(normalizedBackup.tables[tableName])
  )));
  // Validate before replacing data. Imported review flags never grant trust.
  const privacyRows = restorableTables.has('cookie_consent_config')
    ? (normalizedBackup.tables.cookie_consent_config || []).map(quarantineRestoredPrivacy) : [];
  let mediaRestore = null;
  let shopRestore = null;

  if (sections.includes('media')) {
    mediaRestore = stageUploads({ uploadsPath, uploads: normalizedBackup.uploads });
  }

  try {
    if (sections.includes('shop')) shopRestore = stageShopFiles(path.join(path.dirname(uploadsPath), 'shop-files'), normalizedBackup.shopFiles);
    await dbRun('PRAGMA foreign_keys = OFF');
    if (restorableTables.has('admin_users')) await dbRun('DELETE FROM personal_api_tokens');
    if (sections.includes('shop')) await dbRun('DELETE FROM shop_uploads');
    for (const tableName of BACKUP_TABLES) {
      if (restorableTables.has(tableName)) await dbRun(`DELETE FROM ${tableName}`);
    }

    for (const tableName of BACKUP_TABLES) {
      if (!restorableTables.has(tableName)) continue;
      const rows = tableName === 'cookie_consent_config' ? privacyRows : Array.isArray(normalizedBackup.tables[tableName])
        ? normalizedBackup.tables[tableName]
        : [];

      await insertRows({ dbRun, tableName, rows });
    }

    if (mediaRestore && !deferMediaCommit) {
      mediaRestore.activate();
    }
    await dbRun('PRAGMA foreign_keys = ON');
    if (shopRestore && !deferMediaCommit) shopRestore.activate();
    if (mediaRestore && !deferMediaCommit) mediaRestore.finalize();
    if (shopRestore && !deferMediaCommit) shopRestore.finalize();
    const staged = [mediaRestore, shopRestore].filter(Boolean);
    return { mediaRestore: deferMediaCommit && staged.length ? {
      activate() { for (const files of staged) files.activate(); },
      rollback() { for (const files of [...staged].reverse()) files.rollback(); },
      finalize() { for (const files of staged) files.finalize(); },
    } : null };
  } catch (error) {
    mediaRestore?.rollback();
    shopRestore?.rollback();
    try {
      await dbRun('PRAGMA foreign_keys = ON');
    } catch {
      // Preserve the original restore error.
    }
    throw error;
  }
}
