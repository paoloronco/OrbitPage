import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Eye, MousePointerClick, RefreshCw, UsersRound } from 'lucide-react';
import { managedAnalyticsApi, type ManagedAnalyticsDimension, type ManagedAnalyticsReport } from '@/lib/api-client';
import { useAppI18n } from '@/lib/i18n';

const EMPTY: ManagedAnalyticsReport = {
  configured: true,
  detailed: true,
  periodDays: 30,
  maxPeriodDays: 90,
  summary: { visits: 0, visitors: 0, clicks: 0, ctr: 0 },
  trend: [], sources: [], devices: [], countries: [], campaigns: [], links: [],
};

function Ranking({ title, items, empty }: { title: string; items: ManagedAnalyticsDimension[]; empty: string }) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return <section className="managed-analytics-ranking">
    <h3>{title}</h3>
    {items.length ? <div>{items.slice(0, 6).map((item) => <div className="managed-analytics-rank" key={item.label}>
      <span><b>{item.label}</b><em>{item.value.toLocaleString()}</em></span>
      <i><span style={{ width: `${Math.max(4, item.value / maximum * 100)}%` }} /></i>
    </div>)}</div> : <p>{empty}</p>}
  </section>;
}

export function ManagedAnalyticsDashboard() {
  const { locale, tr } = useAppI18n();
  const [period, setPeriod] = useState(30);
  const [report, setReport] = useState<ManagedAnalyticsReport>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (days: number) => {
    setLoading(true); setError('');
    try {
      const next = await managedAnalyticsApi.get(days);
      setReport(next);
      setPeriod(next.periodDays);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr('Analytics could not be loaded.', 'Impossibile caricare le analytics.'));
    } finally { setLoading(false); }
  }, [tr]);

  useEffect(() => { void load(period); }, [load, period]);
  const periods = useMemo(() => [7, 30, 90].filter((days) => days <= report.maxPeriodDays), [report.maxPeriodDays]);
  const number = (value: number) => value.toLocaleString(locale);

  return <section className="managed-analytics" data-testid="managed-analytics">
    <header className="managed-analytics-header">
      <div><span>{tr('Public page activity', 'Attività della pagina pubblica')}</span><h2>Analytics</h2><p>{tr('Visits and interactions collected at the edge, excluding Admin activity.', 'Visite e interazioni raccolte all’edge, senza contare l’attività nell’Admin.')}</p></div>
      <div className="managed-analytics-actions">
        <div role="group" aria-label={tr('Analytics range', 'Intervallo analytics')}>{periods.map((days) => <button aria-pressed={period === days} key={days} onClick={() => setPeriod(days)} type="button">{days}d</button>)}</div>
        <button aria-label={tr('Refresh analytics', 'Aggiorna analytics')} className="managed-analytics-refresh" disabled={loading} onClick={() => void load(period)} type="button"><RefreshCw className={loading ? 'is-loading' : ''} size={16} /></button>
      </div>
    </header>

    {!report.configured && <div className="managed-analytics-notice"><BarChart3 size={18} /><span><strong>{tr('Collection ready, reporting needs configuration', 'Raccolta pronta, lettura da configurare')}</strong><small>{tr('Public events are collected, but the Analytics Read token is not available yet.', 'Gli eventi pubblici vengono raccolti, ma il token Analytics Read non è ancora disponibile.')}</small></span></div>}
    {error && <div className="managed-analytics-error" role="alert">{error}</div>}

    <div className="managed-analytics-metrics" aria-busy={loading}>
      <div><Eye size={18} /><span>{tr('Visits', 'Visite')}<strong>{number(report.summary.visits)}</strong></span></div>
      <div><UsersRound size={18} /><span>{tr('Visitors', 'Visitatori')}<strong>{number(report.summary.visitors)}</strong></span></div>
      <div><MousePointerClick size={18} /><span>{tr('Clicks', 'Clic')}<strong>{number(report.summary.clicks)}</strong></span></div>
      <div><BarChart3 size={18} /><span>CTR<strong>{report.summary.ctr.toLocaleString(locale, { maximumFractionDigits: 1 })}%</strong></span></div>
    </div>

    <div className="managed-analytics-chart">
      <div><h3>{tr('Trend', 'Andamento')}</h3><p>{tr('Visits and clicks in the selected range.', 'Visite e clic nel periodo selezionato.')}</p></div>
      {report.trend.length ? <ResponsiveContainer height={260} width="100%"><AreaChart data={report.trend} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}><defs><linearGradient id="visits-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".22"/><stop offset="100%" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#e5eaf1" strokeDasharray="3 5" vertical={false}/><XAxis axisLine={false} dataKey="date" fontSize={11} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} fontSize={11} tickLine={false}/><Tooltip/><Area dataKey="visits" fill="url(#visits-fill)" name={tr('Visits', 'Visite')} stroke="#2563eb" strokeWidth={2}/><Area dataKey="clicks" fill="transparent" name={tr('Clicks', 'Clic')} stroke="#0f766e" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <div className="managed-analytics-empty">{tr('The first data will appear after someone visits the public page.', 'I primi dati compariranno dopo una visita alla pagina pubblica.')}</div>}
    </div>

    {report.detailed ? <div className="managed-analytics-details">
      <Ranking empty={tr('No sources detected.', 'Nessuna sorgente rilevata.')} items={report.sources} title={tr('Sources', 'Sorgenti')} />
      <Ranking empty={tr('No devices detected.', 'Nessun dispositivo rilevato.')} items={report.devices} title={tr('Devices', 'Dispositivi')} />
      <Ranking empty={tr('No countries detected.', 'Nessun paese rilevato.')} items={report.countries} title={tr('Countries', 'Paesi')} />
      <Ranking empty={tr('No UTM campaigns.', 'Nessuna campagna UTM.')} items={report.campaigns} title="UTM" />
      <Ranking empty={tr('No block clicks.', 'Nessun clic sui blocchi.')} items={report.links} title={tr('Top links', 'Link più cliccati')} />
    </div> : <div className="managed-analytics-locked"><strong>{tr('Details available on Starter', 'Dettagli disponibili con Starter')}</strong><span>{tr('Sources, devices, countries, UTM and longer trends unlock on a paid plan.', 'Sorgenti, dispositivi, paesi, UTM e andamento esteso si sbloccano con un piano a pagamento.')}</span></div>}
  </section>;
}
