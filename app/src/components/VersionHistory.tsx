import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, History, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { versionHistoryApi, type ManagedVersionHistory } from '@/lib/api-client';
import { useAppI18n } from '@/lib/i18n';

export function VersionHistory() {
  const { locale, tr } = useAppI18n();
  const [history, setHistory] = useState<ManagedVersionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHistory(await versionHistoryApi.list());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr('Version history could not be loaded.', 'Impossibile caricare la cronologia.'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { void load(); }, [load]);

  const restore = async (revision: number) => {
    const confirmed = window.confirm(tr(
      `Restore version ${revision}? Your current page will remain in history as a newer version.`,
      `Ripristinare la versione ${revision}? La pagina attuale resterà nella cronologia come versione più recente.`,
    ));
    if (!confirmed) return;
    setRestoring(revision);
    setMessage('');
    try {
      await versionHistoryApi.restore(revision);
      setMessage(tr('Version restored and published. Reloading…', 'Versione ripristinata e pubblicata. Ricaricamento…'));
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr('Restore failed.', 'Ripristino non riuscito.'));
      setRestoring(null);
    }
  };

  return <Card className="glass-card space-y-5 p-6">
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-primary/10 p-2 text-primary"><History className="h-5 w-5" /></span>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold">{tr('Version history', 'Cronologia versioni')}</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {tr('OrbitPage keeps the latest 25 published versions. Restoring creates a new version, so nothing is overwritten in place.', 'OrbitPage conserva le ultime 25 versioni pubblicate. Il ripristino crea una nuova versione, quindi nulla viene sovrascritto sul posto.')}
        </p>
      </div>
    </div>

    {message && <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" role="status">{message}</p>}
    {loading ? <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin [animation-duration:1.2s]" />{tr('Loading versions', 'Caricamento versioni')}</div> : history?.versions.length ? <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
      {history.versions.map((version) => <div className="flex items-center gap-3 bg-background px-4 py-3" key={version.revision}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Clock3 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {tr('Version', 'Versione')} {version.revision}
            {version.current && <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700"><CheckCircle2 className="h-3 w-3" />{tr('Published', 'Pubblicata')}</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{new Date(version.lastModified).toLocaleString(locale === 'it' ? 'it-IT' : 'en-GB')}</span>
        </span>
        <Button type="button" variant="outline" size="sm" className="admin-action" disabled={version.current || restoring !== null} onClick={() => void restore(version.revision)}>
          {restoring === version.revision ? <Loader2 className="h-4 w-4 animate-spin [animation-duration:1.2s]" /> : <RotateCcw className="h-4 w-4" />}
          <span className="hidden sm:inline">{restoring === version.revision ? tr('Restoring', 'Ripristino') : tr('Restore', 'Ripristina')}</span>
        </Button>
      </div>)}
    </div> : <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{tr('Publish your page to create the first restorable version.', 'Pubblica la pagina per creare la prima versione ripristinabile.')}</div>}
  </Card>;
}
