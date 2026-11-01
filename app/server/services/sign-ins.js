import { dbAll, dbRun, withTransaction } from '../database.js';
import { describeSignInDevice } from '../../packages/sign-in-device.js';

export async function recordSignIn(username, method, userAgent) {
  await withTransaction(async () => {
    await dbRun('INSERT INTO account_sign_ins (user_id, created_at, method, device) SELECT id, ?, ?, ? FROM admin_users WHERE username = ?', [new Date().toISOString(), method, describeSignInDevice(userAgent), username]);
    await dbRun('DELETE FROM account_sign_ins WHERE user_id = (SELECT id FROM admin_users WHERE username = ?) AND id NOT IN (SELECT id FROM account_sign_ins WHERE user_id = (SELECT id FROM admin_users WHERE username = ?) ORDER BY id DESC LIMIT 20)', [username, username]);
  });
}

export async function listSignIns(username) {
  return { events: await dbAll('SELECT s.id, s.created_at AS createdAt, s.method, s.device FROM account_sign_ins s JOIN admin_users u ON u.id = s.user_id WHERE u.username = ? ORDER BY s.id DESC LIMIT 20', [username]) };
}
