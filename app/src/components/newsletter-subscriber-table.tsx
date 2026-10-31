"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { newsletterTrackingAllowed, type NewsletterSubscriber } from "../lib/newsletter-types";

type SortColumn = "subscriber" | "status" | "source" | "tracking" | "createdAt";
export type NewsletterTranslator = (english: string, italian: string) => string;

export default function NewsletterSubscriberTable({ subscribers, total, action, onRemove, loadingIndicator: LoadingIndicator, tr = english => english }: {
  subscribers: NewsletterSubscriber[];
  total: number;
  action: string | null;
  onRemove: (id: string) => Promise<void>;
  loadingIndicator: ComponentType<{ size: number }>;
  tr?: NewsletterTranslator;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [tracking, setTracking] = useState("all");
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean }>({ column: "createdAt", descending: true });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    const value = (item: NewsletterSubscriber) => sort.column === "subscriber" ? item.name || item.email
      : sort.column === "tracking" ? Number(newsletterTrackingAllowed(item)) : item[sort.column];
    return subscribers.filter(item => (!query || `${item.name || ""} ${item.email}`.toLowerCase().includes(query))
      && (status === "all" || item.status === status)
      && (source === "all" || item.source === source)
      && (tracking === "all" || newsletterTrackingAllowed(item) === (tracking === "consented")))
      .sort((left, right) => {
        const result = collator.compare(String(value(left)), String(value(right)));
        return (sort.descending ? -result : result) || collator.compare(left.email, right.email);
      });
  }, [subscribers, search, status, source, tracking, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const filtered = Boolean(search || status !== "all" || source !== "all" || tracking !== "all");
  useEffect(() => { setPage(previous => Math.min(previous, pages)); }, [pages]);

  function resetFilters() {
    setSearch(""); setStatus("all"); setSource("all"); setTracking("all"); setPage(1);
  }
  const columns: Array<{ id: SortColumn; label: string }> = [
    { id: "subscriber", label: tr("Subscriber", "Iscritto") },
    { id: "status", label: tr("Status", "Stato") },
    { id: "source", label: tr("Source", "Origine") },
    { id: "tracking", label: tr("Email tracking", "Tracciamento email") },
    { id: "createdAt", label: tr("Added", "Aggiunto") },
  ];
  const statusLabels = { active: tr("Active", "Attivo"), pending: tr("Pending", "In attesa"), unsubscribed: tr("Unsubscribed", "Disiscritto") };
  const sourceLabels = { manual: tr("Manual", "Manuale"), public: tr("Public signup", "Iscrizione pubblica"), import: tr("Import", "Importazione") };

  return <>
    <div className="newsletter-subscriber-filters">
      <label className="field newsletter-subscriber-search">
        <span className="label">{tr("Search subscribers", "Cerca iscritti")}</span>
        <span><Search aria-hidden="true" size={16} /><input className="input" type="search" placeholder={tr("Name or email", "Nome o email")} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></span>
      </label>
      <label className="field"><span className="label">{tr("Status", "Stato")}</span>
        <select className="input" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="all">{tr("All statuses", "Tutti gli stati")}</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field"><span className="label">{tr("Source", "Origine")}</span>
        <select className="input" value={source} onChange={event => { setSource(event.target.value); setPage(1); }}>
          <option value="all">{tr("All sources", "Tutte le origini")}</option>
          {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field"><span className="label">{tr("Email tracking", "Tracciamento email")}</span>
        <select className="input" value={tracking} onChange={event => { setTracking(event.target.value); setPage(1); }}>
          <option value="all">{tr("All preferences", "Tutte le preferenze")}</option>
          <option value="consented">{tr("Consented", "Consentito")}</option>
          <option value="disabled">{tr("Disabled", "Disattivato")}</option>
        </select>
      </label>
      {filtered && <button className="button secondary compact" type="button" onClick={resetFilters}>{tr("Clear filters", "Azzera filtri")}</button>}
    </div>
    {total > subscribers.length && <p className="newsletter-subscriber-scope" role="note">
      <strong>{subscribers.length} / {total}</strong>{" · "}{tr("Only the most recently updated subscribers are loaded. Search, filters and sorting apply to this list.", "Sono caricati solo gli iscritti aggiornati più di recente. Ricerca, filtri e ordinamento si applicano a questo elenco.")}
    </p>}
    {rows.length ? <div className="newsletter-table-wrap" tabIndex={0} role="region" aria-label={tr("Subscriber list", "Elenco iscritti")}>
      <table>
        <caption className="sr-only">{tr("Newsletter subscribers", "Iscritti alla newsletter")}</caption>
        <thead><tr>{columns.map(column => <th key={column.id} scope="col" aria-sort={sort.column === column.id ? sort.descending ? "descending" : "ascending" : "none"}>
          <button className="newsletter-sort-button" type="button" onClick={() => {
            setSort(previous => ({ column: column.id, descending: previous.column === column.id ? !previous.descending : column.id === "createdAt" })); setPage(1);
          }}>{column.label}{sort.column === column.id ? sort.descending ? <ArrowDown aria-hidden="true" size={13} /> : <ArrowUp aria-hidden="true" size={13} /> : <ArrowUpDown aria-hidden="true" size={13} />}</button>
        </th>)}<th scope="col"><span className="sr-only">{tr("Actions", "Azioni")}</span></th></tr></thead>
        <tbody>{rows.slice(start, start + pageSize).map(item => <tr key={item.subscriberId}>
          <td><strong>{item.name || item.email}</strong>{item.name && <span>{item.email}</span>}</td>
          <td><span className={`newsletter-status ${item.status}`}>{statusLabels[item.status]}</span></td>
          <td>{sourceLabels[item.source]}</td>
          <td>{newsletterTrackingAllowed(item) ? tr("Consented", "Consentito") : tr("Disabled", "Disattivato")}</td>
          <td>{new Date(item.createdAt).toLocaleDateString()}</td>
          <td><button aria-label={tr("Remove {email}", "Rimuovi {email}").replace("{email}", item.email)} className="newsletter-icon-button" disabled={action !== null} onClick={() => void onRemove(item.subscriberId)} type="button">
            {action === `subscriber-remove:${item.subscriberId}` ? <LoadingIndicator size={14} /> : <Trash2 aria-hidden="true" size={15} />}
          </button></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="newsletter-zero"><Search aria-hidden="true" size={22} /><div><strong>{tr("No matching subscribers", "Nessun iscritto trovato")}</strong><span>{tr("Try another name, email or filter.", "Prova un altro nome, email o filtro.")}</span></div></div>}
    <footer className="newsletter-subscriber-pagination">
      <p role="status">{tr("{from}–{to} of {total} subscribers", "{from}–{to} di {total} iscritti").replace("{from}", String(rows.length ? start + 1 : 0)).replace("{to}", String(Math.min(start + pageSize, rows.length))).replace("{total}", String(rows.length))}</p>
      <label>{tr("Rows per page", "Righe per pagina")}<select className="input" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      <nav aria-label={tr("Subscriber pages", "Pagine iscritti")}>
        <button className="button secondary compact" type="button" aria-label={tr("Previous page", "Pagina precedente")} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" size={16} /></button>
        <span>{tr("Page {page} of {pages}", "Pagina {page} di {pages}").replace("{page}", String(currentPage)).replace("{pages}", String(pages))}</span>
        <button className="button secondary compact" type="button" aria-label={tr("Next page", "Pagina successiva")} disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" size={16} /></button>
      </nav>
    </footer>
  </>;
}
