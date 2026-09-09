import { FormEvent, useEffect, useState } from 'react';
import { Globe2, LifeBuoy, Mail, Trash2 } from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_MODE } from '@/lib/config';
import { personalPageApi, type PersonalPageStatus } from '@/lib/api-client';
import { useAppI18n } from '@/lib/i18n';

const SUPPORT_EMAIL = 'contact@orbitpage.com';

export function SelfHostedAccountActions({ publicPageHref }: { publicPageHref: string }) {
  const { tr } = useAppI18n();
  const [status, setStatus] = useState<PersonalPageStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [slug, setSlug] = useState('');

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
      await personalPageApi.create(slug);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('The public page could not be created.', 'Non è stato possibile creare la pagina pubblica.'));
      setBusy(false);
    }
  };

  const expected = status ? `REMOVE ${status.confirmationLabel}` : '';

  return <>
    <Card className="glass-card p-6 oss-account-support-card">
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

    <Card className="glass-card p-6 oss-account-page-card">
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
        <div><Label htmlFor="new-personal-page-slug">{tr('Page slug', 'Slug pagina')}</Label><Input id="new-personal-page-slug" minLength={3} maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="your-page" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} required /></div>
        <Button type="submit" variant="gradient" disabled={busy || DEMO_MODE}><Globe2 className="h-4 w-4" />{tr('Create personal page', 'Crea pagina personale')}</Button>
      </form> : null}
      {error && <p className="oss-account-error" role="alert">{error}</p>}
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
  </>;
}
