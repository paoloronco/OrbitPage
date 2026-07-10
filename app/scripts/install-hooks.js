import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

execSync('git config core.hooksPath .githooks', { cwd: repoRoot, stdio: 'inherit' });

console.log('Git hooks installed (core.hooksPath=.githooks)');
console.log('Pre-push will run: build, lint, frontend unit tests, backend unit tests.');
