import fs from 'fs';
import path from 'path';

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_TABLES = [
  'admin_users',
  'profile_data',
  'links',
  'theme_config',
  'cookie_consent_config',
];

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeIdentifier(identifier) {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Unsafe backup identifier: ${identifier}`);
  }
}

function readUploadFiles(uploadsPath, currentPath = uploadsPath) {
  if (!fs.existsSync(currentPath)) {
    return [];
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  const uploads = [];

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      uploads.push(...readUploadFiles(uploadsPath, fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = path.relative(uploadsPath, fullPath).split(path.sep).join('/');
    uploads.push({
      path: relativePath,
      data: fs.readFileSync(fullPath).toString('base64'),
    });
  }

  return uploads.sort((a, b) => a.path.localeCompare(b.path));
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

function normalizeBackupPayload(backup) {
  if (!backup || backup.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('Unsupported backup schema version');
  }

  const tables = backup.tables && typeof backup.tables === 'object' ? backup.tables : {};
  const uploads = Array.isArray(backup.uploads) ? backup.uploads : [];

  return {
    tables,
    uploads: uploads.map((entry) => ({
      path: normalizeBackupUploadPath(entry?.path),
      data: String(entry?.data || ''),
    })),
  };
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

function replaceUploads({ uploadsPath, uploads }) {
  fs.rmSync(uploadsPath, { recursive: true, force: true });
  fs.mkdirSync(uploadsPath, { recursive: true });

  for (const upload of uploads) {
    const destination = path.resolve(uploadsPath, ...upload.path.split('/'));
    const uploadsRoot = path.resolve(uploadsPath);

    if (!destination.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new Error('Unsafe backup upload path');
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(upload.data, 'base64'));
  }
}

export async function createApplicationBackup({ appVersion, dbAll, uploadsPath }) {
  const tables = {};

  for (const tableName of BACKUP_TABLES) {
    tables[tableName] = await dbAll(`SELECT * FROM ${tableName}`);
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    createdAt: new Date().toISOString(),
    tables,
    uploads: readUploadFiles(uploadsPath),
  };
}

export async function restoreApplicationBackup({ backup, dbRun, uploadsPath }) {
  const normalizedBackup = normalizeBackupPayload(backup);

  await dbRun('PRAGMA foreign_keys = OFF');

  for (const tableName of BACKUP_TABLES) {
    await dbRun(`DELETE FROM ${tableName}`);
  }

  for (const tableName of BACKUP_TABLES) {
    const rows = Array.isArray(normalizedBackup.tables[tableName])
      ? normalizedBackup.tables[tableName]
      : [];

    await insertRows({ dbRun, tableName, rows });
  }

  await dbRun('PRAGMA foreign_keys = ON');
  replaceUploads({ uploadsPath, uploads: normalizedBackup.uploads });
}
