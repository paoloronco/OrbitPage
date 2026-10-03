import { useCallback, useEffect, useState } from 'react';
import { auditLogApi, type AuditEvent } from '@/lib/api-client';

type Props = { tr: (english: string, italian: string) => string };

export function AuditLog({ tr }: Props) {
  const [draft, setDraft] = useState({ q: '', actor: '', action: '', from: '', to: '' });
  const [filters, setFilters] = useState(draft);
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

  return <section className="panel account-panel audit-log-panel">
    <div className="account-section-heading"><div><h2>{tr('Audit log', 'Registro attività')}</h2><p className="muted">{tr('Changes to this installation are kept for its lifetime.', 'Le modifiche a questa installazione vengono conservate per tutta la sua durata.')}</p></div></div>
    <form className="audit-log-filters" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft }); }}>
      <label><span>{tr('Search', 'Cerca')}</span><input className="input" maxLength={120} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder={tr('Search user or change', 'Cerca utente o modifica')} value={draft.q} /></label>
      <label><span>{tr('User', 'Utente')}</span><input className="input" maxLength={100} onChange={(event) => setDraft({ ...draft, actor: event.target.value })} value={draft.actor} /></label>
      <label><span>{tr('Action', 'Azione')}</span><input className="input" maxLength={100} onChange={(event) => setDraft({ ...draft, action: event.target.value })} placeholder="profile.put" value={draft.action} /></label>
      <label><span>{tr('From', 'Dal')}</span><input className="input" onChange={(event) => setDraft({ ...draft, from: event.target.value })} type="date" value={draft.from} /></label>
      <label><span>{tr('To', 'Al')}</span><input className="input" onChange={(event) => setDraft({ ...draft, to: event.target.value })} type="date" value={draft.to} /></label>
      <button className="button" disabled={loading} type="submit">{tr('Apply filters', 'Applica filtri')}</button>
    </form>
    {error && <p role="alert">{tr('Could not load audit events.', 'Impossibile caricare il registro.')}</p>}
    <div className="audit-log-table-wrap"><table className="audit-log-table"><thead><tr><th>{tr('Date and time', 'Data e ora')}</th><th>{tr('User', 'Utente')}</th><th>{tr('Change', 'Modifica effettuata')}</th></tr></thead><tbody>
      {events.map((event) => <tr key={event.id}><td><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></td><td>{event.actor}</td><td>{event.description}<small>{event.action}</small></td></tr>)}
    </tbody></table></div>
    {!events.length && !loading && !error && <p className="muted">{tr('No matching events.', 'Nessun evento corrispondente.')}</p>}
    {cursor && <button className="button secondary" disabled={loading} onClick={() => void load(cursor)} type="button">{tr('Load more', 'Carica altri')}</button>}
  </section>;
}
