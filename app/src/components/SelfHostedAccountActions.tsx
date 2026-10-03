import { FormEvent, useEffect, useState } from 'react';
import { Database, Download, ExternalLink, Globe2, LifeBuoy, Mail, RefreshCw, ShieldCheck, Sliders, Trash2 } from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_MODE } from '@/lib/config';
import { authApi, instanceDetailsApi, personalPageApi, type InstanceDetails, type PersonalPageStatus } from '@/lib/api-client';
import { withBasePath } from '@/lib/base-path';
import { useAppI18n } from '@/lib/i18n';
import { checkApplicationUpdate } from '@/lib/application-updates';

const SUPPORT_EMAIL = 'contact@orbitpage.com';
const formatBytes = (bytes: number | null) => bytes === null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / 1048576)} MiB`;

export function SelfHostedAccountActions({ canDeleteInstallation, publicPageHref, role, username, version, onInstallUpdate }: { canDeleteInstallation: boolean; publicPageHref: string; role: string; username: string; version: string; onInstallUpdate: (version: string) => void }) {
  const { tr } = useAppI18n();
  const [update, setUpdate] = useState<Awaited<ReturnType<typeof checkApplicationUpdate>> | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [status, setStatus] = useState<PersonalPageStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountConfirmation, setAccountConfirmation] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [instance, setInstance] = useState<InstanceDetails | null>(null);
  const [instanceError, setInstanceError] = useState('');
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [environmentChanges, setEnvironmentChanges] = useState<Record<string, string | null>>({});
  const [environmentPassword, setEnvironmentPassword] = useState('');
  const [environmentBusy, setEnvironmentBusy] = useState(false);
  const [environmentError, setEnvironmentError] = useState('');
  const [restartRequired, setRestartRequired] = useState(false);

  useEffect(() => {
    personalPageApi.status().then(setStatus).catch((reason) => setError(reason instanceof Error ? reason.message : tr('Unable to load the public page status.', 'Impossibile caricare lo stato della pagina pubblica.')));
  }, [tr]);

  useEffect(() => {
    if (!canDeleteInstallation) return;
    instanceDetailsApi.get().then(setInstance).catch(() => setInstanceError(tr('Instance details are unavailable.', 'Dettagli istanza non disponibili.')));
  }, [canDeleteInstallation, tr]);

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

  const removePage = async () => {
    if (!status) return;
    setBusy(true);
    setError('');
    try {
      setStatus(await personalPageApi.remove(confirmation, currentPassword));
      setDialogOpen(false);
      setConfirmation('');
      setCurrentPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('The public page could not be removed.', 'Non è stato possibile rimuovere la pagina pubblica.'));
    } finally {
      setBusy(false);
    }
  };

  const createPage = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await personalPageApi.create();
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('The public page could not be created.', 'Non è stato possibile creare la pagina pubblica.'));
      setBusy(false);
    }
  };

  const expected = status ? `REMOVE ${status.confirmationLabel}` : '';
  const expectedAccountConfirmation = 'DELETE ORBITPAGE';

  const deleteInstallation = async () => {
    if (!canDeleteInstallation) return;
    setAccountBusy(true);
    setAccountError('');
    try {
      const result = await authApi.reset(accountPassword);
      if (!result.success) throw new Error(result.error || tr('Account deletion failed.', 'Eliminazione account non riuscita.'));
      authApi.logout();
      window.location.href = withBasePath('/dashboard/account');
    } catch (reason) {
      setAccountError(reason instanceof Error ? reason.message : tr('The account could not be deleted.', 'Non è stato possibile eliminare l’account.'));
      setAccountBusy(false);
    }
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
    <div className="account-info-stack account-general-info">
      <Card className="glass-card p-6 account-panel oss-account-details-card">
        <div className="account-section-heading">
          <div><p className="oss-account-kicker">{tr('Identity', 'Identità')}</p><h2>{tr('Account details', 'Dettagli account')}</h2></div>
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <dl className="account-details">
          <div className="account-detail-row"><dt>{tr('Username', 'Nome utente')}</dt><dd>{username}</dd></div>
          <div className="account-detail-row"><dt>{tr('Public URL', 'URL pubblico')}</dt><dd>{publicPageHref}</dd></div>
          <div className="account-detail-row"><dt>{tr('Edition', 'Edizione')}</dt><dd>Open Source</dd></div>
          <div className="account-detail-row"><dt>{tr('Role', 'Ruolo')}</dt><dd>{role}</dd></div>
          <div className="account-detail-row"><dt>{tr('Login method', 'Metodo di accesso')}</dt><dd><span className="login-method">Password</span></dd></div>
        </dl>
      </Card>

      <Card className="glass-card p-6 account-panel account-instance-card">
        <div className="account-section-heading">
          <div><p className="oss-account-kicker">{tr('Installation', 'Installazione')}</p><h2>{tr('Instance details', 'Dettagli istanza')}</h2></div>
          <Database className="h-6 w-6" aria-hidden="true" />
        </div>
        <dl className="account-details">
          <div className="account-detail-row"><dt>{tr('Runtime', 'Runtime')}</dt><dd>OrbitPage Open Source</dd></div>
          <div className="account-detail-row"><dt>{tr('Current version', 'Versione installata')}</dt><dd>v{version.replace(/^v/, '')}</dd></div>
          <div className="account-detail-row"><dt>{tr('Deployment', 'Distribuzione')}</dt><dd>{tr('Self-hosted', 'Self-hosted')}</dd></div>
          <div className="account-detail-row"><dt>{tr('Administration', 'Amministrazione')}</dt><dd>{tr('Managed by this installation', 'Gestita da questa installazione')}</dd></div>
          {canDeleteInstallation && <>
            <div className="account-detail-row"><dt>{tr('Database path', 'Percorso DB')}</dt><dd><code>{instance?.databasePath || '—'}</code></dd></div>
            <div className="account-detail-row"><dt>DATA_DIR</dt><dd><code>{instance?.dataDir || '—'}</code></dd></div>
            <div className="account-detail-row"><dt>{tr('Space used', 'Spazio usato')}</dt><dd>{formatBytes(instance?.usedBytes ?? null)}</dd></div>
            <div className="account-detail-row"><dt>{tr('Uploads used', 'Spazio upload')}</dt><dd>{formatBytes(instance?.uploadBytes ?? null)}</dd></div>
          </>}
        </dl>
        {canDeleteInstallation && <>
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
            <Button type="button" className="account-primary-action" variant="gradient" disabled={!update?.updateAvailable || checkingUpdates || DEMO_MODE || !canDeleteInstallation} onClick={() => update && onInstallUpdate(update.version)}><Download className="h-4 w-4" />{tr('Install update…', 'Installa aggiornamento…')}</Button>
          </div>
          {update && <a className="account-instance-release-link" href={update.releaseUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />{tr('Release notes', 'Note di rilascio')}</a>}
        </div>
      </Card>
    </div>

    <Card className="glass-card p-6 account-support oss-account-support-card">
      <div className="account-support-copy">
        <LifeBuoy className="h-6 w-6" aria-hidden="true" />
        <div>
          <p className="oss-account-kicker">{tr('Support', 'Supporto')}</p>
          <h2>{tr('Need help with your account?', 'Hai bisogno di aiuto con il tuo account?')}</h2>
          <p className="muted">{tr('Contact OrbitPage support for account, access, or publishing issues.', 'Contatta il supporto OrbitPage per problemi relativi ad account, accesso o pubblicazione.')}</p>
        </div>
      </div>
      <a className="account-secondary-action" href={`mailto:${SUPPORT_EMAIL}?subject=OrbitPage%20OSS%20support`}><Mail className="h-4 w-4" aria-hidden="true" />{tr('Email support', 'Scrivi al supporto')}</a>
    </Card>

    <Card className="glass-card p-6 account-personal-page oss-account-page-card">
      <div className="oss-account-action-copy">
        <Globe2 className="h-6 w-6" aria-hidden="true" />
        <div>
          <p className="oss-account-kicker">{tr('Personal page', 'Pagina personale')}</p>
          <h2>{status?.active ? tr('Your public OrbitPage', 'La tua OrbitPage pubblica') : tr('Public page removed', 'Pagina pubblica rimossa')}</h2>
          <p>{status?.active
            ? tr('Removing it permanently deletes its content, versions, and uploaded media while keeping account access and security settings.', 'La rimozione elimina definitivamente contenuti, versioni e media caricati, mantenendo l’accesso all’account e le impostazioni di sicurezza.')
            : tr('Create a new empty public page whenever you are ready.', 'Crea una nuova pagina pubblica vuota quando vuoi.')}</p>
        </div>
      </div>
      {status?.active ? <div className="oss-account-page-action">
        <div><strong>{publicPageHref}</strong><span>{tr('Published', 'Pubblicata')}</span></div>
        <Button className="account-danger-action" type="button" variant="destructive" disabled={DEMO_MODE} onClick={() => { setError(''); setDialogOpen(true); }}><Trash2 className="h-4 w-4" />{tr('Remove personal page', 'Rimuovi pagina personale')}</Button>
      </div> : status ? <form className="oss-account-page-create" onSubmit={createPage}>
        <div><strong>{publicPageHref}</strong></div>
        <Button type="submit" variant="gradient" disabled={busy || DEMO_MODE}><Globe2 className="h-4 w-4" />{tr('Create personal page', 'Crea pagina personale')}</Button>
      </form> : null}
      {error && <p className="oss-account-error" role="alert">{error}</p>}
    </Card>

    <Card className="glass-card p-6 account-danger-zone oss-account-danger-card">
      <div className="account-danger-copy">
        <Trash2 className="h-6 w-6" aria-hidden="true" />
        <div><p className="oss-account-kicker">{tr('Danger zone', 'Zona pericolosa')}</p><h2>{tr('Delete account', 'Elimina account')}</h2><p className="muted">{tr('Permanently removes administrator accounts, page data, uploads, settings, and authentication configuration.', 'Rimuove definitivamente account amministratori, dati della pagina, caricamenti, impostazioni e configurazione di autenticazione.')}</p></div>
      </div>
      <Button className="account-danger-action" type="button" variant="destructive" disabled={DEMO_MODE || !canDeleteInstallation} onClick={() => { setAccountError(''); setAccountDialogOpen(true); }}><Trash2 className="h-4 w-4" />{tr('Delete account', 'Elimina account')}</Button>
    </Card>


    <Dialog open={environmentOpen} onOpenChange={(open) => { if (!environmentBusy) { setEnvironmentOpen(open); if (!open) { setEnvironmentChanges({}); setEnvironmentPassword(''); } } }}>
      <DialogContent className="orbitpage-admin oss-account-delete-dialog instance-environment-dialog" overlayClassName="oss-account-delete-overlay">
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

    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!busy) setDialogOpen(open); }}>
      <DialogContent className="orbitpage-admin oss-account-delete-dialog" overlayClassName="oss-account-delete-overlay">
        <DialogHeader className="account-delete-header">
          <DialogTitle>{tr('Remove your personal OrbitPage?', 'Rimuovere la tua OrbitPage personale?')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{tr('This permanently deletes public content, page versions, and uploaded media. Your administrator login and two-factor settings remain active. Export a backup first if you may need this data.', 'Questa operazione elimina definitivamente contenuti pubblici, versioni della pagina e media caricati. Login amministratore e verifica in due passaggi restano attivi. Esporta prima un backup se potresti aver bisogno di questi dati.')}</DialogDescription>
        <div className="account-delete-fields">
          <div className="field"><Label htmlFor="remove-page-confirmation">{tr(`Type ${expected} to confirm`, `Scrivi ${expected} per confermare`)}</Label><Input id="remove-page-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></div>
          <div className="field"><Label htmlFor="remove-page-password">{tr('Current password', 'Password attuale')}</Label><Input id="remove-page-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={busy} /></div>
          {error && <p className="oss-account-error" role="alert">{error}</p>}
        </div>
        <DialogFooter className="account-delete-actions">
          <Button type="button" className="account-secondary-action" variant="outline" disabled={busy} onClick={() => setDialogOpen(false)}>{tr('Cancel', 'Annulla')}</Button>
          <Button type="button" className="account-danger-action" variant="destructive" disabled={busy || confirmation !== expected || !currentPassword} onClick={() => void removePage()}><Trash2 className="h-4 w-4" />{busy ? tr('Removing…', 'Rimozione…') : tr('Remove page permanently', 'Rimuovi pagina definitivamente')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={accountDialogOpen} onOpenChange={(open) => { if (!accountBusy) setAccountDialogOpen(open); }}>
      <DialogContent className="orbitpage-admin oss-account-delete-dialog" overlayClassName="oss-account-delete-overlay">
        <DialogHeader className="account-delete-header">
          <DialogTitle>{tr("Delete your OrbitPage account?", "Eliminare l'account OrbitPage?")}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{tr('This permanently removes every administrator, page, upload, and setting from this installation. Export a backup first if you may need this data.', 'Questa operazione rimuove definitivamente tutti gli amministratori, le pagine, i caricamenti e le impostazioni dall’installazione. Esporta prima un backup se potresti aver bisogno di questi dati.')}</DialogDescription>
        <div className="account-delete-fields">
          <div className="field"><Label htmlFor="delete-account-confirmation">{tr(`Type ${expectedAccountConfirmation} to confirm`, `Scrivi ${expectedAccountConfirmation} per confermare`)}</Label><Input id="delete-account-confirmation" autoComplete="off" value={accountConfirmation} onChange={(event) => setAccountConfirmation(event.target.value)} disabled={accountBusy} /></div>
          <div className="field"><Label htmlFor="delete-account-password">{tr('Current password', 'Password attuale')}</Label><Input id="delete-account-password" type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} disabled={accountBusy} /></div>
          {accountError && <p className="oss-account-error" role="alert">{accountError}</p>}
        </div>
        <DialogFooter className="account-delete-actions">
          <Button type="button" className="account-secondary-action" variant="outline" disabled={accountBusy} onClick={() => setAccountDialogOpen(false)}>{tr('Cancel', 'Annulla')}</Button>
          <Button type="button" className="account-danger-action" variant="destructive" disabled={accountBusy || accountConfirmation !== expectedAccountConfirmation || !accountPassword} onClick={() => void deleteInstallation()}><Trash2 className="h-4 w-4" />{accountBusy ? tr('Deleting…', 'Eliminazione…') : tr('Delete permanently', 'Elimina definitivamente')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
