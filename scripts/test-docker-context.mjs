import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const secrets = ['.instance-env.json', '.instance-env.json.fixture.tmp', '.setup-token', '.setup-token.fixture.tmp', '.jwt-secret'];
for (const context of ['', 'app']) {
  const temporary = mkdtempSync(join(tmpdir(), 'orbitpage-docker-context-'));
  try {
    const input = join(temporary, 'input'), output = join(temporary, 'output');
    mkdirSync(input);
    copyFileSync(join(root, context, '.dockerignore'), join(input, '.dockerignore'));
    writeFileSync(join(input, 'Dockerfile'), 'FROM scratch\nCOPY . /\n');
    for (const folder of ['', 'server', 'nested/data']) {
      mkdirSync(join(input, folder), { recursive: true });
      for (const secret of secrets) writeFileSync(join(input, folder, secret), 'synthetic-secret-fixture');
      writeFileSync(join(input, folder, 'public.txt'), 'public-control');
    }
    execFileSync('docker', ['build', '--output', `type=local,dest=${output}`, input], { stdio: 'inherit' });
    for (const folder of ['', 'server', 'nested/data']) {
      assert(existsSync(join(output, folder, 'public.txt')), 'Ordinary build input must remain available');
      for (const secret of secrets) assert(!existsSync(join(output, folder, secret)), `${context || 'root'} context leaked ${folder}/${secret}`);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
console.log('Both Docker contexts exclude runtime secret files.');
