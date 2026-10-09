"use client";

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Info, RefreshCw, ShieldCheck, AlertTriangle } from './ui/material-icons';
import { OrbitLoader } from './ui/orbit-loader';

type CheckStatus = 'ok' | 'warning' | 'error' | 'unavailable';
export type AccountInfoData = {
  checkedAt: string;
  shop: null | {
    published: boolean;
    stripe: { connected: boolean; ready: boolean; livemode: boolean | null };
    email: { mode: 'platform' | 'custom'; configured: boolean; verifiedAt: string | null };
    calendar: { configured: boolean; webhookVerified: boolean };
  };
  instance?: {
    version: string; node: string; uptime: number;
    checks: Array<{ id: string; status: CheckStatus }>;
    audit: { status: CheckStatus; checkedAt: string; counts: Record<'critical' | 'high' | 'moderate' | 'low', number> | null };
  };
};

export default function AccountInfo({ request, tr, documentationUrl, faqUrl }: {
  request: () => Promise<AccountInfoData>;
  tr: (english: string, italian: string) => string;
  documentationUrl: string; faqUrl: string;
}) {
  const [data, setData] = useState<AccountInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setFailed(false); setData(null);
    request().then(result => { if (!cancelled) setData(result); }, () => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [request, refresh]);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  const status = (value: CheckStatus) => <span className={`account-info-status is-${value}`}>
    {value === 'ok' ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
    {value === 'ok' ? tr('OK', 'OK') : value === 'warning' ? tr('Needs attention', 'Da verificare') : value === 'error' ? tr('Check failed', 'Controllo fallito') : tr('Not verified', 'Non verificato')}
  </span>;
  const labels: Record<string, string> = {
    runtime: tr('Supported Node.js runtime', 'Runtime Node.js supportato'), database: tr('SQLite integrity', 'Integrità SQLite'),
    data: tr('Writable data directory', 'Cartella dati scrivibile'), uploads: tr('Writable uploads directory', 'Cartella upload scrivibile'),
    disk: tr('Free disk space', 'Spazio disco disponibile'),
    build: tr('Application build', 'Build applicazione'), dependencies: tr('Server dependencies', 'Dipendenze server'),
    permissions: tr('Private data permissions', 'Permessi dei dati privati'), https: tr('HTTPS connection', 'Connessione HTTPS'),
    sessionSecret: tr('Session signing secret', 'Segreto di firma sessioni'), securityHeaders: tr('Security headers', 'Header di sicurezza'),
    vulnerabilities: tr('Known dependency vulnerabilities', 'Vulnerabilità note delle dipendenze'),
  };
  return <div className="account-info-workspace" aria-labelledby="account-info-title">
    <section className="account-info-panel">
      <header className="account-info-heading"><div><h2 id="account-info-title">INFO</h2><p>{tr('Current configuration and service status.', 'Configurazione attuale e stato dei servizi.')}</p></div>
        <button type="button" className="account-info-refresh" disabled={loading} aria-busy={loading} onClick={reload}><RefreshCw aria-hidden="true" />{tr('Refresh', 'Aggiorna')}</button></header>
      {loading && <div role="status" className="account-info-loading"><OrbitLoader size={24} />{tr('Checking…', 'Verifica…')}</div>}
      {failed && <p role="alert">{tr('Information could not be verified. Refresh to try again.', 'Impossibile verificare le informazioni. Aggiorna per riprovare.')}</p>}
      {data && <>
        {!data.shop ? <p>{tr('Shop information is unavailable for this account.', 'Informazioni Shop non disponibili per questo account.')}</p> : <dl className="account-info-details">
          <div><dt>Shop</dt><dd>{data.shop.published ? tr('Published', 'Pubblicato') : tr('Unpublished', 'Non pubblicato')}</dd></div>
          <div><dt>Stripe</dt><dd><span>{data.shop.stripe.connected ? tr('Connected', 'Connesso') : tr('Not connected', 'Non connesso')}</span>
            {data.shop.stripe.connected && <small>{data.shop.stripe.ready ? tr('Payments ready', 'Pagamenti pronti') : tr('Payment setup incomplete', 'Setup pagamenti incompleto')}{data.shop.stripe.livemode === false ? <> · <span className="account-info-test-mode">{tr('Test mode', 'Modalità test')}</span></> : data.shop.stripe.livemode === true ? <> · {tr('Live mode', 'Modalità live')}</> : null}</small>}</dd></div>
          <div><dt>{tr('Shop email', 'Email Shop')}</dt><dd><span>{data.shop.email.mode === 'platform' ? tr('OrbitPage email', 'Email OrbitPage') : tr('Own SMTP server', 'Server SMTP proprio')}</span>
            <small>{!data.shop.email.configured ? tr('Not configured', 'Non configurato') : data.shop.email.mode === 'platform' ? tr('Configured', 'Configurato') : data.shop.email.verifiedAt ? tr('SMTP test successful', 'Test SMTP riuscito') : tr('SMTP test required', 'Test SMTP richiesto')}</small></dd></div>
          <div><dt>{tr('Calendar', 'Calendario')}</dt><dd><span>{data.shop.calendar.configured ? tr('Configured', 'Configurato') : tr('Not configured', 'Non configurato')}</span>
            <small>{data.shop.calendar.webhookVerified ? tr('Signed calendar webhook received', 'Webhook calendario firmato ricevuto') : tr('Calendar webhook not yet verified', 'Webhook calendario non ancora verificato')}</small></dd></div>
        </dl>}
        <p className="account-info-note"><Info aria-hidden="true" />{tr('Provider status reflects saved configuration and completed verifications. Refresh does not send an email or create a booking.', 'Lo stato dei provider riflette la configurazione salvata e le verifiche completate. Aggiorna non invia email e non crea prenotazioni.')}</p>
        <p className="account-info-timestamp">{tr('Checked at', 'Controllato il')}: <time dateTime={data.checkedAt}>{new Date(data.checkedAt).toLocaleString()}</time></p>
      </>}
    </section>
    {data?.instance && <section className="account-info-panel" aria-labelledby="account-health-title">
      <header className="account-info-heading"><div><h2 id="account-health-title">{tr('Instance health checks', 'Controlli di salute istanza')}</h2><p>OrbitPage v{data.instance.version} · Node.js {data.instance.node} · {tr('Uptime', 'Uptime')}: {data.instance.uptime}s</p></div><ShieldCheck aria-hidden="true" /></header>
      <p role="status">{data.instance.checks.every(check => check.status === 'ok') ? tr('All measured checks passed.', 'Tutti i controlli eseguiti sono passati.') : tr('Some checks need attention or could not be verified.', 'Alcuni controlli richiedono attenzione o non sono verificati.')}</p>
      <dl className="account-info-details">{data.instance.checks.map(check => <div key={check.id}><dt>{labels[check.id] || check.id}</dt><dd>{status(check.status)}</dd></div>)}</dl>
      {data.instance.audit.counts && <p className="account-info-note">{tr('Advisories', 'Segnalazioni')}: {tr('Critical', 'Critiche')} {data.instance.audit.counts.critical} · {tr('High', 'Alte')} {data.instance.audit.counts.high} · {tr('Moderate', 'Moderate')} {data.instance.audit.counts.moderate} · {tr('Low', 'Basse')} {data.instance.audit.counts.low}</p>}
      <p className="account-info-timestamp">{tr('Dependency audit checked at', 'Dipendenze controllate il')}: <time dateTime={data.instance.audit.checkedAt}>{new Date(data.instance.audit.checkedAt).toLocaleString()}</time></p>
      <p className="account-info-note">{tr('These checks cover this application and its production dependency inventory. Host security, backups, Windows permissions and external provider availability need separate verification.', 'Questi controlli coprono applicazione e inventario delle dipendenze di produzione. Sicurezza host, backup, permessi Windows e disponibilità dei provider esterni richiedono verifiche separate.')}</p>
    </section>}
    <section className="account-info-panel account-info-support"><a href={documentationUrl} target="_blank" rel="noopener noreferrer">{tr('Documentation', 'Documentazione')}<ExternalLink aria-hidden="true" /></a><a href={faqUrl} target="_blank" rel="noopener noreferrer">FAQ<ExternalLink aria-hidden="true" /></a></section>
  </div>;
}
