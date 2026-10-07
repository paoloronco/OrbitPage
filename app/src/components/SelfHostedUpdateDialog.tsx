import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, RefreshCw } from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { applicationUpdatesApi, type ApplicationUpdateStatus } from '@/lib/api-client';
import { useAppI18n } from '@/lib/i18n';

const UPDATE_GUIDE = 'https://github.com/paoloronco/OrbitPage/blob/main/docs/wiki/Deployment.md#web-updates';

export function SelfHostedUpdateDialog({ requestedVersion, canInstall, onClose }: {
  requestedVersion: string | null; canInstall: boolean; onClose: () => void;
}) {
  const { tr } = useAppI18n();
  const [status, setStatus] = useState<ApplicationUpdateStatus | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [checking, setChecking] = useState(false);
  const [reloading, setReloading] = useState(false);
  const lastContact = useRef(Date.now());
  const [uncertain, setUncertain] = useState(false);
  const wasActive = useRef(false);
  const acceptedJobId = useRef<string | null>(null);
  const submitting = useRef(false);
  const logs = useRef<HTMLPreElement>(null);
  const active = starting || awaitingConfirmation || ['queued', 'running'].includes(status?.job?.state || '');
  const job = status?.job && (['queued', 'running'].includes(status.job.state) || status.job.version === requestedVersion || (!requestedVersion && showResult)) ? status.job : null;
  const open = requestedVersion !== null || active || showResult;

  const readStatus = useCallback(async () => {
    if (submitting.current) return;
    try {
      const next = await applicationUpdatesApi.status();
      if (submitting.current) return;
      // A lost socket is not proof that a previously accepted update has stopped.
      if (wasActive.current && acceptedJobId.current && !next.enabled) throw new Error('Updater disconnected.');
      if (wasActive.current && acceptedJobId.current && next.job?.id !== acceptedJobId.current) throw new Error('Waiting for the accepted update.');
      const busy = ['queued', 'running'].includes(next.job?.state || '');
      if (wasActive.current && !busy && next.job
        && (next.job.id === acceptedJobId.current || next.job.version === requestedVersion || requestedVersion === null)) {
        setShowResult(true);
        // HTTP-only sessions live in memory; retain them rather than forcing a new login.
        if (next.job.state === 'completed' && next.job.id === acceptedJobId.current && window.crypto?.subtle) setReloading(true);
      }
      wasActive.current = busy;
      acceptedJobId.current = next.job?.id || null;
      setAwaitingConfirmation(false);
      setStatus(next);
      lastContact.current = Date.now(); setUncertain(false);
      setConnectionError(false);
    } catch { setConnectionError(true); setUncertain(Date.now() - lastContact.current >= 90_000); }
  }, [requestedVersion]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await readStatus();
      if (!stopped) timer = setTimeout(() => void poll(), wasActive.current || requestedVersion ? 2000 : 30000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
    // The host status owns the lifecycle, including dashboard reloads and server restarts.
  }, [readStatus, requestedVersion]);

  useEffect(() => {
    if (!reloading) return;
    const timer = setTimeout(() => window.location.reload(), 1500);
    return () => clearTimeout(timer);
  }, [reloading]);

  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
  useEffect(() => { if (logs.current) logs.current.scrollTop = logs.current.scrollHeight; }, [job?.logs]);

  const install = async () => {
    if (!requestedVersion || !password || !canInstall || !status?.enabled) return;
    submitting.current = true;
    setStarting(true); setAwaitingConfirmation(true); wasActive.current = false; acceptedJobId.current = null; setError('');
    try {
      const next = await applicationUpdatesApi.install(requestedVersion, password);
      setStatus(next); wasActive.current = ['queued', 'running'].includes(next.job?.state || '');
      acceptedJobId.current = next.job?.id || null;
      setAwaitingConfirmation(false);
      setPassword(''); setShowResult(true); setConnectionError(false); lastContact.current = Date.now(); setUncertain(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('Could not start the update.', 'Impossibile avviare l’aggiornamento.'));
      // A rejected password/permission request never reached the host updater.
      if (reason instanceof Error && 'status' in reason && [400, 401, 403, 429].includes(Number(reason.status))) {
        wasActive.current = false; setAwaitingConfirmation(false);
      }
      submitting.current = false;
      await readStatus();
    } finally { submitting.current = false; setStarting(false); }
  };

  return <Dialog open={open} onOpenChange={value => { if (!value && !active) { setShowResult(false); setError(''); setPassword(''); onClose(); } }}>
    <DialogContent dirty={active || Boolean(password)} className={`orbitpage-admin oss-account-delete-dialog account-update-dialog${active ? ' account-update-dialog--locked' : ''}`} overlayClassName="oss-account-delete-overlay" aria-describedby={undefined}
      onEscapeKeyDown={event => { if (active) event.preventDefault(); }} onPointerDownOutside={event => { if (active) event.preventDefault(); }}>
      <DialogHeader className="account-delete-header"><DialogTitle>{tr('Install OrbitPage update', 'Installa l’aggiornamento di OrbitPage')}</DialogTitle></DialogHeader>
      <div className={`account-update-status${job?.state === 'failed' ? ' account-update-status--failed' : ''}`} role="status" aria-live="polite">
        <strong>{reloading ? tr('Update complete — reopening your dashboard…', 'Aggiornamento completato — riapertura della dashboard…')
          : connectionError && wasActive.current && !uncertain ? tr('Restarting OrbitPage — reconnecting automatically…', 'Riavvio di OrbitPage — riconnessione automatica…')
          : uncertain ? tr('Connection lost — update status unknown', 'Connessione persa — stato aggiornamento sconosciuto')
          : starting ? tr('Starting update…', 'Avvio aggiornamento…')
          : job?.state === 'queued' ? tr('Checking the release…', 'Verifica della versione…')
          : job?.state === 'running' ? tr('Installing update…', 'Installazione aggiornamento…')
          : awaitingConfirmation ? tr('Update start has not been confirmed', 'Avvio aggiornamento non confermato')
          : job?.state === 'completed' ? tr(`Update completed · v${job.version}`, `Aggiornamento completato · v${job.version}`)
          : job?.state === 'failed' ? tr('Update failed', 'Aggiornamento non riuscito')
          : connectionError ? tr('Host updater unavailable', 'Updater sul server non disponibile')
          : status?.enabled ? tr(`Ready to install v${requestedVersion}`, `Pronto per installare v${requestedVersion}`)
          : status ? tr('Web updates are not enabled', 'Gli aggiornamenti web non sono abilitati')
          : tr('Connecting to the host updater…', 'Connessione all’updater sul server…')}</strong>
        {job?.state === 'running' && job.logs.includes('[update] ') && <span>{job.logs.split('\n').filter(line => line.startsWith('[update] ')).at(-1)?.slice(9)}</span>}
        {(starting || ['queued', 'running'].includes(job?.state || '')) && !uncertain && <progress aria-label={tr('Update in progress', 'Aggiornamento in corso')} />}
      </div>
      {connectionError && <p role="alert">{uncertain
        ? tr('The result could not be confirmed. Check the updater service on the server; the dashboard remains locked while the last known update is active.', 'Non è possibile confermare l’esito. Controlla il servizio updater sul server; la dashboard resta bloccata mentre l’ultimo stato noto indica un aggiornamento attivo.')
        : awaitingConfirmation && !acceptedJobId.current ? tr('Cannot reach the host updater. Checking whether the update started; installation is not confirmed.', 'Impossibile contattare l’updater sul server. Verifica dell’avvio in corso; l’installazione non è confermata.')
        : !wasActive.current ? tr('Cannot reach the host updater. Check the service on the server before trying again.', 'Impossibile contattare l’updater. Controlla il servizio sul server prima di riprovare.')
        : tr('Waiting for the server to reconnect. We keep checking automatically; leave this tab open.', 'In attesa della riconnessione al server. La verifica continua automaticamente; lascia aperta questa scheda.')}</p>}
      {(active || job?.logs) && <div className="account-update-log"><Label htmlFor="orbitpage-update-log">{tr('Update logs', 'Log aggiornamento')}</Label><pre ref={logs} id="orbitpage-update-log" tabIndex={0} aria-label={tr('Update logs', 'Log aggiornamento')}>{job?.logs || tr('Waiting for the host updater…', 'In attesa dell’updater sul server…')}</pre></div>}
      {job?.error && <p className="oss-account-error" role="alert">{job.error}</p>}
      {error && <p className="oss-account-error" role="alert">{error}</p>}
      {!active && job?.state !== 'completed' && status?.enabled && canInstall && requestedVersion && <div className="field">
        <Label htmlFor="update-current-password">{tr('Admin dashboard password', 'Password della dashboard amministratore')}</Label>
        <Input id="update-current-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
      </div>}
      {!active && status && !status.enabled && <>
        <p>{tr('Update with Docker Run or Compose using the guide below. Dashboard installation requires the host service, included in Linux and Proxmox installations or enabled once for an existing Docker container.', 'Aggiorna con Docker Run o Compose seguendo la guida. L’installazione dalla dashboard richiede il servizio host, incluso nelle installazioni Linux e Proxmox o attivato una volta per un container Docker esistente.')}</p>
        <a className="account-instance-release-link" href={UPDATE_GUIDE} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{tr('Update guide', 'Guida agli aggiornamenti')}</a>
      </>}
      <DialogFooter className="account-delete-actions">
        {!active && <Button className="account-secondary-action" type="button" variant="outline" onClick={() => { setShowResult(false); setPassword(''); onClose(); }}>{tr('Close', 'Chiudi')}</Button>}
        {connectionError && <Button className="account-secondary-action" type="button" variant="outline" disabled={checking} onClick={async () => { setChecking(true); try { await readStatus(); } finally { setChecking(false); } }}><RefreshCw className="h-4 w-4" />{checking ? tr('Checking…', 'Verifica…') : tr('Check status', 'Verifica stato')}</Button>}
        {!active && job?.state === 'completed' && !reloading && <Button className="account-primary-action" type="button" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" />{tr('Reload dashboard', 'Ricarica dashboard')}</Button>}
        {!active && job?.state !== 'completed' && status?.enabled && requestedVersion && canInstall && <Button className="account-primary-action" type="button" disabled={!password || connectionError} onClick={() => void install()}><Download className="h-4 w-4" />{tr('Install update', 'Installa aggiornamento')}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
