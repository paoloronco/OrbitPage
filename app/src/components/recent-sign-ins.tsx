import { useEffect, useId, useRef, useState } from 'react';
import { History, X } from 'lucide-react';

export type SignInEvent = { id: string | number; createdAt: string; method: string; device?: string; current?: boolean };

export default function RecentSignIns({ load, tr }: {
  load: (signal: AbortSignal) => Promise<{ events: SignInEvent[] }>;
  tr: (english: string, italian: string) => string;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [events, setEvents] = useState<SignInEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setEvents([]);
    void load(controller.signal).then((result) => {
      if (!controller.signal.aborted) setEvents(result.events);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [open, attempt, load]);

  const methodLabel = (method: string) => method === 'password' ? 'Password'
    : method === 'password+totp' ? 'Password + 2FA'
    : method === 'google.com' ? 'Google'
    : method === 'google.com+totp' ? 'Google + 2FA'
    : tr('Sign-in', 'Accesso');

  return <>
    <section className="panel account-panel account-sign-ins-panel">
      <div className="account-section-heading"><div><h2><History aria-hidden="true" size={22} />{tr('Recent sign-ins', 'Ultimi accessi')}</h2><p className="muted">{tr('Review successful sign-ins to your account.', 'Controlla gli accessi riusciti al tuo account.')}</p></div></div>
      <button className="button secondary account-secondary-action" ref={opener} type="button" onClick={() => setOpen(true)}>{tr('View sign-ins', 'Visualizza accessi')}</button>
    </section>
    <dialog ref={dialog} className="account-sign-ins-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClose={() => { setOpen(false); opener.current?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="account-sign-ins-content">
        <header className="account-sign-ins-header"><h2 id={`${id}-title`}><History aria-hidden="true" size={22} />{tr('Recent sign-ins', 'Ultimi accessi')}</h2><button className="button secondary" type="button" aria-label={tr('Close', 'Chiudi')} onClick={() => dialog.current?.close()}><X aria-hidden="true" size={18} /></button></header>
        <p className="muted" id={`${id}-description`}>{tr('Your last 20 successful sign-ins, newest first. History starts when this feature is enabled.', 'I tuoi ultimi 20 accessi riusciti, dal più recente. La cronologia parte dall’attivazione di questa funzione.')}</p>
        {error && <div role="alert"><p>{tr('Could not load sign-ins.', 'Impossibile caricare gli accessi.')}</p><button className="button secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>{tr('Try again', 'Riprova')}</button></div>}
        <div className="audit-log-table-wrap" tabIndex={0} role="region" aria-label={tr('Recent sign-ins', 'Ultimi accessi')} aria-busy={loading}>
          <table className="audit-log-table"><thead><tr><th scope="col">{tr('Date and time', 'Data e ora')}</th><th scope="col">{tr('Method', 'Metodo')}</th><th scope="col">{tr('Device', 'Dispositivo')}</th></tr></thead><tbody>
            {events.map((event) => <tr key={event.id}><td><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>{event.current && <small className="sign-in-current">{tr('Current sign-in', 'Accesso attuale')}</small>}</td><td>{methodLabel(event.method)}</td><td>{event.device || tr('Not available', 'Non disponibile')}</td></tr>)}
            {!events.length && <tr><td className="audit-empty" colSpan={3}>{loading ? tr('Loading sign-ins…', 'Caricamento accessi…') : error ? '—' : tr('No sign-ins recorded yet.', 'Nessun accesso ancora registrato.')}</td></tr>}
          </tbody></table>
        </div>
      </div>
    </dialog>
  </>;
}
