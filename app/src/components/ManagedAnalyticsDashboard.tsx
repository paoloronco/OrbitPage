import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity,
  BarChart3,
  Eye,
  Globe2,
  MousePointerClick,
  RefreshCw,
  Route,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { managedAnalyticsApi, type ManagedAnalyticsDimension, type ManagedAnalyticsReport } from '@/lib/api-client';
import { useAppI18n } from '@/lib/i18n';

const EMPTY: ManagedAnalyticsReport = {
  configured: true,
  detailed: true,
  periodDays: 30,
  maxPeriodDays: 90,
  summary: { visits: 0, visitors: 0, clicks: 0, ctr: 0, visitsPerVisitor: 0, clicksPerVisitor: 0 },
  comparison: {
    previous: { visits: 0, visitors: 0, clicks: 0, ctr: 0 },
    changes: { visits: 0, visitors: 0, clicks: 0, ctr: 0 },
  },
  trend: [],
  sources: [],
  devices: [],
  countries: [],
  utmSources: [],
  utmMediums: [],
  campaigns: [],
  links: [],
  paths: [],
};

function Ranking({
  title,
  items,
  empty,
  denominator,
}: {
  title: string;
  items: ManagedAnalyticsDimension[];
  empty: string;
  denominator: number;
}) {
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return <section className="managed-analytics-ranking">
    <h3>{title}</h3>
    {items.length ? <div>{items.slice(0, 6).map((item) => <div className="managed-analytics-rank" key={item.label}>
      <span>
        <b title={item.label}>{item.label}</b>
        <em>{item.value.toLocaleString()} {denominator > 0 ? `· ${Math.round(item.value / denominator * 100)}%` : ''}</em>
      </span>
      <i><span style={{ width: `${Math.max(4, item.value / maximum * 100)}%` }} /></i>
    </div>)}</div> : <p>{empty}</p>}
  </section>;
}

function Change({ value, tr }: { value: number | null; tr: (english: string, italian: string) => string }) {
  if (value === null) return <small className="managed-analytics-change is-new">{tr('New', 'Nuovo')}</small>;
  const rounded = Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (value === 0) return <small className="managed-analytics-change">{tr('No change', 'Stabile')}</small>;
  return <small className={`managed-analytics-change ${value > 0 ? 'is-up' : 'is-down'}`}>
    {value > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
    {value > 0 ? '+' : '-'}{rounded}%
  </small>;
}

function Metric({
  icon: Icon,
  label,
  value,
  change,
  showChange,
  tr,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  change?: number | null;
  showChange?: boolean;
  tr: (english: string, italian: string) => string;
}) {
  return <div>
    <Icon aria-hidden="true" size={18} />
    <span>
      {label}
      <strong>{value}</strong>
      {showChange && <Change tr={tr} value={change ?? 0} />}
    </span>
  </div>;
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
  const decimal = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const bestDay = useMemo(() => report.trend.reduce<ManagedAnalyticsReport['trend'][number] | null>(
    (best, day) => !best || day.visits > best.visits ? day : best,
    null,
  ), [report.trend]);
  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
  };

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
      <Metric change={report.comparison.changes.visits} icon={Eye} label={tr('Visits', 'Visite')} showChange={report.detailed} tr={tr} value={number(report.summary.visits)} />
      <Metric change={report.comparison.changes.visitors} icon={UsersRound} label={tr('Visitors', 'Visitatori')} showChange={report.detailed} tr={tr} value={number(report.summary.visitors)} />
      <Metric change={report.comparison.changes.clicks} icon={MousePointerClick} label={tr('Clicks', 'Clic')} showChange={report.detailed} tr={tr} value={number(report.summary.clicks)} />
      <Metric change={report.comparison.changes.ctr} icon={BarChart3} label="CTR" showChange={report.detailed} tr={tr} value={`${report.summary.ctr.toLocaleString(locale, { maximumFractionDigits: 1 })}%`} />
      <Metric icon={Activity} label={tr('Visits per visitor', 'Visite per utente')} tr={tr} value={decimal(report.summary.visitsPerVisitor)} />
      <Metric icon={Route} label={tr('Clicks per visitor', 'Clic per utente')} tr={tr} value={decimal(report.summary.clicksPerVisitor)} />
    </div>

    <div className="managed-analytics-chart">
      <div><h3>{tr('Performance over time', 'Andamento nel tempo')}</h3><p>{tr('Visits, unique visitors and interactions in the selected range.', 'Visite, visitatori unici e interazioni nel periodo selezionato.')}</p></div>
      {report.trend.length ? <ResponsiveContainer height={280} width="100%"><AreaChart data={report.trend} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}><defs><linearGradient id="visits-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".22"/><stop offset="100%" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#e5eaf1" strokeDasharray="3 5" vertical={false}/><XAxis axisLine={false} dataKey="date" fontSize={11} tickFormatter={formatDate} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} fontSize={11} tickLine={false}/><Tooltip labelFormatter={(value) => formatDate(String(value))}/><Area dataKey="visits" fill="url(#visits-fill)" name={tr('Visits', 'Visite')} stroke="#2563eb" strokeWidth={2}/><Area dataKey="visitors" fill="transparent" name={tr('Visitors', 'Visitatori')} stroke="#7c3aed" strokeWidth={2}/><Area dataKey="clicks" fill="transparent" name={tr('Clicks', 'Clic')} stroke="#0f766e" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <div className="managed-analytics-empty">{tr('The first data will appear after someone visits the public page.', 'I primi dati compariranno dopo una visita alla pagina pubblica.')}</div>}
    </div>

    {report.detailed ? <>
      <div className="managed-analytics-highlights">
        <div><Globe2 size={17} /><span>{tr('Main source', 'Sorgente principale')}<strong>{report.sources[0]?.label || tr('Not available yet', 'Non ancora disponibile')}</strong></span></div>
        <div><MousePointerClick size={17} /><span>{tr('Top content', 'Contenuto migliore')}<strong>{report.links[0]?.label || tr('Not available yet', 'Non ancora disponibile')}</strong></span></div>
        <div><Route size={17} /><span>{tr('Most viewed path', 'Percorso più visto')}<strong>{report.paths[0]?.label || tr('Main page', 'Pagina principale')}</strong></span></div>
        <div><TrendingUp size={17} /><span>{tr('Best day', 'Giorno migliore')}<strong>{bestDay ? `${formatDate(bestDay.date)} · ${number(bestDay.visits)}` : tr('Not available yet', 'Non ancora disponibile')}</strong></span></div>
      </div>

      <section className="managed-analytics-breakdown">
        <div className="managed-analytics-section-heading">
          <span>{tr('Acquisition', 'Acquisizione')}</span>
          <p>{tr('Where visitors arrive from and which campaigns bring traffic.', 'Da dove arrivano i visitatori e quali campagne portano traffico.')}</p>
        </div>
        <div className="managed-analytics-details">
          <Ranking denominator={report.summary.visits} empty={tr('No sources detected.', 'Nessuna sorgente rilevata.')} items={report.sources} title={tr('Referrers', 'Siti di provenienza')} />
          <Ranking denominator={report.summary.visits} empty={tr('No UTM sources.', 'Nessuna sorgente UTM.')} items={report.utmSources} title="UTM source" />
          <Ranking denominator={report.summary.visits} empty={tr('No UTM media.', 'Nessun mezzo UTM.')} items={report.utmMediums} title="UTM medium" />
          <Ranking denominator={report.summary.visits} empty={tr('No UTM campaigns.', 'Nessuna campagna UTM.')} items={report.campaigns} title="UTM campaign" />
        </div>
      </section>

      <section className="managed-analytics-breakdown">
        <div className="managed-analytics-section-heading">
          <span>{tr('Audience', 'Pubblico')}</span>
          <p>{tr('A privacy-conscious view of devices and approximate countries.', 'Una panoramica rispettosa della privacy su dispositivi e paesi indicativi.')}</p>
        </div>
        <div className="managed-analytics-details is-two-column">
          <Ranking denominator={report.summary.visits} empty={tr('No devices detected.', 'Nessun dispositivo rilevato.')} items={report.devices} title={tr('Devices', 'Dispositivi')} />
          <Ranking denominator={report.summary.visits} empty={tr('No countries detected.', 'Nessun paese rilevato.')} items={report.countries} title={tr('Countries', 'Paesi')} />
        </div>
      </section>

      <section className="managed-analytics-breakdown">
        <div className="managed-analytics-section-heading">
          <span>{tr('Content', 'Contenuti')}</span>
          <p>{tr('See which destinations attract visits and interactions.', 'Scopri quali destinazioni attirano visite e interazioni.')}</p>
        </div>
        <div className="managed-analytics-details is-two-column">
          <Ranking denominator={report.summary.clicks} empty={tr('No block clicks.', 'Nessun clic sui blocchi.')} items={report.links} title={tr('Most clicked content', 'Contenuti più cliccati')} />
          <Ranking denominator={report.summary.visits} empty={tr('No page paths detected.', 'Nessun percorso rilevato.')} items={report.paths} title={tr('Most viewed paths', 'Percorsi più visitati')} />
        </div>
      </section>
    </> : <div className="managed-analytics-locked"><strong>{tr('Details available on Starter', 'Dettagli disponibili con Starter')}</strong><span>{tr('Comparisons, sources, devices, countries, UTM and content performance unlock on a paid plan.', 'Confronti, sorgenti, dispositivi, paesi, UTM e rendimento dei contenuti si sbloccano con un piano a pagamento.')}</span></div>}
  </section>;
}
