import { useEffect, useState } from 'react';
import { Database, Download, ExternalLink, RefreshCw, Sliders } from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_MODE } from '@/lib/config';
import { instanceDetailsApi, type InstanceDetails } from '@/lib/api-client';
import { useAppI18n } from '@/lib/i18n';
import { checkApplicationUpdate } from '@/lib/application-updates';

const formatBytes = (bytes: number | null) => bytes === null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1048576)} MiB`;

export function SelfHostedInstanceDetails({ canManageInstance, version, onInstallUpdate }: {
  canManageInstance: boolean; version: string; onInstallUpdate: (version: string) => void;
}) {
  const { tr } = useAppI18n();
  const [update, setUpdate] = useState<Awaited<ReturnType<typeof checkApplicationUpdate>> | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [instance, setInstance] = useState<InstanceDetails | null>(null);
  const [instanceError, setInstanceError] = useState('');
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [environmentChanges, setEnvironmentChanges] = useState<Record<string, string | null>>({});
  const [environmentPassword, setEnvironmentPassword] = useState('');
  const [environmentBusy, setEnvironmentBusy] = useState(false);
  const [environmentError, setEnvironmentError] = useState('');
  const [restartRequired, setRestartRequired] = useState(false);

  useEffect(() => {
    if (!canManageInstance) return;
    instanceDetailsApi.get().then(setInstance).catch(() => setInstanceError(tr('Instance details are unavailable.', 'Dettagli istanza non disponibili.')));
  }, [canManageInstance, tr]);

  const saveEnvironment = async () => {
    setEnvironmentBusy(true);
    setEnvironmentError('');
    try {
      const result = await instanceDetailsApi.saveEnvironment(environmentChanges, environmentPassword);
      setInstance((current) => current ? { ...current, environment: result.environment } : current);
      setEnvironmentChanges({});
      setEnvironmentPassword('');
      setRestartRequired(result.restartRequired);
      setEnvironmentOpen(false);
    } catch (reason) {
      setEnvironmentError(reason instanceof Error ? reason.message : tr('Could not save the variables.', 'Impossibile salvare le variabili.'));
    } finally { setEnvironmentBusy(false); }
  };

  const checkUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateError(false);
    setUpdate(null);
    try { setUpdate(await checkApplicationUpdate(version)); }
    catch { setUpdateError(true); }
    finally { setCheckingUpdates(false); }
  };

  return <>
      <Card className="glass-card p-6 account-panel account-instance-card">
        <div className="account-section-heading">
          <div><h2>{tr('Instance details', 'Dettagli istanza')}</h2></div>
          <Database className="h-6 w-6" aria-hidden="true" />
        </div>
        <dl className="account-details">
          <div className="account-detail-row"><dt>{tr('Runtime', 'Runtime')}</dt><dd>OrbitPage Open Source</dd></div>
          <div className="account-detail-row"><dt>{tr('Current version', 'Versione installata')}</dt><dd>v{version.replace(/^v/, '')}</dd></div>
          <div className="account-detail-row"><dt>{tr('Deployment', 'Distribuzione')}</dt><dd>{tr('Self-hosted', 'Self-hosted')}</dd></div>
          <div className="account-detail-row"><dt>{tr('Administration', 'Amministrazione')}</dt><dd>{tr('Managed by this installation', 'Gestita da questa installazione')}</dd></div>
          {canManageInstance && <>
            <div className="account-detail-row"><dt>{tr('Database path', 'Percorso DB')}</dt><dd><code>{instance?.databasePath || '—'}</code></dd></div>
            <div className="account-detail-row"><dt>DATA_DIR</dt><dd><code>{instance?.dataDir || '—'}</code></dd></div>
            <div className="account-detail-row"><dt>{tr('Space used', 'Spazio usato')}</dt><dd>{formatBytes(instance?.usedBytes ?? null)}</dd></div>
            <div className="account-detail-row"><dt>{tr('Uploads used', 'Spazio upload')}</dt><dd>{formatBytes(instance?.uploadBytes ?? null)}</dd></div>
          </>}
        </dl>
        {canManageInstance && <>
          {instanceError && <p className="oss-account-error" role="alert">{instanceError}</p>}
          <div className="instance-services">
            <strong>{tr('Services', 'Servizi')}</strong>
            <div>{([
              ['api', 'API'], ['database', 'SQLite'], ['dataDirectory', 'DATA_DIR'], ['uploads', tr('Uploads', 'Upload')],
            ] as const).map(([key, label]) => <span className={`instance-service ${instance?.services[key] ? 'is-ok' : 'is-down'}`} key={key}>
              <span aria-hidden="true" className="instance-service-dot" />{label}: {!instance ? tr('Checking…', 'Verifica…') : instance.services[key] ? tr('Ready', 'Attivo') : tr('Unavailable', 'Non disponibile')}
            </span>)}</div>
          </div>
          <div className="instance-environment-actions">
            <Button type="button" variant="outline" className="account-secondary-action" disabled={!instance} onClick={() => { setEnvironmentError(''); setEnvironmentOpen(true); }}><Sliders className="h-4 w-4" />{tr('Environment variables…', 'Variabili ambiente…')}</Button>
            {restartRequired && <span role="status">{tr('Restart the instance to apply the saved changes.', 'Riavvia l’istanza per applicare le modifiche salvate.')}</span>}
          </div>
        </>}
        <div className="account-instance-updates">
          <p className={updateError ? 'oss-account-error' : 'muted'} role="status" aria-live="polite">
            {checkingUpdates ? tr('Checking for updates…', 'Verifica aggiornamenti…')
              : updateError ? tr('Could not check for updates. Try again.', 'Impossibile verificare gli aggiornamenti. Riprova.')
              : update?.updateAvailable ? <>{tr('Update available:', 'Aggiornamento disponibile:')} <strong>v{update.version}</strong></>
              : update ? tr('You’re up to date.', 'La versione è aggiornata.')
              : tr('Check for a newer stable release.', 'Verifica se è disponibile una nuova versione stabile.')}
          </p>
          <div className="account-instance-update-actions">
            <Button type="button" className="account-secondary-action" variant="outline" disabled={checkingUpdates} aria-busy={checkingUpdates} onClick={() => void checkUpdates()}><RefreshCw className={`h-4 w-4${checkingUpdates ? ' animate-spin' : ''}`} />{tr('Check for updates', 'Verifica aggiornamenti')}</Button>
            <Button type="button" className="account-primary-action" variant="gradient" disabled={!update?.updateAvailable || checkingUpdates || DEMO_MODE || !canManageInstance} onClick={() => update && onInstallUpdate(update.version)}><Download className="h-4 w-4" />{tr('Install update…', 'Installa aggiornamento…')}</Button>
          </div>
          {update && <a className="account-instance-release-link" href={update.releaseUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />{tr('Release notes', 'Note di rilascio')}</a>}
        </div>
      </Card>

    <Dialog open={environmentOpen} onOpenChange={(open) => { if (!environmentBusy) { setEnvironmentOpen(open); if (!open) { setEnvironmentChanges({}); setEnvironmentPassword(''); } } }}>
      <DialogContent dirty={environmentBusy || Object.keys(environmentChanges).length > 0 || Boolean(environmentPassword)} className="orbitpage-admin oss-account-delete-dialog instance-environment-dialog" overlayClassName="oss-account-delete-overlay">
        <DialogHeader className="account-delete-header"><DialogTitle>{tr('Environment variables', 'Variabili ambiente')}</DialogTitle></DialogHeader>
        <DialogDescription>{tr('Existing values are hidden. Enter a new value to replace one, or remove an override to use the host setting. Changes take effect after a restart.', 'I valori esistenti sono nascosti. Inserisci un nuovo valore per sostituirlo, oppure rimuovi una modifica per usare il valore del server. Le modifiche hanno effetto dopo un riavvio.')}</DialogDescription>
        <div className="instance-environment-fields">
          {instance?.environment.map((entry) => <div className="instance-environment-field" key={entry.key}>
            <div><Label htmlFor={`instance-env-${entry.key}`}>{entry.label} <code>{entry.key}</code></Label><span>{entry.overridden ? tr('Override saved', 'Modifica salvata') : entry.configured ? tr('Set on host', 'Impostata sul server') : tr('Not set', 'Non impostata')}</span></div>
            <div className="instance-environment-input"><Input id={`instance-env-${entry.key}`} type="password" autoComplete="off" placeholder={entry.configured ? '••••••••' : tr('New value', 'Nuovo valore')} value={environmentChanges[entry.key] ?? ''} disabled={environmentBusy} onChange={(event) => setEnvironmentChanges((current) => { const next = { ...current }; if (event.target.value) next[entry.key] = event.target.value; else delete next[entry.key]; return next; })} />
              {entry.overridden && <Button type="button" variant="outline" disabled={environmentBusy} onClick={() => setEnvironmentChanges((current) => ({ ...current, [entry.key]: null }))}>{tr('Use host', 'Usa server')}</Button>}
            </div>
            {Object.prototype.hasOwnProperty.call(environmentChanges, entry.key) && <small>{environmentChanges[entry.key] === null ? tr('Override will be removed', 'La modifica sarà rimossa') : tr('New value ready to save', 'Nuovo valore pronto da salvare')}</small>}
          </div>)}
          <div className="field"><Label htmlFor="instance-env-password">{tr('Current password', 'Password attuale')}</Label><Input id="instance-env-password" type="password" autoComplete="current-password" value={environmentPassword} onChange={(event) => setEnvironmentPassword(event.target.value)} disabled={environmentBusy} /></div>
          {environmentError && <p className="oss-account-error" role="alert">{environmentError}</p>}
        </div>
        <DialogFooter className="account-delete-actions"><Button type="button" variant="outline" className="account-secondary-action" disabled={environmentBusy} onClick={() => setEnvironmentOpen(false)}>{tr('Cancel', 'Annulla')}</Button><Button type="button" variant="gradient" disabled={environmentBusy || !environmentPassword || !Object.keys(environmentChanges).length || DEMO_MODE} onClick={() => void saveEnvironment()}>{environmentBusy ? tr('Saving…', 'Salvataggio…') : tr('Save changes', 'Salva modifiche')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
