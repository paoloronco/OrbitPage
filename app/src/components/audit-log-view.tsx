import { useState } from 'react';
import { History, ListFilter, RotateCcw, Search } from 'lucide-react';

export type AuditFilters = { q: string; actor: string; action: string; from: string; to: string };
const EMPTY_AUDIT_FILTERS: AuditFilters = { q: '', actor: '', action: '', from: '', to: '' };
type Event = { id: string | number; createdAt: string; actor: string; action: string; description: string };

export default function AuditLogView({ tr, retention, events, loading, error, hasMore, emptyMessage, onApply, onLoadMore }: {
  tr: (english: string, italian: string) => string; retention: string; events: Event[];
  loading: boolean; error: boolean; hasMore: boolean; emptyMessage?: string;
  onApply: (filters: AuditFilters) => void; onLoadMore: () => void;
}) {
  const [draft, setDraft] = useState(EMPTY_AUDIT_FILTERS);
  return <section className="panel account-panel audit-log-panel">
    <div className="account-section-heading"><div><h2><History aria-hidden="true" size={22} />{tr('Audit log', 'Registro attività')}</h2><p className="muted">{retention}</p></div></div>
    <form className="audit-log-filters" onSubmit={(event) => { event.preventDefault(); onApply({ ...draft }); }}>
      <label className="audit-search-field"><span>{tr('Search', 'Cerca')}</span><span className="audit-search-control"><Search aria-hidden="true" size={17} /><input className="input" maxLength={120} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder={tr('Search user or change', 'Cerca utente o modifica')} value={draft.q} /></span></label>
      <label><span>{tr('User', 'Utente')}</span><input className="input" maxLength={160} onChange={(event) => setDraft({ ...draft, actor: event.target.value })} value={draft.actor} /></label>
      <label><span>{tr('Action', 'Azione')}</span><input className="input" maxLength={100} onChange={(event) => setDraft({ ...draft, action: event.target.value })} placeholder={tr('Action name', 'Nome azione')} value={draft.action} /></label>
      <label><span>{tr('From', 'Dal')}</span><input className="input" max={draft.to || undefined} onChange={(event) => setDraft({ ...draft, from: event.target.value })} type="date" value={draft.from} /></label>
      <label><span>{tr('To', 'Al')}</span><input className="input" min={draft.from || undefined} onChange={(event) => setDraft({ ...draft, to: event.target.value })} type="date" value={draft.to} /></label>
      <div className="audit-filter-actions"><button className="button" disabled={loading} type="submit"><ListFilter aria-hidden="true" size={16} />{tr('Apply filters', 'Applica filtri')}</button><button className="button secondary" disabled={loading} type="button" onClick={() => { setDraft(EMPTY_AUDIT_FILTERS); onApply({ ...EMPTY_AUDIT_FILTERS }); }} aria-label={tr('Reset filters', 'Azzera filtri')} title={tr('Reset filters', 'Azzera filtri')}><RotateCcw aria-hidden="true" size={16} /></button></div>
    </form>
    {error && <p className="error" role="alert">{tr('Could not load audit events. Apply filters to try again.', 'Impossibile caricare il registro. Applica i filtri per riprovare.')}</p>}
    <div className="audit-log-table-wrap" role="region" aria-label={tr('Audit log', 'Registro attività')} tabIndex={0} aria-busy={loading}>
      <table className="audit-log-table"><thead><tr><th scope="col">{tr('Date and time', 'Data e ora')}</th><th scope="col">{tr('User', 'Utente')}</th><th scope="col">{tr('Change', 'Modifica effettuata')}</th></tr></thead><tbody>
        {events.map((event) => <tr key={event.id}><td><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></td><td><span className="audit-actor">{event.actor}</span></td><td>{event.description}<small><code>{event.action}</code></small></td></tr>)}
        {!events.length && <tr><td colSpan={3} className="audit-empty">{loading ? tr('Loading events…', 'Caricamento eventi…') : error ? '—' : emptyMessage || tr('No matching events.', 'Nessun evento corrispondente.')}</td></tr>}
      </tbody></table>
    </div>
    <footer className="audit-log-footer"><span className="muted" role="status">{loading ? tr('Loading events…', 'Caricamento eventi…') : `${tr('events loaded', 'eventi caricati')}: ${events.length}`}</span>{hasMore && <button className="button secondary" disabled={loading} onClick={onLoadMore} type="button">{tr('Load more', 'Carica altri')}</button>}</footer>
  </section>;
}
