import { describe, expect, it, vi } from 'vitest';

vi.mock('../database.js', () => ({ dbAll: vi.fn(), dbRun: vi.fn() }));
import { dbAll, dbRun } from '../database.js';
import { auditActionForRequest, listAuditEvents, recordAuditEvent } from './audit-log.js';

describe('self-hosted audit log', () => {
  it('records only authenticated mutation candidates without request content', async () => {
    expect(auditActionForRequest('PUT', '/api/profile')).toEqual({ action: 'profile.put', description: 'Updated page profile' });
    expect(auditActionForRequest('POST', '/api/analytics/events')).toBeNull();
    expect(auditActionForRequest('GET', '/api/profile')).toBeNull();
    dbRun.mockResolvedValueOnce({ changes: 1 });
    await recordAuditEvent({ actor: 'editor', action: 'profile.put', description: 'Updated page profile' });
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_events'), expect.arrayContaining(['editor', 'profile.put']));
  });

  it('parameterizes search, dates and pagination with escaped LIKE wildcards', async () => {
    dbAll.mockResolvedValueOnce([{ id: 9, createdAt: '2026-10-03T12:00:00.000Z', actor: 'editor', action: 'profile.put', description: 'Updated page profile' }]);
    const result = await listAuditEvents({ q: "a%'_", actor: 'editor', action: 'profile.put', from: '2026-10-01', to: '2026-10-03', before: '10' });
    const [sql, values] = dbAll.mock.calls.at(-1);
    expect(sql).toContain('ORDER BY id DESC LIMIT 51');
    expect(sql).not.toContain("a%'_");
    expect(values).toContain("%a\\%'\\_%");
    expect(values).toContain(10);
    expect(result.events).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
