import fs from 'fs';
import path from 'path';

export const BACKUP_SCHEMA_VERSION = 1;
export const SELECTIVE_BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_TABLES = [
  'admin_users',
  'profile_data',
  'links',
  'theme_config',
  'cookie_consent_config',
  'text_files',
  'sitemap_config',
];
export const BACKUP_SECTIONS = [
  'profile',
  'links',
  'theme',
  'privacy',
  'discovery',
  'accounts',
  'media',
];

const SECTION_TABLES = {
  profile: ['profile_data'],
  links: ['links'],
  theme: ['theme_config'],
  privacy: ['cookie_consent_config'],
  discovery: ['text_files', 'sitemap_config'],
  accounts: ['admin_users'],
  media: [],
};

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
    ? [...BACKUP_SECTIONS]
    : normalizeBackupSections(backup.includedSections, []);

  if (schemaVersion === SELECTIVE_BACKUP_SCHEMA_VERSION) {
    const includedTables = tablesForSections(availableSections);
    for (const tableName of includedTables) {
      if (!Array.isArray(tables[tableName])) {
        throw new Error(`Backup section is incomplete: ${tableName}`);
      }
    }
    if (availableSections.includes('media') && !Array.isArray(backup.uploads)) {
      throw new Error('Backup section is incomplete: media');
    }
  }

  return {
    tables,
    uploads: uploads.map((entry) => ({
      path: normalizeBackupUploadPath(entry?.path),
      data: String(entry?.data || ''),
    })),
    availableSections,
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
  return {
    schemaVersion: isComplete ? BACKUP_SCHEMA_VERSION : SELECTIVE_BACKUP_SCHEMA_VERSION,
    appVersion,
    createdAt: new Date().toISOString(),
    ...(!isComplete ? { includedSections: sections } : {}),
    tables,
    uploads: sections.includes('media') ? readUploadFiles(uploadsPath) : [],
  };
}

export async function restoreApplicationBackup({ backup, dbRun, uploadsPath, sections: requestedSections }) {
  const normalizedBackup = normalizeBackupPayload(backup);
  const sections = normalizeBackupSections(requestedSections, normalizedBackup.availableSections);
  const unavailable = sections.find((section) => !normalizedBackup.availableSections.includes(section));
  if (unavailable) throw new Error(`Backup does not contain section: ${unavailable}`);
  const includedTables = tablesForSections(sections);

  await dbRun('PRAGMA foreign_keys = OFF');
  try {
    for (const tableName of BACKUP_TABLES) {
      if (includedTables.has(tableName)) await dbRun(`DELETE FROM ${tableName}`);
    }

    for (const tableName of BACKUP_TABLES) {
      if (!includedTables.has(tableName)) continue;
      const rows = Array.isArray(normalizedBackup.tables[tableName])
        ? normalizedBackup.tables[tableName]
        : [];

      await insertRows({ dbRun, tableName, rows });
    }

    if (sections.includes('media')) {
      replaceUploads({ uploadsPath, uploads: normalizedBackup.uploads });
    }
  } finally {
    await dbRun('PRAGMA foreign_keys = ON');
  }
}
