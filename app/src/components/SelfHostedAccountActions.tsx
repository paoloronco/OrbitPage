import { FormEvent, useEffect, useState } from 'react';
import { Globe2, LifeBuoy, Mail, ShieldCheck, Trash2 } from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_MODE } from '@/lib/config';
import { authApi, personalPageApi, type PersonalPageStatus } from '@/lib/api-client';
import { withBasePath } from '@/lib/base-path';
import { useAppI18n } from '@/lib/i18n';

const SUPPORT_EMAIL = 'contact@orbitpage.com';

export function SelfHostedAccountActions({ canDeleteInstallation, publicPageHref, role, username }: { canDeleteInstallation: boolean; publicPageHref: string; role: string; username: string }) {
  const { tr } = useAppI18n();
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

  useEffect(() => {
    personalPageApi.status().then(setStatus).catch((reason) => setError(reason instanceof Error ? reason.message : tr('Unable to load the public page status.', 'Impossibile caricare lo stato della pagina pubblica.')));
  }, [tr]);

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

      <Card className="glass-card p-6 account-panel oss-account-marketing-card">
        <div className="account-section-heading"><div><h2>{tr('Marketing email', 'Email marketing')}</h2><p className="muted">{tr('Control product updates sent by OrbitPage.', 'Controlla gli aggiornamenti di prodotto inviati da OrbitPage.')}</p></div></div>
        <label className="marketing-preference-check"><input checked={false} disabled readOnly type="checkbox" /><span>{tr('This self-hosted installation does not collect an account email or send platform marketing messages.', 'Questa installazione self-hosted non raccoglie un’email account e non invia messaggi marketing della piattaforma.')}</span></label>
      </Card>
    </div>

    <Card className="glass-card p-6 account-support oss-account-support-card">
      <div className="oss-account-action-copy">
        <LifeBuoy className="h-6 w-6" aria-hidden="true" />
        <div>
          <p className="oss-account-kicker">{tr('Support', 'Supporto')}</p>
          <h2>{tr('Need help with your account?', 'Hai bisogno di aiuto con il tuo account?')}</h2>
          <p>{tr('Contact OrbitPage support for errors, reports, feedback, or publishing issues.', 'Contatta il supporto OrbitPage per errori, segnalazioni, feedback o problemi di pubblicazione.')}</p>
        </div>
      </div>
      <a className="oss-account-secondary-action" href={`mailto:${SUPPORT_EMAIL}?subject=OrbitPage%20OSS%20support`}><Mail className="h-4 w-4" aria-hidden="true" />{tr('Email support', 'Scrivi al supporto')}</a>
    </Card>

    <Card className="glass-card p-6 account-personal-page oss-account-page-card">
      <div className="oss-account-action-copy">
        <Globe2 className="h-6 w-6" aria-hidden="true" />
        <div>
          <p className="oss-account-kicker">{tr('Personal page', 'Pagina personale')}</p>
          <h2>{status?.active ? tr('Your public OrbitPage', 'La tua OrbitPage pubblica') : tr('Public page removed', 'Pagina pubblica rimossa')}</h2>
          <p>{status?.active
            ? tr('Removing it permanently deletes its content, versions, and uploaded media while keeping administrator access and security settings.', 'La rimozione elimina definitivamente contenuti, versioni e media caricati, mantenendo l’accesso amministratore e le impostazioni di sicurezza.')
            : tr('Create a new empty public page whenever you are ready.', 'Crea una nuova pagina pubblica vuota quando vuoi.')}</p>
        </div>
      </div>
      {status?.active ? <div className="oss-account-page-action">
        <div><strong>{publicPageHref}</strong><span>{tr('Published', 'Pubblicata')}</span></div>
        <Button type="button" variant="destructive" disabled={DEMO_MODE} onClick={() => { setError(''); setDialogOpen(true); }}><Trash2 className="h-4 w-4" />{tr('Remove personal page', 'Rimuovi pagina personale')}</Button>
      </div> : status ? <form className="oss-account-page-create" onSubmit={createPage}>
        <div><strong>{publicPageHref}</strong></div>
        <Button type="submit" variant="gradient" disabled={busy || DEMO_MODE}><Globe2 className="h-4 w-4" />{tr('Create personal page', 'Crea pagina personale')}</Button>
      </form> : null}
      {error && <p className="oss-account-error" role="alert">{error}</p>}
    </Card>

    <Card className="glass-card p-6 account-danger-zone oss-account-danger-card">
      <div className="account-danger-copy">
        <Trash2 className="h-6 w-6" aria-hidden="true" />
        <div><p className="oss-account-kicker">{tr('Danger zone', 'Zona pericolosa')}</p><h2>{tr('Delete account and installation', 'Elimina account e installazione')}</h2><p className="muted">{tr('Permanently removes administrator accounts, page data, uploads, settings, and authentication configuration.', 'Rimuove definitivamente account amministratori, dati della pagina, caricamenti, impostazioni e configurazione di autenticazione.')}</p></div>
      </div>
      <Button type="button" variant="destructive" disabled={DEMO_MODE || !canDeleteInstallation} onClick={() => { setAccountError(''); setAccountDialogOpen(true); }}><Trash2 className="h-4 w-4" />{tr('Delete account', 'Elimina account')}</Button>
    </Card>

    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!busy) setDialogOpen(open); }}>
      <DialogContent className="oss-account-delete-dialog" overlayClassName="oss-account-delete-overlay">
        <DialogHeader>
          <DialogTitle>{tr('Remove your personal OrbitPage?', 'Rimuovere la tua OrbitPage personale?')}</DialogTitle>
          <DialogDescription>{tr('This permanently deletes public content, page versions, and uploaded media. Your administrator login and two-factor settings remain active. Export a backup first if you may need this data.', 'Questa operazione elimina definitivamente contenuti pubblici, versioni della pagina e media caricati. Login amministratore e verifica in due passaggi restano attivi. Esporta prima un backup se potresti aver bisogno di questi dati.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="remove-page-confirmation">{tr(`Type ${expected} to confirm`, `Scrivi ${expected} per confermare`)}</Label><Input id="remove-page-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor="remove-page-password">{tr('Current password', 'Password attuale')}</Label><Input id="remove-page-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={busy} /></div>
          {error && <p className="oss-account-error" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setDialogOpen(false)}>{tr('Cancel', 'Annulla')}</Button>
          <Button type="button" variant="destructive" disabled={busy || confirmation !== expected || !currentPassword} onClick={() => void removePage()}><Trash2 className="h-4 w-4" />{busy ? tr('Removing…', 'Rimozione…') : tr('Remove page permanently', 'Rimuovi pagina definitivamente')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={accountDialogOpen} onOpenChange={(open) => { if (!accountBusy) setAccountDialogOpen(open); }}>
      <DialogContent className="oss-account-delete-dialog" overlayClassName="oss-account-delete-overlay">
        <DialogHeader>
          <DialogTitle>{tr('Delete the account and reset OrbitPage?', 'Eliminare l’account e ripristinare OrbitPage?')}</DialogTitle>
          <DialogDescription>{tr('This permanently removes every administrator, page, upload, and setting from this installation. Export a backup first if you may need this data.', 'Questa operazione rimuove definitivamente tutti gli amministratori, le pagine, i caricamenti e le impostazioni dall’installazione. Esporta prima un backup se potresti aver bisogno di questi dati.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="delete-account-confirmation">{tr(`Type ${expectedAccountConfirmation} to confirm`, `Scrivi ${expectedAccountConfirmation} per confermare`)}</Label><Input id="delete-account-confirmation" autoComplete="off" value={accountConfirmation} onChange={(event) => setAccountConfirmation(event.target.value)} disabled={accountBusy} /></div>
          <div className="space-y-2"><Label htmlFor="delete-account-password">{tr('Current password', 'Password attuale')}</Label><Input id="delete-account-password" type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} disabled={accountBusy} /></div>
          {accountError && <p className="oss-account-error" role="alert">{accountError}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={accountBusy} onClick={() => setAccountDialogOpen(false)}>{tr('Cancel', 'Annulla')}</Button>
          <Button type="button" variant="destructive" disabled={accountBusy || accountConfirmation !== expectedAccountConfirmation || !accountPassword} onClick={() => void deleteInstallation()}><Trash2 className="h-4 w-4" />{accountBusy ? tr('Deleting…', 'Eliminazione…') : tr('Delete permanently', 'Elimina definitivamente')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
