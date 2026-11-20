import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateFiles = [
  '.instance-env.json', '.instance-env.json.fixture.tmp', '.setup-token', '.setup-token.fixture.tmp', '.jwt-secret',
  '.env', '.env.local', '.env.production', '.env.production.local',
  'orbitpage.db', 'orbitpage.db-shm', 'orbitpage.db-wal', 'orbitpage.db-journal',
  'orbitpage.db.bak', 'orbitpage.db.bak-wal', 'orbitpage.db.backup', 'orbitpage.DB-journal',
  'page.sqlite', 'page.sqlite-wal', 'page.sqlite.backup', 'page.sqlite3', 'page.sqlite3-shm', 'page.SQLite3.bak',
  'server.log',
];
const privateDirectories = [
  'uploads', 'shop-files', 'orbitpage-data', '.orbitpage-data', 'logs',
  'e2e-data', 'e2e-data-fixture', 'playwright-report', 'test-results', '.playwright-cli',
];
const publicFiles = ['public.txt', 'server.js', '.env.example', '.env.production.example', '.env.template', '.env.production.template'];
const folders = ['', 'server', 'app/server', 'nested/data'];
for (const context of ['', 'app']) {
  const temporary = mkdtempSync(join(tmpdir(), 'orbitpage-docker-context-'));
  try {
    const input = join(temporary, 'input'), output = join(temporary, 'output');
    mkdirSync(input);
    copyFileSync(join(root, context, '.dockerignore'), join(input, '.dockerignore'));
    writeFileSync(join(input, 'Dockerfile'), 'FROM scratch\nCOPY . /\n');
    for (const folder of folders) {
      mkdirSync(join(input, folder), { recursive: true });
      for (const file of privateFiles) writeFileSync(join(input, folder, file), 'synthetic-private-fixture');
      for (const directory of privateDirectories) {
        mkdirSync(join(input, folder, directory), { recursive: true });
        writeFileSync(join(input, folder, directory, 'private.txt'), 'synthetic-private-fixture');
      }
      for (const file of publicFiles) writeFileSync(join(input, folder, file), 'public-control');
    }
    execFileSync('docker', ['build', '--output', `type=local,dest=${output}`, input], { stdio: 'inherit' });
    for (const folder of folders) {
      for (const file of publicFiles) assert(existsSync(join(output, folder, file)), `Ordinary build input must remain available: ${folder}/${file}`);
      for (const entry of [...privateFiles, ...privateDirectories]) {
        assert(!existsSync(join(output, folder, entry)), `${context || 'root'} context leaked ${folder}/${entry}`);
      }
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
console.log('Both Docker contexts exclude nested runtime data and retain source and environment examples.');
