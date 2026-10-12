import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'orbitpage-transaction-'));
process.env.DATA_DIR = dataDir;
let database;

beforeAll(async () => {
  database = await import('./database.js');
  await database.dbRun(`CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL CHECK (event IN ('view', 'click')),
    visitor_id TEXT, link_id TEXT, source TEXT, device TEXT, path TEXT,
    utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await database.dbRun("INSERT INTO analytics_events (event, visitor_id) VALUES ('view', 'fictional-legacy')");
  await database.initializeDatabase();
  await database.dbRun('CREATE TABLE transaction_check (value TEXT)');
});

it('migrates legacy analytics without losing views and deduplicates new page sessions', async () => {
  expect(await database.dbGet("SELECT visitor_id, duration_seconds, session_id FROM analytics_events WHERE visitor_id = 'fictional-legacy'"))
    .toEqual({ visitor_id: 'fictional-legacy', duration_seconds: 0, session_id: null });
  for (let i = 0; i < 2; i++) await database.dbRun("INSERT OR IGNORE INTO analytics_events (event, visitor_id, session_id) VALUES ('view', 'fictional-new', 'fictional-session')");
  expect((await database.dbGet("SELECT COUNT(*) AS visits FROM analytics_events WHERE visitor_id = 'fictional-new'")).visits).toBe(1);
});

afterAll(async () => {
  if (database) await new Promise((resolve) => database.default.close(resolve));
  rmSync(dataDir, { recursive: true, force: true });
});

it('keeps overlapping transactions on separate connections', async () => {
  let releaseFirst;
  let firstInserted;
  const firstReady = new Promise((resolve) => { firstInserted = resolve; });
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const first = database.withTransaction(async () => {
    await database.dbRun('INSERT INTO transaction_check (value) VALUES (?)', ['first']);
    firstInserted();
    await firstGate;
  });
  await firstReady;
  const second = database.withTransaction(() => database.dbRun('INSERT INTO transaction_check (value) VALUES (?)', ['second']));
  releaseFirst();
  await Promise.all([first, second]);
  expect((await database.dbAll('SELECT value FROM transaction_check ORDER BY rowid')).map((row) => row.value))
    .toEqual(['first', 'second']);
});
