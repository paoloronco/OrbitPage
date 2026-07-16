import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Loader2, Map, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SitemapStatus, sitemapApi } from "@/lib/api-client";

type ViewState = "loading" | "idle" | "generating" | "success" | "error";

interface SitemapManagerProps {
  readOnly?: boolean;
}

function formatDate(value: string | null) {
  if (!value) return "Not generated yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Generated"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function SitemapManager({ readOnly = false }: SitemapManagerProps) {
  const [sitemap, setSitemap] = useState<SitemapStatus | null>(null);
  const [state, setState] = useState<ViewState>("loading");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await sitemapApi.get();
        if (cancelled) return;
        setSitemap(response.data);
        setState("idle");
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Failed to load the sitemap.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const generate = async () => {
    if (readOnly) return;
    setState("generating");
    setMessage("");
    try {
      const response = await sitemapApi.generate();
      setSitemap(response.data);
      setState("success");
      setMessage(response.data.generated ? "Sitemap published successfully." : "Sitemap generation completed.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Failed to generate the sitemap.");
    }
  };

  const copyUrl = async () => {
    if (!sitemap?.url) return;
    try {
      await navigator.clipboard.writeText(sitemap.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setState("error");
      setMessage("The sitemap URL could not be copied. Select it manually instead.");
    }
  };

  const busy = state === "loading" || state === "generating";

  return (
    <Card className="admin-panel space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="admin-panel-icon"><Map className="h-4 w-4" /></span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Sitemap</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Generate the XML index that helps search engines discover your public page and its legal routes.
            </p>
          </div>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${
          sitemap?.generated
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-slate-50 text-slate-600"
        }`}>
          {sitemap?.generated ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Map className="h-3.5 w-3.5" />}
          {sitemap?.generated ? "Published" : "Not generated"}
        </span>
      </div>

      {message && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
          state === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {state === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
          <span>{message}</span>
        </div>
      )}

      <div className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase text-slate-500">URLs included</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{sitemap?.entryCount ?? "-"}</p>
        </div>
        <div className="bg-white px-4 py-4 sm:col-span-2">
          <p className="text-xs font-semibold uppercase text-slate-500">Last generated</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(sitemap?.generatedAt || null)}</p>
          <p className="mt-1 text-xs text-slate-500">After generation, OrbitPage keeps the file aligned with future publications.</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-slate-500">Public sitemap URL</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1 select-all overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-800">
            {sitemap?.url || (state === "loading" ? "Loading..." : "Unavailable")}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="admin-action" onClick={() => void copyUrl()} disabled={!sitemap?.url || busy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            {sitemap?.generated && (
              <Button asChild variant="outline" className="admin-action">
                <a href={sitemap.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-slate-500">
          The XML is generated from validated OrbitPage routes. It does not include admin, API, preview, or private URLs.
        </p>
        <Button
          type="button"
          className="admin-action admin-action-primary shrink-0"
          onClick={() => void generate()}
          disabled={busy || readOnly}
        >
          {state === "generating"
            ? <Loader2 className="h-4 w-4 animate-spin [animation-duration:1.2s]" />
            : <RefreshCw className="h-4 w-4" />}
          {state === "generating" ? "Generating sitemap" : sitemap?.generated ? "Regenerate sitemap" : "Generate sitemap"}
        </Button>
      </div>
    </Card>
  );
}
