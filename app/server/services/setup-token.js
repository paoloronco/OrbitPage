import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const tokenPath = path.join(process.env.DATA_DIR || path.dirname(fileURLToPath(new URL('../server.js', import.meta.url))), '.setup-token');

export function ensureSetupToken() {
  try {
    const entry = fs.lstatSync(tokenPath);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Local setup token must be a regular file');
    if (process.platform !== 'win32') fs.chmodSync(tokenPath, 0o600);
    return fs.readFileSync(tokenPath, 'utf8').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const token = randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(tokenPath, `${token}\n`, { flag: 'wx', mode: 0o600 });
    return token;
  } catch (error) {
    if (error.code === 'EEXIST') return fs.readFileSync(tokenPath, 'utf8').trim();
    throw error;
  }
}

export function verifySetupToken(provided) {
  if (typeof provided !== 'string' || !/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = ensureSetupToken();
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('Invalid local setup token');
  return timingSafeEqual(Buffer.from(provided.toLowerCase()), Buffer.from(expected));
}

export function rotateSetupToken() {
  const token = randomBytes(32).toString('hex');
  const temporary = `${tokenPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${token}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, tokenPath);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* preserve the original error */ }
    throw error;
  }
}

export function consumeSetupToken() {
  try {
    fs.unlinkSync(tokenPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
