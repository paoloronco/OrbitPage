import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ChevronDown, Download, ExternalLink, QrCode, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
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
  const previewReady = Boolean(qrTarget.url && !contrastError && !renderError);

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
      <header className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="admin-panel-icon !h-8 !w-8" aria-hidden="true"><QrCode className="h-4 w-4" /></span>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{tr("Page QR codes", "QR delle pagine")}</h2>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{tr("Choose a destination, test it and download.", "Scegli la destinazione, provala e scarica il QR.")}</p>
          </div>
        </div>
        {qrTarget.url && !error && (
          <Button asChild variant="outline" size="sm">
            <a href={qrTarget.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{tr("Test target", "Prova destinazione")}</a>
          </Button>
        )}
      </header>

      <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex items-center justify-center border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
          <figure className="flex w-full flex-col items-center">
            <div className="relative grid w-full max-w-[190px] place-items-center sm:max-w-[220px]">
              <canvas
                ref={canvasRef}
                width={settings.size}
                height={settings.size}
                className={`block h-auto w-full rounded-sm ring-1 ring-slate-200 ${previewReady ? "opacity-100" : "opacity-0"}`}
                aria-describedby="qr-preview-url"
                aria-label={tr("Generated QR preview", "Anteprima QR generato")}
                role="img"
              >
                {tr("Generated QR code", "Codice QR generato")}
              </canvas>
              {!previewReady && (
                <div className="absolute inset-0 grid place-items-center rounded-sm border border-dashed border-slate-300 bg-white px-4 text-center text-xs text-slate-500" role="status">
                  {error ? tr("QR preview unavailable", "Anteprima QR non disponibile") : tr("Loading QR preview", "Caricamento anteprima QR")}
                </div>
              )}
            </div>
            <figcaption id="qr-preview-url" className="mt-2.5 w-full max-w-[220px] truncate text-center text-[10px] text-slate-500" title={qrTarget.url}>
              {qrTarget.url || tr("Loading public URL", "Caricamento URL pubblico")}
            </figcaption>
          </figure>
        </div>

        <div className="min-w-0 space-y-4 p-4 sm:p-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{tr("Destination", "Destinazione")}</h3>
              <p className="mt-1 text-xs text-slate-500">{source === "configured" ? tr("Uses your configured public domain.", "Usa il dominio pubblico configurato.") : tr("Uses this installation's public URL.", "Usa l'URL pubblico di questa installazione.")}</p>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-md border border-slate-200" role="group" aria-label={tr("QR destination", "Destinazione QR")}>
              {(["page", "menu", "custom"] as const).map((destination) => {
                const disabled = destination === "menu" && !menuEnabled;
                const label = destination === "page" ? tr("Page", "Pagina") : destination === "menu" ? "Menu" : tr("Path", "Percorso");
                return <button aria-pressed={settings.destination === destination} key={destination} type="button" disabled={disabled} onClick={() => update("destination", destination)} className={`min-h-10 border-r border-slate-200 px-2 text-xs font-semibold last:border-r-0 ${settings.destination === destination ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"} disabled:cursor-not-allowed disabled:opacity-40`}>{label}</button>;
              })}
            </div>
            {settings.destination === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="qr-path" className="text-xs">{tr("Relative path", "Percorso relativo")}</Label>
                <Input id="qr-path" value={settings.customPath} maxLength={160} onChange={(event) => update("customPath", event.target.value)} placeholder="offers/summer?utm_source=poster" />
              </div>
            )}
          </section>

          <details className="group overflow-hidden rounded-md border border-slate-200 bg-slate-50/60">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block">{tr("Style and export quality", "Stile e qualità di esportazione")}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{settings.size}px · {settings.correction}</span>
              </span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>

            <div className="space-y-4 border-t border-slate-200 bg-white p-3">
              <section className="space-y-3" aria-labelledby="qr-style-heading">
                <h3 id="qr-style-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{tr("Style", "Stile")}</h3>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label={tr("QR color preset", "Preset colori QR")}>
                  {QR_PRESETS.map((preset) => {
                    const selected = settings.foreground.toLowerCase() === preset.foreground.toLowerCase()
                      && settings.background.toLowerCase() === preset.background.toLowerCase();
                    return (
                      <button
                        aria-pressed={selected}
                        key={preset.name}
                        type="button"
                        onClick={() => setSettings((current) => ({ ...current, foreground: preset.foreground, background: preset.background }))}
                        className={`flex min-h-10 items-center gap-2 rounded-md border px-2 text-xs font-semibold ${selected ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
                      >
                        <span className="h-5 w-5 rounded-sm border border-black/10" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${preset.foreground} 50%, ${preset.background} 50%)` }} />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="qr-foreground" className="text-xs">{tr("Foreground", "Primo piano")}</Label><Input id="qr-foreground" type="color" value={settings.foreground} onChange={(event) => update("foreground", event.target.value)} className="h-10 w-full p-1" /></div>
                  <div className="space-y-1.5"><Label htmlFor="qr-background" className="text-xs">{tr("Background", "Sfondo")}</Label><Input id="qr-background" type="color" value={settings.background} onChange={(event) => update("background", event.target.value)} className="h-10 w-full p-1" /></div>
                </div>
              </section>

              <section className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2" aria-label={tr("Export quality", "Qualità di esportazione")}>
                <div className="space-y-2"><div className="flex justify-between gap-2"><Label htmlFor="qr-size" className="text-xs">{tr("Output size", "Dimensione output")}</Label><span className="text-xs tabular-nums text-slate-500">{settings.size}px</span></div><Slider aria-label={tr("Output size", "Dimensione output")} id="qr-size" max={1024} min={160} onValueChange={([size]) => update("size", size)} size="small" step={32} value={[settings.size]} valueLabelFormat={(size) => `${size}px`} /></div>
                <div className="space-y-2"><div className="flex justify-between gap-2"><Label htmlFor="qr-margin" className="text-xs">{tr("Quiet margin", "Margine libero")}</Label><span className="text-xs tabular-nums text-slate-500">{settings.margin}</span></div><Slider aria-label={tr("Quiet margin", "Margine libero")} id="qr-margin" max={12} min={1} onValueChange={([margin]) => update("margin", margin)} size="small" value={[settings.margin]} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="qr-correction" className="text-xs">{tr("Damage tolerance", "Tolleranza ai danni")}</Label><Select value={settings.correction} onValueChange={(value: QrErrorCorrection) => update("correction", value)}><SelectTrigger id="qr-correction"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="M">{tr("Standard", "Standard")}</SelectItem><SelectItem value="Q">{tr("High", "Alta")}</SelectItem><SelectItem value="H">{tr("Maximum", "Massima")}</SelectItem></SelectContent></Select></div>
              </section>
            </div>
          </details>

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
