import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import * as OTPAuth from 'otpauth';
const fixture = vi.hoisted(() => {
  // The actual database module must only open this isolated fixture.
  return import('node:fs').then(async (fs) => {
    const os = await import('node:os');
    const path = await import('node:path');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitpage-account-lifecycle-'));
    process.env.DATA_DIR = directory;
    process.env.JWT_SECRET = 'isolated-test-only-secret-at-least-32-characters';
    return { directory, fs };
  });
});
await fixture;
const { default: db, initializeDatabase, dbGet, dbRun, withTransaction } = await import('./database.js');
const { generateToken, generateTwoFactorChallenge, verifyTwoFactorChallenge, authenticateToken } = await import('./auth.js');
const { beginTwoFactorSetup, confirmTwoFactorSetup, verifySecondFactor } = await import('./services/two-factor-service.js');
const { restoreApplicationBackup } = await import('./services/backup-service.js');
beforeAll(async () => {
  await initializeDatabase();
  await dbRun("INSERT INTO admin_users(username,password_hash,salt) VALUES ('admin','hash','salt')");
});
afterAll(async () => {
  await new Promise((resolve) => db.close(resolve));
  const { directory, fs } = await fixture;
  fs.rmSync(directory, { recursive: true, force: true });
});
const accepted = async (token) => {
  const next = vi.fn();
  await authenticateToken({ headers: { authorization: `Bearer ${token}` } }, { status: vi.fn().mockReturnThis(), json: vi.fn() }, next);
  return next.mock.calls.length === 1;
};
it('revokes pre-enrollment sessions and rejects challenges before consuming recovery codes', async () => {
  const user = await dbGet("SELECT * FROM admin_users WHERE username='admin'");
  const old = generateToken('admin', 0, user.session_id);
  const challenge = generateTwoFactorChallenge('admin', 0, user.session_id);
  const setup = await beginTwoFactorSetup('admin');
  const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(setup.secretKey) }).generate();
  const enrolled = await confirmTwoFactorSetup('admin', code, { sessionId: user.session_id, authVersion: 0 });
  expect(await accepted(old)).toBe(false);
  expect(await accepted(generateToken('admin', enrolled.authVersion, enrolled.sessionId))).toBe(true);
  expect((await verifySecondFactor('admin', enrolled.recoveryCodes[0], verifyTwoFactorChallenge(challenge))).valid).toBe(false);
  expect(JSON.parse((await dbGet("SELECT recovery_codes FROM admin_users WHERE username='admin'")).recovery_codes)).toHaveLength(10);
});
it('restores accounts with a fresh identity and revokes surviving personal tokens', async () => {
  const user = await dbGet("SELECT * FROM admin_users WHERE username='admin'");
  const token = generateToken('admin', user.auth_version, user.session_id);
  await dbRun("INSERT INTO personal_api_tokens(id,username,name,token_prefix,token_hash,scopes,created_at) VALUES ('t','admin','test','op_pat_', 'hash', '[]', CURRENT_TIMESTAMP)");
  await withTransaction(() => restoreApplicationBackup({ backup: { schemaVersion: 1, tables: { admin_users: [user] }, uploads: [] }, sections: ['accounts'], dbRun, uploadsPath: (process.env.DATA_DIR + '/uploads') }), { foreignKeys: false });
  const replacement = await dbGet("SELECT * FROM admin_users WHERE username='admin'");
  expect(replacement.session_id).not.toBe(user.session_id);
  expect(await accepted(token)).toBe(false);
  expect((await dbGet('SELECT COUNT(*) AS count FROM personal_api_tokens')).count).toBe(0);
  await dbRun('DELETE FROM admin_users');
  await dbRun("DELETE FROM sqlite_sequence WHERE name='admin_users'");
  await dbRun("INSERT INTO admin_users(username,password_hash,salt,session_id) VALUES ('admin','hash','salt',?)", [user.session_id]);
  expect((await dbGet("SELECT session_id FROM admin_users WHERE username='admin'")).session_id).not.toBe(user.session_id);
});
