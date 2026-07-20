import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, ExternalLink, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publicUrlApi } from "@/lib/api-client";
import { getPublicUrlOverride } from "@/lib/public-url-override";
import { useAppI18n } from "@/lib/i18n";
import { buildLockedQrUrl, qrContrastRatio } from "@/lib/qr-code";

type QrDestination = "page" | "menu" | "custom";
type QrErrorCorrection = "L" | "M" | "Q" | "H";

interface QrSettings {
  destination: QrDestination;
  customPath: string;
  foreground: string;
  background: string;
  size: number;
  margin: number;
  correction: QrErrorCorrection;
}

const DEFAULT_SETTINGS: QrSettings = {
  destination: "page",
  customPath: "",
  foreground: "#111827",
  background: "#ffffff",
  size: 320,
  margin: 4,
  correction: "H",
};

const QR_PRESETS = [
  { name: "Classic", foreground: "#111827", background: "#ffffff" },
  { name: "OrbitPage", foreground: "#1746d1", background: "#f8fafc" },
  { name: "Midnight", foreground: "#f8fafc", background: "#101827" },
] as const;

const safeSettings = (value: unknown): QrSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_SETTINGS;
  const input = value as Partial<QrSettings>;
  return {
    destination: input.destination === "menu" || input.destination === "custom" ? input.destination : "page",
    customPath: typeof input.customPath === "string" ? input.customPath.slice(0, 160) : "",
    foreground: typeof input.foreground === "string" && /^#[0-9a-f]{6}$/i.test(input.foreground) ? input.foreground : DEFAULT_SETTINGS.foreground,
    background: typeof input.background === "string" && /^#[0-9a-f]{6}$/i.test(input.background) ? input.background : DEFAULT_SETTINGS.background,
    size: Math.max(160, Math.min(1024, Number(input.size) || DEFAULT_SETTINGS.size)),
    margin: Math.max(1, Math.min(12, Number(input.margin) || DEFAULT_SETTINGS.margin)),
    correction: input.correction === "L" || input.correction === "M" || input.correction === "Q" ? input.correction : "H",
  };
};

export function ProfileQrCode({ menuEnabled = false }: { menuEnabled?: boolean }) {
  const { tr } = useAppI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hydratedUrl = useRef("");
  const [publicUrl, setPublicUrl] = useState("");
  const [source, setSource] = useState<"configured" | "request">("request");
  const [settings, setSettings] = useState<QrSettings>(DEFAULT_SETTINGS);
  const [renderError, setRenderError] = useState("");
  const selectedPath = settings.destination === "menu" ? "menu" : settings.destination === "custom" ? settings.customPath : "";
  const qrTarget = useMemo(() => buildLockedQrUrl(publicUrl, selectedPath), [publicUrl, selectedPath]);
  const contrast = qrContrastRatio(settings.foreground, settings.background);
  const contrastError = contrast < 4.5
    ? tr("Increase the contrast between the QR colors before downloading.", "Aumenta il contrasto tra i colori del QR prima di scaricarlo.")
    : "";
  const error = qrTarget.error || contrastError || renderError;

  useEffect(() => {
    let cancelled = false;
    const override = getPublicUrlOverride();
    const applyUrl = (url: string, nextSource: "configured" | "request") => {
      if (cancelled) return;
      setPublicUrl(url);
      setSource(nextSource);
      try {
        const stored = window.localStorage.getItem(`orbitpage:qr:${url}`);
        if (stored) setSettings(safeSettings(JSON.parse(stored)));
      } catch {
        // A blocked local store never prevents QR generation.
      }
      hydratedUrl.current = url;
    };

    if (override) {
      applyUrl(override, "configured");
      return () => { cancelled = true; };
    }

    publicUrlApi.get()
      .then((result) => applyUrl(result.publicUrl, result.source))
      .catch((err) => {
        if (!cancelled) setRenderError(err instanceof Error ? err.message : tr("Failed to load public URL", "Impossibile caricare l'URL pubblico"));
      });
    return () => { cancelled = true; };
  }, [tr]);

  useEffect(() => {
    if (!publicUrl || hydratedUrl.current !== publicUrl) return;
    try {
      window.localStorage.setItem(`orbitpage:qr:${publicUrl}`, JSON.stringify(settings));
    } catch {
      // Persistence is an optional convenience; generation remains available.
    }
  }, [publicUrl, settings]);

  useEffect(() => {
    if (!menuEnabled && settings.destination === "menu") {
      setSettings((current) => ({ ...current, destination: "page" }));
    }
  }, [menuEnabled, settings.destination]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qrTarget.url || contrastError) {
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    QRCode.toCanvas(canvas, qrTarget.url, {
      width: settings.size,
      margin: settings.margin,
      errorCorrectionLevel: settings.correction,
      color: { dark: settings.foreground, light: settings.background },
    })
      .then(() => {
        setRenderError("");
        canvas.style.width = "100%";
        canvas.style.height = "auto";
      })
      .catch((err) => setRenderError(err instanceof Error ? err.message : tr("Failed to render QR code", "Impossibile generare il QR")));
  }, [contrastError, qrTarget.url, settings, tr]);

  const fileStem = settings.destination === "page" ? "page" : settings.destination === "menu" ? "menu" : "custom";
  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas || error || !qrTarget.url) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `orbitpage-${fileStem}-qr.png`;
    link.click();
  };

  const downloadSvg = async () => {
    if (!qrTarget.url || error) return;
    const svg = await QRCode.toString(qrTarget.url, {
      type: "svg",
      margin: settings.margin,
      errorCorrectionLevel: settings.correction,
      color: { dark: settings.foreground, light: settings.background },
    });
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `orbitpage-${fileStem}-qr.svg`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  const update = <K extends keyof QrSettings>(key: K, value: QrSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <Card className="overflow-hidden border-slate-200 bg-white p-0 text-left shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="admin-panel-icon"><QrCode className="h-4 w-4" /></span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{tr("Page QR codes", "QR delle pagine")}</h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{tr("Create print-ready QR codes for this page and its menu.", "Crea QR pronti per la stampa per questa pagina e il suo menu.")}</p>
          </div>
        </div>
        {qrTarget.url && !error && (
          <a href={qrTarget.url} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" size="sm"><ExternalLink className="h-4 w-4" />{tr("Test target", "Prova destinazione")}</Button>
          </a>
        )}
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(300px,0.8fr)_minmax(360px,1.2fr)]">
        <div className="flex min-h-[390px] items-center justify-center bg-slate-50 p-6 sm:p-8">
          <div className="w-full max-w-[340px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <canvas ref={canvasRef} width={settings.size} height={settings.size} className="block h-auto w-full" aria-label={tr("Generated QR preview", "Anteprima QR generato")} />
            <p className="mt-4 truncate text-center font-mono text-[10px] text-slate-500" title={qrTarget.url}>{qrTarget.url || tr("Loading public URL", "Caricamento URL pubblico")}</p>
          </div>
        </div>

        <div className="min-w-0 space-y-6 border-t border-slate-200 p-5 lg:border-l lg:border-t-0 sm:p-6">
          <section className="space-y-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{tr("Destination", "Destinazione")}</Label>
              <p className="mt-1 text-xs text-slate-500">{source === "configured" ? tr("Uses your configured public domain.", "Usa il dominio pubblico configurato.") : tr("Uses this installation's public URL.", "Usa l'URL pubblico di questa installazione.")}</p>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-md border border-slate-200" role="group" aria-label={tr("QR destination", "Destinazione QR")}>
              {(["page", "menu", "custom"] as const).map((destination) => {
                const disabled = destination === "menu" && !menuEnabled;
                const label = destination === "page" ? tr("Page", "Pagina") : destination === "menu" ? "Menu" : tr("Path", "Percorso");
                return <button key={destination} type="button" disabled={disabled} onClick={() => update("destination", destination)} className={`min-h-10 border-r border-slate-200 px-2 text-xs font-semibold last:border-r-0 ${settings.destination === destination ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"} disabled:cursor-not-allowed disabled:opacity-40`}>{label}</button>;
              })}
            </div>
            {settings.destination === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="qr-path" className="text-xs">{tr("Relative path", "Percorso relativo")}</Label>
                <Input id="qr-path" value={settings.customPath} maxLength={160} onChange={(event) => update("customPath", event.target.value)} placeholder="offers/summer?utm_source=poster" />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{tr("Style", "Stile")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {QR_PRESETS.map((preset) => <button key={preset.name} type="button" onClick={() => setSettings((current) => ({ ...current, foreground: preset.foreground, background: preset.background }))} className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:border-blue-300"><span className="h-5 w-5 rounded-sm border border-black/10" style={{ background: `linear-gradient(135deg, ${preset.foreground} 50%, ${preset.background} 50%)` }} />{preset.name}</button>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs">{tr("Foreground", "Primo piano")}</Label><Input type="color" value={settings.foreground} onChange={(event) => update("foreground", event.target.value)} className="h-10 w-full p-1" /></div>
              <div className="space-y-1.5"><Label className="text-xs">{tr("Background", "Sfondo")}</Label><Input type="color" value={settings.background} onChange={(event) => update("background", event.target.value)} className="h-10 w-full p-1" /></div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><div className="flex justify-between gap-2"><Label htmlFor="qr-size" className="text-xs">{tr("Output size", "Dimensione output")}</Label><span className="text-xs tabular-nums text-slate-500">{settings.size}px</span></div><Input id="qr-size" type="range" min={160} max={1024} step={32} value={settings.size} onChange={(event) => update("size", Number(event.target.value))} /></div>
            <div className="space-y-2"><div className="flex justify-between gap-2"><Label htmlFor="qr-margin" className="text-xs">{tr("Quiet margin", "Margine libero")}</Label><span className="text-xs tabular-nums text-slate-500">{settings.margin}</span></div><Input id="qr-margin" type="range" min={1} max={12} value={settings.margin} onChange={(event) => update("margin", Number(event.target.value))} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">{tr("Damage tolerance", "Tolleranza ai danni")}</Label><Select value={settings.correction} onValueChange={(value: QrErrorCorrection) => update("correction", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="M">{tr("Standard", "Standard")}</SelectItem><SelectItem value="Q">{tr("High", "Alta")}</SelectItem><SelectItem value="H">{tr("Maximum", "Massima")}</SelectItem></SelectContent></Select></div>
          </section>

          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            <Button type="button" onClick={downloadPng} disabled={!qrTarget.url || Boolean(error)}><Download className="h-4 w-4" />PNG</Button>
            <Button type="button" onClick={() => { void downloadSvg(); }} variant="outline" disabled={!qrTarget.url || Boolean(error)}><Download className="h-4 w-4" />SVG</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
