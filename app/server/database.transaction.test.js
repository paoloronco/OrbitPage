import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'orbitpage-transaction-'));
process.env.DATA_DIR = dataDir;
let database;

beforeAll(async () => {
  database = await import('./database.js');
  await database.initializeDatabase();
  await database.dbRun('CREATE TABLE transaction_check (value TEXT)');
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
