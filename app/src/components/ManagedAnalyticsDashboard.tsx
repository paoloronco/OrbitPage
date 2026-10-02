import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity,
  BarChart3,
  Eye,
  Globe2,
  MousePointerClick,
  QrCode,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from '@/components/ui/material-icons';
import { managedAnalyticsApi, type ManagedAnalyticsDimension, type ManagedAnalyticsReport } from '@/lib/api-client';
import { useAppI18n } from '@/lib/i18n';
import { OrbitLoader } from '@/components/ui/orbit-loader';

const EMPTY: ManagedAnalyticsReport = {
  configured: true,
  detailed: true,
  periodDays: 30,
  maxPeriodDays: 90,
  summary: { visits: 0, visitors: 0, clicks: 0, qrVisits: 0, ctr: 0, visitsPerVisitor: 0, clicksPerVisitor: 0 },
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
  qrPaths: [],
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
  return <div className="managed-analytics-kpi">
    <Icon aria-hidden="true" size={18} />
    <span>
      {label}
      <strong>{value}</strong>
      {showChange && <Change tr={tr} value={change ?? 0} />}
    </span>
  </div>;
}

export function ManagedAnalyticsDashboard({ headerAction }: { headerAction?: ReactNode }) {
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
  const periods = useMemo(() => [7, 30].filter((days) => days <= report.maxPeriodDays), [report.maxPeriodDays]);
  const daySuffix = locale.toLowerCase().startsWith('it') ? 'g' : 'd';
  const contentLinks = report.links.map((item) => item.label === 'Removed content'
    ? { ...item, label: tr('Removed content', 'Contenuto rimosso') }
    : item);
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

  const contentGroups = [
    {
      key: 'links',
      denominator: report.summary.clicks,
      items: contentLinks,
      title: tr('Most clicked content', 'Contenuti più cliccati'),
      empty: tr('No block clicks.', 'Nessun clic sui blocchi.'),
    },
    {
      key: 'paths',
      denominator: report.summary.visits,
      items: report.paths,
      title: tr('Most viewed paths', 'Percorsi più visitati'),
      empty: tr('No page paths detected.', 'Nessun percorso rilevato.'),
    },
  ].filter((group) => group.items.length > 0);

  const acquisitionGroups = [
    {
      key: 'sources',
      denominator: report.summary.visits,
      items: report.sources,
      title: tr('Referrers', 'Siti di provenienza'),
      empty: tr('No sources detected.', 'Nessuna sorgente rilevata.'),
    },
    {
      key: 'utm-sources',
      denominator: report.summary.visits,
      items: report.utmSources,
      title: 'UTM source',
      empty: tr('No UTM sources.', 'Nessuna sorgente UTM.'),
    },
    {
      key: 'utm-mediums',
      denominator: report.summary.visits,
      items: report.utmMediums,
      title: 'UTM medium',
      empty: tr('No UTM media.', 'Nessun mezzo UTM.'),
    },
    {
      key: 'campaigns',
      denominator: report.summary.visits,
      items: report.campaigns,
      title: 'UTM campaign',
      empty: tr('No UTM campaigns.', 'Nessuna campagna UTM.'),
    },
  ].filter((group) => group.items.length > 0);

  const audienceGroups = [
    {
      key: 'devices',
      denominator: report.summary.visits,
      items: report.devices,
      title: tr('Devices', 'Dispositivi'),
      empty: tr('No devices detected.', 'Nessun dispositivo rilevato.'),
    },
    {
      key: 'countries',
      denominator: report.summary.visits,
      items: report.countries,
      title: tr('Countries', 'Paesi'),
      empty: tr('No countries detected.', 'Nessun paese rilevato.'),
    },
  ].filter((group) => group.items.length > 0);

  return <section className="managed-analytics" data-testid="managed-analytics">
    <header className="managed-analytics-header">
      {headerAction && <div className="managed-analytics-header-action">{headerAction}</div>}
      <div className="managed-analytics-actions ml-auto">
        <div role="group" aria-label={tr('Analytics range', 'Intervallo analytics')}>{periods.map((days) => <button aria-pressed={period === days} key={days} onClick={() => setPeriod(days)} type="button">{days}{daySuffix}</button>)}</div>
        <button aria-label={tr('Refresh analytics', 'Aggiorna analytics')} className="managed-analytics-refresh" disabled={loading} onClick={() => void load(period)} type="button">{loading ? <OrbitLoader size={16} state="searching" /> : <RefreshCw size={16} />}</button>
      </div>
    </header>

    {!report.configured && <div className="managed-analytics-notice"><BarChart3 size={18} /><span><strong>{tr('Collection ready, reporting needs configuration', 'Raccolta pronta, lettura da configurare')}</strong><small>{tr('Public events are collected, but the Analytics Read token is not available yet.', 'Gli eventi pubblici vengono raccolti, ma il token Analytics Read non è ancora disponibile.')}</small></span></div>}
    {error && <div className="managed-analytics-error" role="alert">{error}</div>}

    <div className="managed-analytics-metrics managed-analytics-primary-kpis" aria-busy={loading}>
      <Metric change={report.comparison.changes.visits} icon={Eye} label={tr('Visits', 'Visite')} showChange={report.detailed} tr={tr} value={number(report.summary.visits)} />
      <Metric change={report.comparison.changes.visitors} icon={UsersRound} label={tr('Visitors', 'Visitatori')} showChange={report.detailed} tr={tr} value={number(report.summary.visitors)} />
      <Metric change={report.comparison.changes.clicks} icon={MousePointerClick} label={tr('Clicks', 'Clic')} showChange={report.detailed} tr={tr} value={number(report.summary.clicks)} />
      <Metric change={report.comparison.changes.ctr} icon={BarChart3} label="CTR" showChange={report.detailed} tr={tr} value={`${report.summary.ctr.toLocaleString(locale, { maximumFractionDigits: 1 })}%`} />
    </div>

    <div className="managed-analytics-chart managed-analytics-trend">
      <div><h3>{tr('Performance over time', 'Andamento nel tempo')}</h3><p>{tr('Visits, unique visitors and interactions in the selected range.', 'Visite, visitatori unici e interazioni nel periodo selezionato.')}</p></div>
      {report.trend.length ? <ResponsiveContainer height={230} width="100%"><AreaChart data={report.trend} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}><defs><linearGradient id="visits-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity=".22"/><stop offset="100%" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#e5eaf1" strokeDasharray="3 5" vertical={false}/><XAxis axisLine={false} dataKey="date" fontSize={11} tickFormatter={formatDate} tickLine={false}/><YAxis allowDecimals={false} axisLine={false} fontSize={11} tickLine={false}/><Tooltip labelFormatter={(value) => formatDate(String(value))}/><Legend align="right" iconSize={8} iconType="circle" verticalAlign="top"/><Area dataKey="visits" fill="url(#visits-fill)" name={tr('Visits', 'Visite')} stroke="#2563eb" strokeWidth={2}/><Area dataKey="visitors" fill="transparent" name={tr('Visitors', 'Visitatori')} stroke="#7c3aed" strokeWidth={2}/><Area dataKey="clicks" fill="transparent" name={tr('Clicks', 'Clic')} stroke="#0f766e" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <div className="managed-analytics-empty">{tr('The first data will appear after someone visits the public page.', 'I primi dati compariranno dopo una visita alla pagina pubblica.')}</div>}
    </div>

    <section className="managed-analytics-breakdown managed-analytics-qr-breakdown">
      <div className="managed-analytics-section-heading">
        <span>{tr('QR codes', 'Codici QR')}</span>
        <p>{tr('Visits from tracked QR links after analytics consent.', 'Visite dai link QR tracciati dopo il consenso analytics.')}</p>
      </div>
      <div className="managed-analytics-metrics managed-analytics-qr-metrics">
        <Metric icon={QrCode} label={tr('QR visits', 'Visite da QR')} tr={tr} value={number(report.summary.qrVisits)} />
        <Metric icon={Activity} label={tr('Share of visits', 'Quota delle visite')} tr={tr} value={`${report.summary.visits ? Math.round(report.summary.qrVisits / report.summary.visits * 1000) / 10 : 0}%`} />
      </div>
      {report.detailed && <Ranking denominator={report.summary.qrVisits} empty={tr('No QR visits yet.', 'Nessuna visita da QR per ora.')} items={report.qrPaths} title={tr('QR destinations', 'Destinazioni QR')} />}
    </section>

    {report.detailed ? <>
      <div className="managed-analytics-quick-insights" aria-label={tr('Quick insights', 'Insight rapidi')}>
        <section className="managed-analytics-insight managed-analytics-insight--traffic">
          <header><Globe2 aria-hidden="true" size={17} /><h3>{tr('Traffic snapshot', 'Sintesi del traffico')}</h3></header>
          <dl>
            <div><dt>{tr('Main source', 'Sorgente principale')}</dt><dd>{report.sources[0]?.label || tr('Not available yet', 'Non ancora disponibile')}</dd></div>
            <div><dt>{tr('Best day', 'Giorno migliore')}</dt><dd>{bestDay ? `${formatDate(bestDay.date)} · ${number(bestDay.visits)}` : tr('Not available yet', 'Non ancora disponibile')}</dd></div>
            <div><dt>{tr('Visits per visitor', 'Visite per utente')}</dt><dd>{decimal(report.summary.visitsPerVisitor)}</dd></div>
          </dl>
        </section>
        <section className="managed-analytics-insight managed-analytics-insight--content">
          <header><Activity aria-hidden="true" size={17} /><h3>{tr('Content snapshot', 'Sintesi dei contenuti')}</h3></header>
          <dl>
            <div><dt>{tr('Top content', 'Contenuto migliore')}</dt><dd>{contentLinks[0]?.label || tr('Not available yet', 'Non ancora disponibile')}</dd></div>
            <div><dt>{tr('Most viewed path', 'Percorso più visto')}</dt><dd>{report.paths[0]?.label || tr('Main page', 'Pagina principale')}</dd></div>
            <div><dt>{tr('Clicks per visitor', 'Clic per utente')}</dt><dd>{decimal(report.summary.clicksPerVisitor)}</dd></div>
          </dl>
        </section>
      </div>

      <section className="managed-analytics-breakdown managed-analytics-breakdown--priority">
        <div className="managed-analytics-section-heading">
          <span>{tr('Content', 'Contenuti')}</span>
          <p>{tr('See which destinations attract visits and interactions.', 'Scopri quali destinazioni attirano visite e interazioni.')}</p>
        </div>
        {contentGroups.length ? <div className="managed-analytics-details managed-analytics-details--content">{contentGroups.map((group) => <Ranking denominator={group.denominator} empty={group.empty} items={group.items} key={group.key} title={group.title} />)}</div> : <p className="managed-analytics-section-empty">{tr('Content performance will appear after visitors open or click a destination.', 'Il rendimento dei contenuti comparirà dopo che i visitatori avranno aperto o cliccato una destinazione.')}</p>}
      </section>
    </> : <div className="managed-analytics-locked"><strong>{tr('Details available on Starter', 'Dettagli disponibili con Starter')}</strong><span>{tr('Comparisons, sources, devices, countries, UTM and content performance unlock on a paid plan.', 'Confronti, sorgenti, dispositivi, paesi, UTM e rendimento dei contenuti si sbloccano con un piano a pagamento.')}</span></div>}

      <section className="managed-analytics-breakdown managed-analytics-breakdown--acquisition">
        <div className="managed-analytics-section-heading"><span>{tr('Acquisition', 'Acquisizione')}</span><p>{tr('Referrers and campaigns that bring traffic.', 'Siti di provenienza e campagne che portano traffico.')}</p></div>
        {report.detailed ? acquisitionGroups.length ? <div className="managed-analytics-details managed-analytics-details--acquisition">{acquisitionGroups.map((group) => <Ranking denominator={group.denominator} empty={group.empty} items={group.items} key={group.key} title={group.title} />)}</div> : <p className="managed-analytics-section-empty">{tr('No referrer or campaign data is available for this period.', 'Nessun dato su provenienza o campagne disponibile per questo periodo.')}</p> : <p className="managed-analytics-section-empty">{tr('Available on Starter and above.', 'Disponibile da Starter in su.')}</p>}
      </section>

      <section className="managed-analytics-breakdown managed-analytics-breakdown--audience">
        <div className="managed-analytics-section-heading"><span>{tr('Audience', 'Pubblico')}</span><p>{tr('Devices and approximate countries, with privacy in mind.', 'Dispositivi e paesi indicativi, nel rispetto della privacy.')}</p></div>
        {report.detailed ? audienceGroups.length ? <div className="managed-analytics-details managed-analytics-details--audience">{audienceGroups.map((group) => <Ranking denominator={group.denominator} empty={group.empty} items={group.items} key={group.key} title={group.title} />)}</div> : <p className="managed-analytics-section-empty">{tr('No device or country data is available for this period.', 'Nessun dato su dispositivi o paesi disponibile per questo periodo.')}</p> : <p className="managed-analytics-section-empty">{tr('Available on Starter and above.', 'Disponibile da Starter in su.')}</p>}
      </section>
  </section>;
}
