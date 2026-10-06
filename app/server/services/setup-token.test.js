import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directories = [];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('local setup token', () => {
  it('defaults to direct setup and validates explicit token protection', async () => {
    const { isSetupTokenRequired } = await import('./setup-token.js');
    vi.stubEnv('REQUIRE_SETUP_TOKEN', undefined);
    expect(isSetupTokenRequired()).toBe(false);
    for (const [value, required] of [['false', false], ['0', false], ['true', true], ['1', true]]) {
      vi.stubEnv('REQUIRE_SETUP_TOKEN', value);
      expect(isSetupTokenRequired()).toBe(required);
    }
    vi.stubEnv('REQUIRE_SETUP_TOKEN', 'typo');
    expect(() => isSetupTokenRequired()).toThrow('REQUIRE_SETUP_TOKEN');
  });
  it('requires possession of the owner-only file and rotates after reset', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpage-setup-'));
    directories.push(directory);
    vi.stubEnv('DATA_DIR', directory);
    vi.resetModules();
    const { ensureSetupToken, verifySetupToken, rotateSetupToken, consumeSetupToken } = await import('./setup-token.js');

    const first = ensureSetupToken();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(ensureSetupToken()).toBe(first);
    expect(verifySetupToken('b'.repeat(64))).toBe(false);
    expect(verifySetupToken(first)).toBe(true);
    if (process.platform !== 'win32') {
      expect(fs.statSync(path.join(directory, '.setup-token')).mode & 0o777).toBe(0o600);
    }

    rotateSetupToken();
    expect(verifySetupToken(first)).toBe(false);
    consumeSetupToken();
    expect(fs.existsSync(path.join(directory, '.setup-token'))).toBe(false);
  });
});
