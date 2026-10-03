import { dbAll, dbRun } from '../database.js';

const ACTION_LABELS = {
  profile: 'Updated page profile',
  links: 'Changed page content',
  theme: 'Changed page design',
  menu: 'Changed menu',
  subpages: 'Changed subpages',
  'campaign-links': 'Changed campaign links',
  'consent-config': 'Changed consent settings',
  'text-files': 'Changed text files',
  sitemap: 'Generated sitemap',
  users: 'Changed a team member',
  newsletter: 'Changed newsletter settings or content',
  'api-tokens': 'Changed an API token',
  'personal-page': 'Changed the personal page',
  'change-password': 'Changed password',
  '2fa': 'Changed two-factor authentication',
  restore: 'Restored a backup',
  versions: 'Restored a page version',
  upload: 'Uploaded media',
};

export function auditActionForRequest(method, path) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !path.startsWith('/api/')) return null;
  if (/^\/api\/(?:analytics|auth\/(?:login|verify|setup|reset|2fa\/verify)|ai\/page\/(?:plan|launch-kit))\b/.test(path)) return null;
  const parts = path.slice(5).split('/');
  const section = parts[0] === 'account' || parts[0] === 'auth' || parts[0] === 'admin'
    ? parts[1] : parts[0];
  if (!section) return null;
  const action = `${section}.${method.toLowerCase()}`;
  return { action, description: ACTION_LABELS[section] || `Changed ${section.replaceAll('-', ' ')}` };
}

export async function recordAuditEvent({ actor, action, description }) {
  await dbRun(
    'INSERT INTO audit_events (created_at, actor, action, description) VALUES (?, ?, ?, ?)',
    [new Date().toISOString(), actor.slice(0, 100), action.slice(0, 100), description.slice(0, 200)],
  );
}

const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
const likeValue = (value) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

export async function listAuditEvents(query) {
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : '';
  const actor = typeof query.actor === 'string' ? query.actor.trim().slice(0, 100) : '';
  const action = typeof query.action === 'string' ? query.action.trim().slice(0, 100) : '';
  const before = Number(query.before);
  const conditions = [];
  const values = [];
  if (search) {
    conditions.push("(actor LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
    values.push(...Array(3).fill(likeValue(search)));
  }
  if (actor) { conditions.push('actor = ?'); values.push(actor); }
  if (action) { conditions.push('action = ?'); values.push(action); }
  if (validDate(query.from)) { conditions.push('created_at >= ?'); values.push(`${query.from}T00:00:00.000Z`); }
  if (validDate(query.to)) { conditions.push('created_at < ?'); values.push(new Date(Date.parse(`${query.to}T00:00:00.000Z`) + 86_400_000).toISOString()); }
  if (Number.isSafeInteger(before) && before > 0) { conditions.push('id < ?'); values.push(before); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await dbAll(
    `SELECT id, created_at AS createdAt, actor, action, description FROM audit_events ${where} ORDER BY id DESC LIMIT 51`,
    values,
  );
  return { events: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null };
}
