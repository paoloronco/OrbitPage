import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entries = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs',
  'app/README.md',
  'app/server/README.md',
  'app/packages/README.md',
  'scripts/README.md',
];
const ignored = new Set(['node_modules', 'dist', 'dist-hosted', 'playwright-report']);

function markdownFiles(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return extname(target).toLowerCase() === '.md' ? [target] : [];
  return readdirSync(target, { withFileTypes: true }).flatMap((entry) =>
    ignored.has(entry.name) ? [] : markdownFiles(join(target, entry.name)),
  );
}

const failures = [];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/gu;

for (const file of entries.flatMap((entry) => markdownFiles(join(root, entry)))) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(linkPattern)) {
    const raw = match[1].trim().replace(/^<|>$/gu, '');
    if (!raw || /^(?:https?:|mailto:|#)/iu.test(raw)) continue;
    const pathPart = raw.split('#', 1)[0].split('?', 1)[0];
    const target = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!existsSync(target)) failures.push(`${file.slice(root.length + 1)} -> ${raw}`);
  }
}

if (failures.length > 0) {
  console.error(`Broken Markdown links:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Markdown links OK.');
}
