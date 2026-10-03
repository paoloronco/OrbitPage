import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = path.resolve(process.env.DATA_DIR || serverDir);
export const databasePath = path.join(dataDir, 'orbitpage.db');
export const uploadsPath = path.join(dataDir, 'uploads');
const configPath = path.join(dataDir, '.instance-env.json');

export const editableEnvironment = [
  { key: 'PUBLIC_SITE_URL', label: 'Public site URL' },
  { key: 'PUBLIC_SITE_NAME', label: 'Public site name' },
  { key: 'SEO_INDEXING', label: 'Search indexing' },
  { key: 'UPLOAD_STORAGE_QUOTA_MB', label: 'Upload quota (MB)' },
  { key: 'VIDEO_UPLOAD_LIMIT_MB', label: 'Video upload limit (MB)' },
  { key: 'MEDIA_CLEANUP_ENABLED', label: 'Automatic media cleanup' },
  { key: 'TZ', label: 'Default timezone' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API key' },
];
const allowedKeys = new Set(editableEnvironment.map(({ key }) => key));

function readOverrides() {
  try {
    if (fs.lstatSync(configPath).isSymbolicLink()) throw new Error('Configuration file must not be a symlink.');
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!parsed || parsed.version !== 1 || !parsed.overrides || typeof parsed.overrides !== 'object' || Array.isArray(parsed.overrides)) throw new Error('Invalid instance configuration.');
    return Object.fromEntries(Object.entries(parsed.overrides).filter(([key, value]) => allowedKeys.has(key) && typeof value === 'string'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error('Could not read instance configuration.');
  }
}

// This module is imported before the server's other dependencies. Persisted
// overrides must be present before startup-time environment reads take place.
const inheritedEnvironment = Object.fromEntries(editableEnvironment.map(({ key }) => [key, process.env[key] || '']));
const startupOverrides = readOverrides();
for (const [key, value] of Object.entries(startupOverrides)) process.env[key] = value;

export function environmentSummary() {
  const overrides = readOverrides();
  return editableEnvironment.map(({ key, label }) => ({
    key, label, configured: Object.hasOwn(overrides, key) || Boolean(inheritedEnvironment[key]), overridden: Object.hasOwn(overrides, key),
  }));
}

function validateValue(key, value) {
  if (!allowedKeys.has(key) || typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\r\n\0]/.test(value)) return false;
  const text = value.trim();
  if (key === 'PUBLIC_SITE_URL') {
    try { const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; }
    catch { return false; }
  }
  if (key === 'SEO_INDEXING' || key === 'MEDIA_CLEANUP_ENABLED') return ['true', 'false'].includes(text);
  if (key === 'UPLOAD_STORAGE_QUOTA_MB' || key === 'VIDEO_UPLOAD_LIMIT_MB') return /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= 102400;
  if (key === 'TZ') { try { new Intl.DateTimeFormat('en', { timeZone: text }); return true; } catch { return false; } }
  if (key === 'PUBLIC_SITE_NAME') return text.length <= 100;
  return true;
}

export async function saveEnvironmentChanges(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length || Object.keys(changes).length > allowedKeys.size) throw new Error('Invalid environment changes.');
  for (const [key, value] of Object.entries(changes)) {
    if (!allowedKeys.has(key) || (value !== null && !validateValue(key, value))) throw new Error(`Invalid value for ${key}.`);
  }
  const overrides = readOverrides();
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete overrides[key];
    else overrides[key] = value.trim();
  }
  await fs.promises.mkdir(dataDir, { recursive: true });
  const tempPath = `${configPath}.${randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(tempPath, JSON.stringify({ version: 1, overrides }), { mode: 0o600, flag: 'wx' });
    await fs.promises.rename(tempPath, configPath);
    await fs.promises.chmod(configPath, 0o600);
  } finally { await fs.promises.rm(tempPath, { force: true }).catch(() => undefined); }
  return environmentSummary();
}

async function directoryBytes(root) {
  let bytes = 0;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try { entries = await fs.promises.readdir(current, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      const item = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(item);
      else if (entry.isFile()) bytes += (await fs.promises.stat(item)).size;
    }
  }
  return bytes;
}

export async function storageUsage() {
  const [usedBytes, uploadBytes] = await Promise.all([directoryBytes(dataDir), directoryBytes(uploadsPath)]);
  return { usedBytes, uploadBytes, measuredAt: new Date().toISOString() };
}

export async function writableDirectory(directory) {
  try { await fs.promises.access(directory, fs.constants.R_OK | fs.constants.W_OK); return true; }
  catch { return false; }
}
