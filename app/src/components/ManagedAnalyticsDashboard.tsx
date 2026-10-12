import { type ReactNode, useCallback, useEffect, useMemo, useState, useId } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import { completeAnalyticsTrend, formatAnalyticsDuration } from '@/lib/analytics-display';
import { OrbitLoader } from '@/components/ui/orbit-loader';

const EMPTY: ManagedAnalyticsReport = {
  configured: true,
  detailed: true,
  periodDays: 30,
  maxPeriodDays: 30,
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


const CHART_COLORS = ['#4c9f70', '#4f87be', '#9270b5', '#d7ac64', '#459d96', '#94a3b8'];

export function ManagedAnalyticsDashboard({ headerAction }: { headerAction?: ReactNode }) {
  const { locale, tr } = useAppI18n();
  const [period, setPeriod] = useState(30);
  const [report, setReport] = useState<ManagedAnalyticsReport>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<'visits' | 'visitors'>('visitors');
  const gradient = useId();
  const load = useCallback(async (days: number, signal?: AbortSignal) => {
    setLoading(true); setError('');
    try { const next = await managedAnalyticsApi.get(days, signal); if (!signal?.aborted) { setReport(next); setPeriod(next.periodDays); } }
    catch (reason) { if (!signal?.aborted) { setReport(previous => ({ ...EMPTY, maxPeriodDays: previous.maxPeriodDays, periodDays: days })); setError(reason instanceof Error ? reason.message : tr('Analytics could not be loaded.', 'Impossibile caricare le analytics.')); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [tr]);
  useEffect(() => { const controller = new AbortController(); void load(period, controller.signal); return () => controller.abort(); }, [load, period]);
  const unavailable = loading || Boolean(error) || !report.configured;
  const trend = useMemo(() => completeAnalyticsTrend(report.trend, report.periodDays), [report.trend, report.periodDays]);
  const periods = [7, 30, 90].filter(days => days <= report.maxPeriodDays);
  const number = (value: number) => value.toLocaleString(locale);
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));
  const countryNames = new Intl.DisplayNames([locale], { type: 'region' });
  const countries = report.countries.map(item => ({ ...item, label: /^[A-Z]{2}$/.test(item.label) ? countryNames.of(item.label) || item.label : item.label }));
  const devices = report.devices.map(item => ({ ...item, label: item.label === 'Mobile' ? tr('Mobile', 'Telefono') : item.label === 'Desktop' ? tr('Desktop', 'Computer') : item.label }));
  const durationAvailable = report.summary.durationSeconds != null;
  const empty = <div className="managed-analytics-empty">{tr('No data for this period yet.', 'Ancora nessun dato per questo periodo.')}</div>;
  const grid = <CartesianGrid stroke="#e3e8ec" strokeDasharray="3 6" vertical={false} />;
  const xAxis = <XAxis axisLine={false} dataKey="date" fontSize={11} tickFormatter={formatDate} tickLine={false} minTickGap={24} />;
  const yAxis = <YAxis allowDecimals={false} axisLine={false} fontSize={11} tickLine={false} width={38} />;
  const tooltip = <Tooltip labelFormatter={value => formatDate(String(value))} contentStyle={{ borderRadius: 10, borderColor: '#e3e8ec', fontSize: 12 }} />;
  const contentLinks = report.links.map(item => item.label === 'Removed content' ? { ...item, label: tr('Removed content', 'Contenuto rimosso') } : item);
  const rankings = [
    { key: 'links', title: tr('Card clicks', 'Clic sulle card'), items: contentLinks, denominator: report.summary.clicks },
    { key: 'sources', title: tr('Traffic sources', 'Sorgenti di traffico'), items: report.sources, denominator: report.summary.visits },
    { key: 'paths', title: tr('Pages', 'Pagine'), items: report.paths, denominator: report.summary.visits },
    { key: 'campaigns', title: tr('Campaigns', 'Campagne'), items: report.campaigns, denominator: report.summary.visits },
    { key: 'utmSources', title: 'UTM source', items: report.utmSources, denominator: report.summary.visits },
    { key: 'utmMediums', title: 'UTM medium', items: report.utmMediums, denominator: report.summary.visits },
  ];
  return <section className="managed-analytics managed-analytics-modern" data-testid="managed-analytics" aria-busy={loading}>
    <header className="managed-analytics-header">
      {headerAction && <div className="managed-analytics-header-action">{headerAction}</div>}
      <div className="managed-analytics-actions ml-auto"><div role="group" aria-label={tr('Analytics range', 'Intervallo analytics')}>{periods.map(days => <button aria-pressed={period === days} key={days} onClick={() => setPeriod(days)} type="button">{days} {tr('days', 'giorni')}</button>)}</div><button aria-label={tr('Refresh analytics', 'Aggiorna analytics')} className="managed-analytics-refresh" disabled={loading} onClick={() => void load(period)} type="button">{loading ? <OrbitLoader size={16} state="searching" /> : <RefreshCw size={16} />}</button></div>
    </header>
    {!report.configured && <div className="managed-analytics-notice"><BarChart3 size={18} /><span><strong>{tr('Reporting needs configuration', 'Lettura dati da configurare')}</strong><small>{tr('The analytics reporting connection is unavailable.', 'La connessione per leggere le analytics non è disponibile.')}</small></span></div>}
    {error && <div className="managed-analytics-error" role="alert">{error}</div>}
    <div className="managed-analytics-metrics managed-analytics-primary-kpis">
      <Metric change={report.comparison.changes.visitors} icon={UsersRound} label={tr('Visitors', 'Visitatori')} showChange={report.detailed && !unavailable} tr={tr} value={unavailable ? '—' : number(report.summary.visitors)} />
      <Metric change={report.comparison.changes.visits} icon={Eye} label={tr('Visits', 'Visite')} showChange={report.detailed && !unavailable} tr={tr} value={unavailable ? '—' : number(report.summary.visits)} />
      <Metric icon={Activity} label={tr('Active duration', 'Durata attiva')} tr={tr} value={unavailable ? '—' : formatAnalyticsDuration(report.summary.durationSeconds)} />
      <Metric change={report.comparison.changes.clicks} icon={MousePointerClick} label={tr('Card clicks', 'Clic sulle card')} showChange={report.detailed && !unavailable} tr={tr} value={unavailable ? '—' : number(report.summary.clicks)} />
      <Metric icon={Globe2} label={tr('AI traffic', 'Traffico AI')} tr={tr} value={unavailable || !report.detailed ? '—' : number(report.summary.aiVisits || 0)} />
      <Metric icon={BarChart3} label={tr('AI search', 'Ricerca AI')} tr={tr} value={unavailable || !report.detailed ? '—' : number(report.summary.aiSearchVisits || 0)} />
    </div>
    <div className="analytics-chart-row analytics-chart-row--main">
      <section className="analytics-panel"><header><div><h3>{tr('Audience over time', 'Pubblico nel tempo')}</h3><p>{tr('Compare with the previous period.', 'Confronto con il periodo precedente.')}</p></div><div className="analytics-series" role="group" aria-label={tr('Traffic metric', 'Metrica del traffico')}>{(['visitors', 'visits'] as const).map(key => <button aria-pressed={metric === key} key={key} type="button" onClick={() => setMetric(key)}>{key === 'visits' ? tr('Visits', 'Visite') : tr('Visitors', 'Visitatori')}</button>)}</div></header>
        <div className="analytics-chart-value"><strong>{unavailable ? '—' : number(report.summary[metric])}</strong>{report.detailed && !unavailable && <Change tr={tr} value={report.comparison.changes[metric]} />}</div>
        {trend.length ? <ResponsiveContainer width="100%" height={250}><AreaChart data={trend} accessibilityLayer margin={{ left: 0, right: 12, top: 14, bottom: 0 }}><defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4c9f70" stopOpacity={.24} /><stop offset="100%" stopColor="#4c9f70" stopOpacity={0} /></linearGradient></defs>{grid}{xAxis}{yAxis}{tooltip}<Area type="monotone" dataKey={metric} name={metric === 'visits' ? tr('Visits', 'Visite') : tr('Visitors', 'Visitatori')} stroke="#4c9f70" strokeWidth={2.5} fill={'url(#' + gradient + ')'} isAnimationActive={false} /></AreaChart></ResponsiveContainer> : empty}
      </section>
      <section className="analytics-panel"><header><div><h3>{tr('Card interactions', 'Interazioni con le card')}</h3><p>{tr('Daily clicks on your content.', 'Clic giornalieri sui tuoi contenuti.')}</p></div></header><div className="analytics-chart-value"><strong>{unavailable ? '—' : number(report.summary.clicks)}</strong><span>{number(report.summary.ctr)}% {tr('clicks per visit', 'clic per visita')}</span></div>
        {trend.length ? <ResponsiveContainer width="100%" height={250}><BarChart data={trend} accessibilityLayer margin={{ left: 0, right: 4, top: 14, bottom: 0 }}>{grid}{xAxis}{yAxis}{tooltip}<Bar dataKey="clicks" name={tr('Card clicks', 'Clic sulle card')} fill="#4f87be" radius={[5,5,0,0]} maxBarSize={24} isAnimationActive={false} /></BarChart></ResponsiveContainer> : empty}
      </section>
    </div>
    {report.detailed ? <>
      <div className="analytics-chart-row analytics-chart-row--audience">
        <section className="analytics-panel"><header><div><h3>{tr('Devices', 'Dispositivi')}</h3><p>{tr('How visitors reach your page.', 'Come i visitatori aprono la pagina.')}</p></div></header>
          {devices.length ? <><ResponsiveContainer width="100%" height={180}><PieChart accessibilityLayer><Pie data={devices} dataKey="value" nameKey="label" innerRadius={56} outerRadius={76} paddingAngle={3} stroke="none" isAnimationActive={false}>{devices.map((item,index) => <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><ul className="analytics-chart-legend">{devices.map((item,index) => <li key={item.label}><span><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.label}</span><strong>{number(item.value)}</strong></li>)}</ul></> : empty}
        </section>
        <section className="analytics-panel"><header><div><h3>{tr('Countries', 'Paesi')}</h3><p>{tr('Approximate visitor location.', 'Posizione indicativa dei visitatori.')}</p></div></header>
          {countries.length ? <><ResponsiveContainer width="100%" height={230}><BarChart data={countries.slice(0,6)} layout="vertical" accessibilityLayer margin={{ left: 0, right: 20 }}><CartesianGrid stroke="#e3e8ec" strokeDasharray="3 6" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} fontSize={11} allowDecimals={false} /><YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={88} fontSize={11} /><Tooltip /><Bar dataKey="value" name={tr('Visits', 'Visite')} fill="#459d96" radius={[0,5,5,0]} maxBarSize={20} isAnimationActive={false} /></BarChart></ResponsiveContainer><ul className="sr-only">{countries.map(item => <li key={item.label}>{item.label}: {item.value}</li>)}</ul></> : <div className="managed-analytics-empty">{tr('Country data appears when supplied by your infrastructure.', 'I paesi compaiono quando l’infrastruttura fornisce questo dato.')}</div>}
        </section>
        <section className="analytics-panel"><header><div><h3>{tr('Average active duration', 'Durata attiva media')}</h3><p>{tr('Estimated visible time, for measured visits.', 'Tempo visibile stimato, per le visite misurate.')}</p></div></header><div className="analytics-chart-value"><strong>{formatAnalyticsDuration(report.summary.durationSeconds)}</strong><span>{number(report.summary.engagedVisits || 0)} {tr('measured visits', 'visite misurate')}</span></div>
          {durationAvailable ? <ResponsiveContainer width="100%" height={190}><LineChart data={trend} accessibilityLayer margin={{ left: 0, right: 10 }}>{grid}{xAxis}<YAxis axisLine={false} tickLine={false} fontSize={11} width={44} tickFormatter={formatAnalyticsDuration} /><Tooltip labelFormatter={value => formatDate(String(value))} formatter={value => formatAnalyticsDuration(Number(value))} /><Line type="monotone" dataKey="durationSeconds" name={tr('Duration', 'Durata')} stroke="#9270b5" strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <div className="managed-analytics-empty">{tr('Duration will appear from new consented visits. Past visits cannot be reconstructed.', 'La durata comparirà dalle nuove visite con consenso. Le visite passate non possono essere ricostruite.')}</div>}
        </section>
      </div>
      <div className="analytics-chart-row analytics-chart-row--main">
        <section className="analytics-panel"><header><div><h3>{tr('AI discovery', 'Scoperta tramite AI')}</h3><p>{tr('AI traffic and the subset from recognized search sources.', 'Traffico AI e visite da sorgenti di ricerca riconosciute.')}</p></div></header>
          <div className="analytics-ai-values"><span><i style={{ background: '#4c9f70' }} />{tr('AI traffic', 'Traffico AI')} <strong>{number(report.summary.aiVisits || 0)}</strong></span><span><i style={{ background: '#9270b5' }} />{tr('AI search', 'Ricerca AI')} <strong>{number(report.summary.aiSearchVisits || 0)}</strong></span></div>
          {trend.length ? <ResponsiveContainer width="100%" height={230}><LineChart data={trend} accessibilityLayer margin={{ left: 0, right: 12 }}>{grid}{xAxis}{yAxis}{tooltip}<Line type="monotone" dataKey="aiVisits" name={tr('AI traffic', 'Traffico AI')} stroke="#4c9f70" strokeWidth={2.5} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="aiSearchVisits" name={tr('AI search', 'Ricerca AI')} stroke="#9270b5" strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : empty}
          <p className="analytics-method-note">{tr('Estimated from referrers and UTM tags. Untagged AI visits and search prompts are not identifiable.', 'Stima da provenienza e tag UTM. Visite AI senza tag e richieste di ricerca non sono identificabili.')}</p>
        </section>
        <div className="analytics-panel"><Ranking title={tr('AI sources', 'Sorgenti AI')} items={report.aiSources || []} denominator={report.summary.aiVisits || 0} empty={tr('No recognized AI referrals in this period.', 'Nessuna provenienza AI riconosciuta in questo periodo.')} /></div>
      </div>
      <div className="analytics-ranking-grid">{rankings.map(group => <div className="analytics-panel" key={group.key}><Ranking denominator={group.denominator} empty={tr('No data for this period yet.', 'Ancora nessun dato per questo periodo.')} items={group.items} title={group.title} /></div>)}</div>
    </> : <div className="managed-analytics-locked"><strong>{tr('Details available on Starter', 'Dettagli disponibili con Starter')}</strong><span>{tr('Duration, AI referrals, sources, devices, countries and content details require an eligible plan.', 'Durata, provenienza AI, sorgenti, dispositivi, paesi e dettagli dei contenuti richiedono un piano idoneo.')}</span></div>}
    <section className="analytics-panel managed-analytics-qr-breakdown"><header><div><h3>{tr('QR codes', 'Codici QR')}</h3><p>{tr('Consented visits from tracked QR links.', 'Visite con consenso dai link QR tracciati.')}</p></div></header><div className="managed-analytics-metrics managed-analytics-qr-metrics"><Metric icon={QrCode} label={tr('QR visits', 'Visite da QR')} tr={tr} value={unavailable ? '—' : number(report.summary.qrVisits)} /><Metric icon={Activity} label={tr('Share of visits', 'Quota delle visite')} tr={tr} value={(report.summary.visits ? Math.round(report.summary.qrVisits / report.summary.visits * 100) : 0) + '%'} /></div>{report.detailed && <Ranking title={tr('QR destinations', 'Destinazioni QR')} items={report.qrPaths} denominator={report.summary.qrVisits} empty={tr('No QR visits yet.', 'Nessuna visita da QR per ora.')} />}</section>
    {trend.length > 0 && <details className="analytics-panel analytics-data-table"><summary>{tr('View chart data', 'Mostra i dati dei grafici')}</summary><div><table><thead><tr><th>{tr('Date', 'Data')}</th><th>{tr('Visitors', 'Visitatori')}</th><th>{tr('Visits', 'Visite')}</th><th>{tr('Card clicks', 'Clic sulle card')}</th>{report.detailed && <><th>{tr('Duration', 'Durata')}</th><th>AI traffic</th><th>AI search</th></>}</tr></thead><tbody>{trend.map(day => <tr key={day.date}><td>{formatDate(day.date)}</td><td>{number(day.visitors)}</td><td>{number(day.visits)}</td><td>{number(day.clicks)}</td>{report.detailed && <><td>{formatAnalyticsDuration(day.durationSeconds)}</td><td>{number(day.aiVisits || 0)}</td><td>{number(day.aiSearchVisits || 0)}</td></>}</tr>)}</tbody></table></div></details>}
  </section>;
}
