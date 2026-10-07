import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const forbidden = (file) => /(?:^|\/)(?:\.jwt-secret|\.setup-token|\.instance-env\.json)$|\.(?:db|sqlite3?)(?:$|[-.](?:shm|wal|journal|bak|backup)$)|(?:^|\/)\.env(?:\.[^/]+)?$/i.test(file)
  && !/\.env(?:\.[^/]+)?\.(?:example|template)$|(?:^|\/)\.env\.(?:example|template)$/i.test(file);
for (const file of ['server/lynx.db', 'app/server/orbitpage.db.bak', 'data/page.sqlite-wal', 'data/page.DB-journal', 'app/.env.local', '.jwt-secret']) assert(forbidden(file));
for (const file of ['app/.env.example', 'app/.env.production.example', 'server/db.js', 'docs/wiki/administration/Configuration.md']) assert(!forbidden(file));

// Check the index, including newly staged files; historical objects are never read.
const files = execFileSync('git', ['ls-files', '-z'], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' }).split('\0').filter(Boolean);
const blocked = files.filter(forbidden);
if (blocked.length) {
  console.error(`Runtime data/configuration must remain outside Git: ${blocked.join(', ')}`);
  process.exit(1);
}
console.log('Tracked-file guard passed; no database, sidecar or local credential files.');
