import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describeSignInDevice } from '../../packages/sign-in-device.js';

const dataDir = mkdtempSync(join(tmpdir(), 'orbitpage-sign-ins-'));
process.env.DATA_DIR = dataDir;
let database;
let history;

beforeAll(async () => {
  database = await import('../database.js');
  await database.initializeDatabase();
  history = await import('./sign-ins.js');
  for (const username of ['owner', 'viewer']) await database.dbRun('INSERT INTO admin_users (username, password_hash, salt) VALUES (?, ?, ?)', [username, 'fixture', 'fixture']);
});
afterAll(async () => {
  if (database) await new Promise((resolve) => database.default.close(resolve));
  rmSync(dataDir, { recursive: true, force: true });
});

it('keeps only the last twenty sign-ins for the authenticated identity and cascades account removal', async () => {
  await history.recordSignIn('viewer', 'password+totp', 'Firefox/140.0 (Linux)');
  for (let index = 0; index < 23; index++) await history.recordSignIn('owner', 'password', 'Chrome/140.0 (Windows)');
  const owner = await history.listSignIns('owner');
  expect(owner.events).toHaveLength(20);
  expect(owner.events[0].id).toBeGreaterThan(owner.events[19].id);
  expect(owner.events.every((event) => event.method === 'password' && event.device === 'Chrome · Windows')).toBe(true);
  expect((await history.listSignIns('viewer')).events).toHaveLength(1);
  expect((await history.listSignIns("owner' OR 1=1 --")).events).toHaveLength(0);
  await database.dbRun('DELETE FROM admin_users WHERE username = ?', ['viewer']);
  expect((await database.dbGet('SELECT COUNT(*) AS count FROM account_sign_ins')).count).toBe(20);
});

it('stores coarse browser labels and leaves unknown devices unspecified', () => {
  expect(describeSignInDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('Edge · Windows');
  expect(describeSignInDevice('Mozilla/5.0 (iPhone) Version/18.0 Mobile/15 Safari/604.1')).toBe('Safari · iOS');
  expect(describeSignInDevice('fictional-client')).toBe('');
});
