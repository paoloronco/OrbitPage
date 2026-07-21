import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('self-hosted two-factor security boundaries', () => {
  const auth = fs.readFileSync(new URL('./auth.js', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('./services/two-factor-service.js', import.meta.url), 'utf8');

  it('issues only a short-lived purpose-bound challenge before the second factor', () => {
    expect(auth).toContain("purpose: 'two-factor-login'");
    expect(auth).toContain("expiresIn: '5m'");
    expect(server).toContain('requiresTwoFactor: true');
    expect(server).toContain('verifySecondFactor(challenge.username, code)');
  });

  it('encrypts TOTP secrets and stores recovery codes as salted hashes', () => {
    expect(service).toContain("createCipheriv('aes-256-gcm'");
    expect(service).toContain('scryptSync(normalizeRecoveryCode(code), salt, 32)');
    expect(service).toContain('timingSafeEqual(actual, expected)');
  });

  it('revokes older sessions when account security changes', () => {
    expect(auth).toContain('decoded.authVersion');
    expect(service).toContain('auth_version = COALESCE(auth_version, 0) + 1');
  });
});
