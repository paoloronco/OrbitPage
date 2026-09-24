import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, History, Info, RotateCcw } from '@/components/ui/material-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OrbitLoader, OrbitLoadingState } from '@/components/ui/orbit-loader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
      setMessage(tr('Version restored. Reloading…', 'Versione ripristinata. Ricaricamento…'));
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr('Restore failed.', 'Ripristino non riuscito.'));
      setRestoring(null);
    }
  };

  return <Card className="admin-version-history glass-card space-y-5 p-6">
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-primary/10 p-2 text-primary"><History className="h-5 w-5" /></span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold">{tr('Version history', 'Cronologia versioni')}</h3>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={tr('About version history', 'Informazioni sulla cronologia versioni')}>
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent align="start" className="max-w-80 px-3 py-2 text-xs leading-5" side="bottom">
                {tr('OrbitPage keeps the latest 25 page versions in this installation. Restoring creates a new version, so nothing is overwritten in place.', 'OrbitPage conserva le ultime 25 versioni della pagina in questa installazione. Il ripristino crea una nuova versione, quindi nulla viene sovrascritto sul posto.')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>

    {message && <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" role="status">{message}</p>}
    {loading ? <OrbitLoadingState compact state="searching" title={tr('Loading versions', 'Caricamento versioni')} description={tr('Reading the latest saved snapshots.', 'Lettura delle ultime versioni salvate.')} /> : history?.versions.length ? <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
      {history.versions.map((version) => <div className="flex items-center gap-3 bg-background px-4 py-3" key={version.revision}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Clock3 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {tr('Version', 'Versione')} {version.revision}
            {version.current && <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700"><CheckCircle2 className="h-3 w-3" />{tr('Current', 'Attuale')}</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{new Date(version.lastModified).toLocaleString(locale)}</span>
        </span>
        <Button type="button" variant="outline" size="sm" className="admin-action" disabled={version.current || restoring !== null} onClick={() => void restore(version.revision)}>
          {restoring === version.revision ? <OrbitLoader size={16} state="weaving" /> : <RotateCcw className="h-4 w-4" />}
          <span className="hidden sm:inline">{restoring === version.revision ? tr('Restoring', 'Ripristino') : tr('Restore', 'Ripristina')}</span>
        </Button>
      </div>)}
    </div> : <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{tr('Save your page to create the first restorable version.', 'Salva la pagina per creare la prima versione ripristinabile.')}</div>}
  </Card>;
}
