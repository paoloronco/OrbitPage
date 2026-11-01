import { useCallback, useEffect, useState } from 'react';
import { auditLogApi, type AuditEvent } from '@/lib/api-client';
import AuditLogView from './audit-log-view';

type Props = { tr: (english: string, italian: string) => string };

export function AuditLog({ tr }: Props) {
  const [filters, setFilters] = useState({ q: '', actor: '', action: '', from: '', to: '' });
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (next?: number | null) => {
    setLoading(true);
    setError(false);
    try {
      const page = await auditLogApi.list({ ...filters, before: next ? String(next) : '' });
      setEvents((current) => next ? [...current, ...page.events] : page.events);
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  return <AuditLogView tr={tr} retention={tr('Changes to this installation are kept for its lifetime.', 'Le modifiche a questa installazione vengono conservate per tutta la sua durata.')} events={events} loading={loading} error={error} hasMore={cursor !== null} onApply={setFilters} onLoadMore={() => void load(cursor)} />;
}
