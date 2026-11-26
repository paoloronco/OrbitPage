import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const forbidden = (file) => /(?:^|\/)(?:\.local|\.codex-tmp|\.playwright-cli|\.playwright-mcp|node_modules|coverage|playwright-report|test-results|e2e-data(?:[.-][^/]*)?)(?:\/|$)|\.(?:log|tmp|temp|bak|swp|swo)$|^dev\/null$/i.test(file)
  || (/(?:^|\/)(?:\.jwt-secret|\.setup-token|\.instance-env\.json)$|\.(?:db|sqlite3?)(?:$|[-.](?:shm|wal|journal|bak|backup)$)|(?:^|\/)\.env(?:\.[^/]+)?$/i.test(file)
  && !/\.env(?:\.[^/]+)?\.(?:example|template)$|(?:^|\/)\.env\.(?:example|template)$/i.test(file));
for (const file of ['server/lynx.db', 'app/server/orbitpage.db.bak', 'data/page.sqlite-wal', 'data/page.DB-journal', 'app/.env.local', '.jwt-secret']) assert(forbidden(file));
for (const file of ['app/.env.example', 'app/.env.production.example', 'server/db.js', 'docs/wiki/administration/Configuration.md']) assert(!forbidden(file));
for (const file of ['.local/check.mjs', 'app/e2e-data.previous/page.json', 'app/test-results/report.json', 'app/build.log', 'scripts/check.mjs.tmp', 'dev/null']) assert(forbidden(file));
for (const file of ['scripts/new-check.mjs', 'app/e2e/portable-backup.spec.ts', 'app/server/services/backup-service.js']) assert(!forbidden(file));

// Check the index, including newly staged files; historical objects are never read.
const files = execFileSync('git', ['ls-files', '-z'], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' }).split('\0').filter(Boolean);
const blocked = files.filter(forbidden);
if (blocked.length) {
  console.error(`Runtime data, local configuration and temporary artifacts must remain outside Git: ${blocked.join(', ')}`);
  process.exit(1);
}
console.log('Tracked-file guard passed; no runtime data, local credentials or temporary artifacts.');
