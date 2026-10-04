import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { dbGet, dbRun } from '../database.js';

const ISSUER = 'OrbitPage';
const RECOVERY_CODE_COUNT = 10;

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('Set a stable JWT_SECRET of at least 32 characters before enabling two-factor authentication.');
  return createHash('sha256').update('orbitpage-totp\0').update(secret).digest();
}

function encryptSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(payload) {
  const [iv, tag, ciphertext] = String(payload || '').split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv?.length || !tag?.length || !ciphertext?.length) throw new Error('The stored authenticator secret is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function totp(username, secret) {
  return new OTPAuth.TOTP({ issuer: ISSUER, label: username, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
}

function verifyTotp(username, encryptedSecret, token) {
  if (!/^\d{6}$/.test(String(token || ''))) return false;
  return totp(username, decryptSecret(encryptedSecret)).validate({ token: String(token), window: 1 }) !== null;
}

function formatRecoveryCode() {
  return randomBytes(12).toString('base64url').replace(/[-_]/g, '').toUpperCase().slice(0, 16).match(/.{1,4}/g).join('-');
}

function storeRecoveryCode(code) {
  const salt = randomBytes(16);
  return { id: randomBytes(8).toString('hex'), salt: salt.toString('base64url'), hash: scryptSync(normalizeRecoveryCode(code), salt, 32).toString('base64url') };
}

function normalizeRecoveryCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function recoveryCodeMatches(code, stored) {
  const actual = scryptSync(normalizeRecoveryCode(code), Buffer.from(stored.salt, 'base64url'), 32);
  const expected = Buffer.from(stored.hash, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createRecoveryCodeSet() {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, formatRecoveryCode);
  return { codes, stored: codes.map(storeRecoveryCode) };
}

export async function getTwoFactorStatus(username) {
  const user = await dbGet('SELECT totp_enabled, recovery_codes FROM admin_users WHERE username = ?', [username]);
  if (!user) throw new Error('User not found.');
  let remaining = 0;
  try { remaining = JSON.parse(user.recovery_codes || '[]').length; } catch { remaining = 0; }
  return { enabled: Boolean(user.totp_enabled), recoveryCodesRemaining: remaining };
}

export async function beginTwoFactorSetup(username, session) {
  encryptionKey();
  const current = await dbGet('SELECT totp_enabled, totp_secret, totp_pending_expires_at, auth_version, session_id FROM admin_users WHERE username = ?', [username]);
  if (!current) throw new Error('User not found.');
  if (current.totp_enabled) throw new Error('Two-factor authentication is already active. Disable it before replacing the authenticator.');
  if (session && (session.sessionId !== current.session_id || Number(session.authVersion) !== Number(current.auth_version || 0))) throw new Error('The session changed. Sign in again.');
  const secret = new OTPAuth.Secret({ size: 20 });
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const update = await dbRun('UPDATE admin_users SET totp_secret = ?, totp_pending_expires_at = ?, recovery_codes = NULL WHERE username = ? AND totp_enabled = 0 AND session_id = ? AND auth_version = ? AND totp_secret IS ? AND totp_pending_expires_at IS ?', [encryptSecret(secret.base32), expiresAt, username, current.session_id, current.auth_version, current.totp_secret, current.totp_pending_expires_at]);
  if (update.changes !== 1) throw new Error('The setup session changed. Start again.');
  return { secretKey: secret.base32, uri: totp(username, secret.base32).toString(), expiresAt };
}

export async function confirmTwoFactorSetup(username, token, session) {
  const user = await dbGet('SELECT totp_secret, totp_pending_expires_at, auth_version, session_id FROM admin_users WHERE username = ?', [username]);
  if (!user || session.sessionId !== user.session_id || Number(session.authVersion) !== Number(user.auth_version || 0)) throw new Error('The session changed. Sign in again.');
  if (!user?.totp_secret || !user.totp_pending_expires_at || Date.parse(user.totp_pending_expires_at) < Date.now()) throw new Error('The setup session expired. Start again.');
  if (!verifyTotp(username, user.totp_secret, token)) throw new Error('The authentication code is not valid.');
  const recovery = createRecoveryCodeSet();
  const result = await dbRun('UPDATE admin_users SET totp_enabled = 1, totp_pending_expires_at = NULL, recovery_codes = ?, auth_version = COALESCE(auth_version, 0) + 1 WHERE username = ? AND totp_enabled = 0 AND totp_secret = ? AND totp_pending_expires_at = ? AND session_id = ? AND auth_version = ?', [JSON.stringify(recovery.stored), username, user.totp_secret, user.totp_pending_expires_at, user.session_id, user.auth_version]);
  if (result.changes !== 1) throw new Error('The setup session changed. Start again.');
  return { recoveryCodes: recovery.codes, authVersion: Number(user.auth_version || 0) + 1, sessionId: user.session_id };
}

export async function verifySecondFactor(username, token, challenge) {
  const user = await dbGet('SELECT totp_secret, totp_enabled, recovery_codes, auth_version, session_id FROM admin_users WHERE username = ?', [username]);
  if (!user?.totp_enabled || !user.totp_secret) return { valid: false };
  if (challenge && (!challenge.sessionId || challenge.sessionId !== user.session_id || Number(challenge.authVersion) !== Number(user.auth_version || 0))) return { valid: false };
  if (verifyTotp(username, user.totp_secret, token)) return { valid: true, authVersion: Number(user.auth_version || 0), sessionId: user.session_id, recoveryCodeUsed: false };

  let stored = [];
  try { stored = JSON.parse(user.recovery_codes || '[]'); } catch { stored = []; }
  const index = stored.findIndex((candidate) => recoveryCodeMatches(token, candidate));
  if (index < 0) return { valid: false };
  const next = stored.filter((_, candidateIndex) => candidateIndex !== index);
  const update = await dbRun('UPDATE admin_users SET recovery_codes = ? WHERE username = ? AND recovery_codes = ? AND session_id = ? AND auth_version = ?', [JSON.stringify(next), username, user.recovery_codes, user.session_id, user.auth_version]);
  return { valid: Number(update.changes || 0) === 1, authVersion: Number(user.auth_version || 0), sessionId: user.session_id, recoveryCodeUsed: true, remaining: next.length };
}

export async function regenerateRecoveryCodes(username, token) {
  const user = await dbGet('SELECT totp_secret, totp_enabled FROM admin_users WHERE username = ?', [username]);
  if (!user?.totp_enabled || !verifyTotp(username, user.totp_secret, token)) throw new Error('The authentication code is not valid.');
  const recovery = createRecoveryCodeSet();
  await dbRun('UPDATE admin_users SET recovery_codes = ? WHERE username = ?', [JSON.stringify(recovery.stored), username]);
  return recovery.codes;
}

export async function disableTwoFactor(username, token, session) {
  const verification = await verifySecondFactor(username, token, session);
  if (!verification.valid) throw new Error('The authentication or recovery code is not valid.');
  const update = await dbRun('UPDATE admin_users SET totp_secret = NULL, totp_enabled = 0, totp_pending_expires_at = NULL, recovery_codes = NULL, auth_version = COALESCE(auth_version, 0) + 1 WHERE username = ? AND session_id = ? AND auth_version = ?', [username, verification.sessionId, verification.authVersion]);
  if (!update.changes) throw new Error('User not found.');
  return verification.authVersion + 1;
}
