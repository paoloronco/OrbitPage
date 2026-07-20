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
  const { locale } = useAppI18n();
  const it = locale === 'it';
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
      setError(reason instanceof Error ? reason.message : (it ? 'Impossibile caricare le analytics.' : 'Analytics could not be loaded.'));
    } finally { setLoading(false); }
  }, [it]);

  useEffect(() => { void load(period); }, [load, period]);
  const periods = useMemo(() => [7, 30, 90].filter((days) => days <= report.maxPeriodDays), [report.maxPeriodDays]);
  const number = (value: number) => value.toLocaleString(it ? 'it-IT' : 'en-GB');

  return <section className="managed-analytics" data-testid="managed-analytics">
    <header className="managed-analytics-header">
      <div><span>{it ? 'Attività della pagina pubblica' : 'Public page activity'}</span><h2>{it ? 'Analytics' : 'Analytics'}</h2><p>{it ? 'Visite e interazioni raccolte all’edge, senza contare l’attività nell’Admin.' : 'Visits and interactions collected at the edge, excluding Admin activity.'}</p></div>
      <div className="managed-analytics-actions">
        <div role="group" aria-label={it ? 'Intervallo analytics' : 'Analytics range'}>{periods.map((days) => <button aria-pressed={period === days} key={days} onClick={() => setPeriod(days)} type="button">{days}d</button>)}</div>
        <button aria-label={it ? 'Aggiorna analytics' : 'Refresh analytics'} className="managed-analytics-refresh" disabled={loading} onClick={() => void load(period)} type="button"><RefreshCw className={loading ? 'is-loading' : ''} size={16} /></button>
      </div>
    </header>

    {!report.configured && <div className="managed-analytics-notice"><BarChart3 size={18} /><span><strong>{it ? 'Raccolta pronta, lettura da configurare' : 'Collection ready, reporting needs configuration'}</strong><small>{it ? 'Gli eventi pubblici vengono raccolti, ma il token Analytics Read non è ancora disponibile.' : 'Public events are collected, but the Analytics Read token is not available yet.'}</small></span></div>}
    {error && <div className="managed-analytics-error" role="alert">{error}</div>}

    <div className="managed-analytics-metrics" aria-busy={loading}>
      <div><Eye size={18} /><span>{it ? 'Visite' : 'Visits'}<strong>{number(report.summary.visits)}</strong></span></div>
      <div><UsersRound size={18} /><span>{it ? 'Visitatori' : 'Visitors'}<strong>{number(report.summary.visitors)}</strong></span></div>
      <div><MousePointerClick size={18} /><span>{it ? 'Clic' : 'Clicks'}<strong>{number(report.summary.clicks)}</strong></span></div>
      <div><BarChart3 size={18} /><span>CTR<strong>{report.summary.ctr.toLocaleString(it ? 'it-IT' : 'en-GB', { maximumFractionDigits: 1 })}%</strong></span></div>
    </div>

    <div className="managed-analytics-chart">
      <div><h3>{it ? 'Andamento' : 'Trend'}</h3><p>{it ? 'Visite e clic nel periodo selezionato.' : 'Visits and clicks in the selected range.'}</p></div>
      {report.trend.length ? <ResponsiveContainer height={260} width="100%"><AreaChart data={report.trend} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}><defs><linearGradient id="visits-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".22"/><stop offset="100%" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#e5eaf1" strokeDasharray="3 5" vertical={false}/><XAxis axisLine={false} dataKey="date" fontSize={11} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} fontSize={11} tickLine={false}/><Tooltip/><Area dataKey="visits" fill="url(#visits-fill)" name={it ? 'Visite' : 'Visits'} stroke="#2563eb" strokeWidth={2}/><Area dataKey="clicks" fill="transparent" name={it ? 'Clic' : 'Clicks'} stroke="#0f766e" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <div className="managed-analytics-empty">{it ? 'I primi dati compariranno dopo una visita alla pagina pubblica.' : 'The first data will appear after someone visits the public page.'}</div>}
    </div>

    {report.detailed ? <div className="managed-analytics-details">
      <Ranking empty={it ? 'Nessuna sorgente rilevata.' : 'No sources detected.'} items={report.sources} title={it ? 'Sorgenti' : 'Sources'} />
      <Ranking empty={it ? 'Nessun dispositivo rilevato.' : 'No devices detected.'} items={report.devices} title={it ? 'Dispositivi' : 'Devices'} />
      <Ranking empty={it ? 'Nessun paese rilevato.' : 'No countries detected.'} items={report.countries} title={it ? 'Paesi' : 'Countries'} />
      <Ranking empty={it ? 'Nessuna campagna UTM.' : 'No UTM campaigns.'} items={report.campaigns} title="UTM" />
      <Ranking empty={it ? 'Nessun clic sui blocchi.' : 'No block clicks.'} items={report.links} title={it ? 'Link più cliccati' : 'Top links'} />
    </div> : <div className="managed-analytics-locked"><strong>{it ? 'Dettagli disponibili con Starter' : 'Details available on Starter'}</strong><span>{it ? 'Sorgenti, dispositivi, paesi, UTM e andamento esteso si sbloccano con un piano a pagamento.' : 'Sources, devices, countries, UTM and longer trends unlock on a paid plan.'}</span></div>}
  </section>;
}
