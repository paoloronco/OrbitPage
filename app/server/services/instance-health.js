import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { dbGet } from '../database.js';
import { isStrongJwtSecret } from '../auth.js';
import { dataDir, databasePath, uploadsPath, writableDirectory } from './instance-details.js';

const serverDir = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
let auditCache, auditPending;

// Official Node.js release schedule: https://github.com/nodejs/Release.
export function supportedNode(version, timestamp = Date.now()) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  const end = { 22: '2027-04-30', 24: '2028-04-30', 26: '2029-04-30' }[major];
  return Boolean(end && (major !== 22 || minor >= 12) && timestamp < Date.parse(end));
}

export async function auditDependencies() {
  if (auditCache && Date.now() - auditCache.timestamp < (auditCache.result.status === 'unavailable' ? 60_000 : 15 * 60_000)) return auditCache.result;
  if (auditPending) return auditPending;
  auditPending = (async () => {
    const checkedAt = new Date().toISOString();
    try {
      const inventory = {};
      for (const file of [path.join(serverDir, 'package-lock.json'), path.join(serverDir, '../package-lock.json')]) {
        const lock = await readJson(file);
        if (!lock.packages) throw new Error('Missing dependency inventory');
        for (const [location, pkg] of Object.entries(lock.packages)) {
          if (!location.includes('node_modules/') || pkg.dev || pkg.link || !pkg.version || !pkg.resolved?.startsWith('https://registry.npmjs.org/')) continue;
          const name = pkg.name || location.split('node_modules/').at(-1);
          inventory[name] ||= [];
          if (!inventory[name].includes(pkg.version)) inventory[name].push(pkg.version);
        }
      }
      if (!Object.keys(inventory).length) throw new Error('Empty dependency inventory');
      const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(inventory),
      });
      if (!response.ok) throw new Error('Dependency registry unavailable');
      let text = '', size = 0;
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > 2 * 1024 * 1024) throw new Error('Invalid advisory response');
        text += decoder.decode(chunk, { stream: true });
      }
      text += decoder.decode();
      const advisories = JSON.parse(text), counts = { critical: 0, high: 0, moderate: 0, low: 0 };
      if (!advisories || typeof advisories !== 'object' || Array.isArray(advisories)) throw new Error('Invalid advisories');
      const seen = new Set();
      for (const [name, items] of Object.entries(advisories)) {
        if (!Object.hasOwn(inventory, name) || !Array.isArray(items)) throw new Error('Invalid advisories');
        for (const item of items) {
          if (!Object.hasOwn(counts, item.severity) || !Number.isInteger(item.id)) throw new Error('Invalid advisory');
          if (!seen.has(item.id)) { seen.add(item.id); counts[item.severity]++; }
        }
      }
      return { status: counts.critical || counts.high ? 'error' : seen.size ? 'warning' : 'ok', counts, checkedAt };
    } catch { return { status: 'unavailable', counts: null, checkedAt }; }
  })();
  try {
    const result = await auditPending;
    auditCache = { timestamp: Date.now(), result };
    return result;
  } finally { auditPending = null; }
}

export async function instanceHealth({ secure, securityHeaders }) {
  const check = async (id, inspect, failure = 'error') => {
    try { return { id, status: await inspect() ? 'ok' : failure }; }
    catch { return { id, status: 'unavailable' }; }
  };
  const [pkg, checks, audit] = await Promise.all([
    readJson(path.join(serverDir, 'package.json')).catch(() => ({ version: 'unknown' })),
    Promise.all([
      check('database', async () => (await dbGet('PRAGMA quick_check(1)')).quick_check === 'ok'),
      check('data', () => writableDirectory(dataDir)),
      check('uploads', () => writableDirectory(uploadsPath)),
      check('disk', async () => (await fs.statfs(dataDir)).bavail > 0, 'warning'),
      check('build', async () => {
        await fs.access(path.join(serverDir, '../dist/index.html'), constants.R_OK);
        const html = await fs.readFile(path.join(serverDir, '../dist/index.html'), 'utf8');
        const assets = [...html.matchAll(/(?:src|href)="((?:\.\/|\/)?assets\/[^"\s]+)"/g)];
        if (!assets.length) return false;
        await Promise.all(assets.map(([, asset]) => fs.access(path.join(serverDir, '../dist', asset.replace(/^(\.\/|\/)/, '')), constants.R_OK)));
        const [server, frontend] = await Promise.all([readJson(path.join(serverDir, 'package.json')), readJson(path.join(serverDir, '../package-lock.json'))]);
        return Boolean(server.version && server.version === frontend.version);
      }),
      check('dependencies', async () => {
        const pkg = await readJson(path.join(serverDir, 'package.json'));
        for (const name of Object.keys(pkg.dependencies)) require.resolve(name);
        return true;
      }),
      check('permissions', async () => {
        if (process.platform === 'win32') throw new Error('Verify Windows ACLs manually');
        for (const file of [dataDir, databasePath, path.join(dataDir, '.jwt-secret'), path.join(dataDir, '.instance-env.json')]) {
          let stat;
          try { stat = await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT' && file !== dataDir && file !== databasePath) continue; throw error; }
          if (stat.isSymbolicLink() || (stat.mode & 0o077)) return false;
        }
        return true;
      }, 'warning'),
    ]),
    auditDependencies(),
  ]);
  return {
    version: pkg.version, node: process.version, uptime: Math.floor(process.uptime()), audit,
    checks: [
      { id: 'runtime', status: supportedNode(process.version) ? 'ok' : 'warning' },
      ...checks,
      { id: 'https', status: secure ? 'ok' : 'warning' },
      { id: 'sessionSecret', status: isStrongJwtSecret(process.env.JWT_SECRET) ? 'ok' : 'warning' },
      { id: 'securityHeaders', status: securityHeaders ? 'ok' : 'error' },
      { id: 'vulnerabilities', status: audit.status },
    ],
  };
}
