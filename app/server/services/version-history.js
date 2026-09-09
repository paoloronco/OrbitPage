import { createApplicationBackup, restoreApplicationBackup } from './backup-service.js';

export const VERSION_HISTORY_RETENTION = 25;
const MAX_VERSION_BYTES = 8 * 1024 * 1024;
const VERSION_SECTIONS = ['profile', 'links', 'pages', 'theme', 'menu', 'privacy', 'discovery'];

const revisionFromState = (state) => (
  Number.isSafeInteger(state?.revision) && state.revision >= 0 ? state.revision : 0
);

export async function captureApplicationVersion({ appVersion, dbAll, dbGet, dbRun, uploadsPath }) {
  const state = await dbGet('SELECT revision FROM page_state WHERE id = 1');
  const revision = revisionFromState(state);
  if (await dbGet('SELECT revision FROM page_versions WHERE revision = ?', [revision])) return revision;

  const backup = await createApplicationBackup({
    appVersion,
    dbAll,
    uploadsPath,
    sections: VERSION_SECTIONS,
  });
  const snapshot = JSON.stringify(backup);
  const sizeBytes = Buffer.byteLength(snapshot);
  if (sizeBytes > MAX_VERSION_BYTES) throw new Error('The current page is too large to version.');

  await dbRun(
    'INSERT OR IGNORE INTO page_versions (revision, snapshot, size_bytes, created_at) VALUES (?, ?, ?, ?)',
    [revision, snapshot, sizeBytes, new Date().toISOString()],
  );
  await dbRun(
    `DELETE FROM page_versions
     WHERE revision NOT IN (
       SELECT revision FROM page_versions ORDER BY revision DESC LIMIT ?
     )`,
    [VERSION_HISTORY_RETENTION],
  );
  return revision;
}

export async function listApplicationVersions({ dbAll, dbGet }) {
  const currentRevision = revisionFromState(await dbGet('SELECT revision FROM page_state WHERE id = 1'));
  const rows = await dbAll(
    'SELECT revision, size_bytes, created_at FROM page_versions ORDER BY revision DESC LIMIT ?',
    [VERSION_HISTORY_RETENTION],
  );
  return {
    retention: VERSION_HISTORY_RETENTION,
    currentRevision,
    publishedRevision: currentRevision,
    versions: rows.map((row) => ({
      revision: row.revision,
      lastModified: row.created_at,
      sizeBytes: row.size_bytes,
      current: row.revision === currentRevision,
    })),
  };
}

export async function restoreApplicationVersion({ revision, dbGet, dbRun, uploadsPath }) {
  const row = await dbGet('SELECT snapshot FROM page_versions WHERE revision = ?', [revision]);
  if (!row?.snapshot) throw new Error('This version is not available.');
  let backup;
  try {
    backup = JSON.parse(row.snapshot);
  } catch {
    throw new Error('This version snapshot is invalid.');
  }
  await restoreApplicationBackup({ backup, dbRun, uploadsPath, sections: VERSION_SECTIONS });
}
