import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpage-instance-test-'));
const originalDataDir = process.env.DATA_DIR;
let details;

beforeAll(async () => {
  process.env.DATA_DIR = fixture;
  details = await import('./instance-details.js');
});

afterAll(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  fs.rmSync(fixture, { recursive: true, force: true });
});

describe('instance details', () => {
  it('counts persistent files and uploads separately', async () => {
    fs.mkdirSync(path.join(fixture, 'uploads'));
    fs.writeFileSync(path.join(fixture, 'orbitpage.db'), 'database');
    fs.writeFileSync(path.join(fixture, 'uploads', 'photo.png'), 'photo');
    const usage = await details.storageUsage();
    expect(usage.usedBytes).toBe(13);
    expect(usage.uploadBytes).toBe(5);
    expect(details.databasePath).toBe(path.join(fixture, 'orbitpage.db'));
  });

  it('persists allowlisted overrides without returning their values', async () => {
    const secret = 'test-secret-do-not-return';
    const summary = await details.saveEnvironmentChanges({ OPENAI_API_KEY: secret });
    expect(summary.find(({ key }) => key === 'OPENAI_API_KEY')).toMatchObject({ configured: true, overridden: true });
    expect(JSON.stringify(summary)).not.toContain(secret);
    const saved = JSON.parse(fs.readFileSync(path.join(fixture, '.instance-env.json'), 'utf8'));
    expect(saved.overrides.OPENAI_API_KEY).toBe(secret);
    const cleared = await details.saveEnvironmentChanges({ OPENAI_API_KEY: null });
    expect(cleared.find(({ key }) => key === 'OPENAI_API_KEY').overridden).toBe(false);
  });

  it('rejects unknown names and malformed values', async () => {
    await expect(details.saveEnvironmentChanges({ JWT_SECRET: 'replacement' })).rejects.toThrow('Invalid');
    await expect(details.saveEnvironmentChanges({ PUBLIC_SITE_URL: 'javascript:alert(1)' })).rejects.toThrow('Invalid');
    await expect(details.saveEnvironmentChanges({ SEO_INDEXING: 'sometimes' })).rejects.toThrow('Invalid');
    await expect(details.saveEnvironmentChanges({ PUBLIC_SITE_NAME: 'bad\nvalue' })).rejects.toThrow('Invalid');
  });
});
