import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), access: vi.fn(), read: vi.fn(), writable: vi.fn(), fetch: vi.fn() }));
vi.mock('../database.js', () => ({ dbGet: mocks.get, dbAll: vi.fn(), dbRun: vi.fn() }));
vi.mock('./instance-details.js', () => ({ dataDir: '/fixture-data', databasePath: '/fixture-data/orbitpage.db', uploadsPath: '/fixture-data/uploads', writableDirectory: mocks.writable }));
vi.mock('node:fs/promises', () => ({ default: { readFile: mocks.read, access: mocks.access, statfs: async () => ({ bavail: 10 }), lstat: async () => ({ mode: 0o700, isSymbolicLink: () => false }) } }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv('JWT_SECRET', 'fictional-health-secret-with-at-least-thirty-two-characters');
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.get.mockResolvedValue({ quick_check: 'ok' }); mocks.writable.mockResolvedValue(true); mocks.access.mockResolvedValue();
  mocks.read.mockImplementation(async file => file.endsWith('index.html') ? '<script src="./assets/app.js"></script>' : JSON.stringify(file.endsWith('package-lock.json')
    ? { version: '4.21.88', packages: { 'node_modules/express': { version: '4.22.3', resolved: 'https://registry.npmjs.org/express/-/express-4.22.3.tgz' }, 'node_modules/test-only': { dev: true, version: '1.0.0', resolved: 'https://registry.npmjs.org/test-only/-/test-only-1.0.0.tgz' } } }
    : { version: '4.21.88', dependencies: { express: '^4.22.3' } }));
  mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('instance health', () => {
  it('checks local services and production advisories without exposing configuration or making changes', async () => {
    const { instanceHealth } = await import('./instance-health.js');
    const result = await instanceHealth({ secure: true, securityHeaders: true });
    expect(result.checks.find(check => check.id === 'database').status).toBe('ok');
    expect(result.checks.find(check => check.id === 'build').status).toBe('ok');
    expect(result.audit).toMatchObject({ status: 'ok', counts: { critical: 0, high: 0, moderate: 0, low: 0 } });
    expect(mocks.get).toHaveBeenCalledWith('PRAGMA quick_check(1)');
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({ express: ['4.22.3'] });
    expect(JSON.stringify(result)).not.toContain(process.env.JWT_SECRET);
    expect(JSON.stringify(result)).not.toContain('/fixture-data');
    expect(result.checks.find(check => check.id === 'permissions').status).toBe(process.platform === 'win32' ? 'unavailable' : 'ok');
  });
  it('reports failures and unavailable checks without claiming the instance is healthy', async () => {
    mocks.get.mockResolvedValue({ quick_check: 'corrupt' }); mocks.writable.mockResolvedValue(false); mocks.access.mockRejectedValue(new Error('Missing build'));
    mocks.fetch.mockRejectedValue(new Error('Registry offline'));
    vi.stubEnv('JWT_SECRET', 'change-me');
    const { instanceHealth } = await import('./instance-health.js');
    const result = await instanceHealth({ secure: false, securityHeaders: false });
    expect(Object.fromEntries(result.checks.map(check => [check.id, check.status]))).toMatchObject({ database: 'error', data: 'error', build: 'unavailable', https: 'warning', sessionSecret: 'warning', securityHeaders: 'error', vulnerabilities: 'unavailable' });
    expect(result.audit.counts).toBeNull();
  });
  it('counts duplicate advisories once and reuses the cached audit', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ express: [{ id: 123, severity: 'high' }, { id: 123, severity: 'high' }] })));
    const { auditDependencies } = await import('./instance-health.js');
    expect(await auditDependencies()).toMatchObject({ status: 'error', counts: { high: 1 } });
    expect(await auditDependencies()).toMatchObject({ status: 'error', counts: { high: 1 } });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([[], { express: [{ id: 1, severity: 'invented' }] }, { unknown: [] }])('rejects malformed registry responses: %j', async body => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify(body)));
    const { auditDependencies } = await import('./instance-health.js');
    expect(await auditDependencies()).toMatchObject({ status: 'unavailable', counts: null });
  });
  it('warns about unsupported and expired Node.js versions', async () => {
    const { supportedNode } = await import('./instance-health.js');
    const now = Date.parse('2026-10-09');
    expect(supportedNode('v20.19.0', now)).toBe(false);
    expect(supportedNode('v22.11.0', now)).toBe(false);
    expect(supportedNode('v22.12.0', now)).toBe(true);
    expect(supportedNode('v22.12.0', Date.parse('2027-05-01'))).toBe(false);
    expect(supportedNode('v24.21.0', now)).toBe(true);
  });
});
