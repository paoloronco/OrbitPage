import fs from 'fs';
import path from 'path';

const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000;
const UPLOAD_REFERENCE_PATTERN = /(?:https?:\/\/[^\s"'<>]+)?\/uploads\/([^\s"'<>?#)]+)/gi;

function normalizeRelativeUploadPath(value) {
  try {
    const decoded = decodeURIComponent(String(value || '')).replace(/\\/g, '/').replace(/^\/+/, '');
    const normalized = path.posix.normalize(decoded);
    if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function collectUploadReferences(value) {
  const references = new Set();
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  for (const match of text.matchAll(UPLOAD_REFERENCE_PATTERN)) {
    const normalized = normalizeRelativeUploadPath(match[1]);
    if (normalized) references.add(normalized);
  }
  return references;
}

async function collectDatabaseReferences(dbAll) {
  const references = new Set();
  const tables = await dbAll("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  for (const { name } of tables) {
    if (typeof name !== 'string') continue;
    const safeName = name.replace(/"/g, '""');
    const rows = await dbAll(`SELECT * FROM "${safeName}"`);
    for (const row of rows) {
      for (const reference of collectUploadReferences(row)) references.add(reference);
    }
  }
  return references;
}

async function listFiles(root, current = root) {
  let entries;
  try {
    entries = await fs.promises.readdir(current, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function removeEmptyDirectories(root, current = root) {
  let entries;
  try {
    entries = await fs.promises.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) await removeEmptyDirectories(root, path.join(current, entry.name));
  }
  if (current !== root && (await fs.promises.readdir(current)).length === 0) await fs.promises.rmdir(current);
}

export async function cleanupUnusedMedia({
  dbAll,
  uploadsPath,
  dryRun = true,
  graceMs = DEFAULT_GRACE_MS,
  nowMs = Date.now(),
}) {
  const root = path.resolve(uploadsPath);
  const references = await collectDatabaseReferences(dbAll);
  const files = await listFiles(root);
  const report = {
    dryRun,
    scanned: files.length,
    referenced: 0,
    skippedRecent: 0,
    unused: 0,
    deleted: 0,
    reclaimableBytes: 0,
    reclaimedBytes: 0,
    candidates: [],
  };

  for (const absolute of files) {
    const resolved = path.resolve(absolute);
    if (!resolved.startsWith(`${root}${path.sep}`)) continue;
    const relative = path.relative(root, resolved).split(path.sep).join('/');
    if (references.has(relative)) {
      report.referenced += 1;
      continue;
    }
    const stats = await fs.promises.stat(resolved);
    if (nowMs - stats.mtimeMs < Math.max(0, graceMs)) {
      report.skippedRecent += 1;
      continue;
    }
    report.unused += 1;
    report.reclaimableBytes += stats.size;
    if (report.candidates.length < 50) report.candidates.push({ path: relative, sizeBytes: stats.size });
    if (!dryRun) {
      await fs.promises.unlink(resolved);
      report.deleted += 1;
      report.reclaimedBytes += stats.size;
    }
  }

  if (!dryRun) await removeEmptyDirectories(root);
  return report;
}

export function mediaCleanupGraceMs(env = process.env) {
  const hours = Number(env.MEDIA_CLEANUP_GRACE_HOURS || 24);
  const boundedHours = Number.isFinite(hours) ? Math.min(720, Math.max(1, hours)) : 24;
  return boundedHours * 60 * 60 * 1000;
}
