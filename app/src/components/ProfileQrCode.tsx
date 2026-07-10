import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicUrlApi } from "@/lib/api-client";

export function ProfileQrCode() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [source, setSource] = useState<"configured" | "request">("request");
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("#ffffff");
  const [size, setSize] = useState(320);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    publicUrlApi.get()
      .then((result) => {
        if (cancelled) return;
        setPublicUrl(result.publicUrl);
        setSource(result.source);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load public URL");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!publicUrl || !canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, publicUrl, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: foreground,
        light: background,
      },
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to render QR code");
    });
  }, [background, foreground, publicUrl, size]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "orbitpage-public-qr.png";
    link.click();
  };

  const downloadSvg = async () => {
    if (!publicUrl) return;
    const svg = await QRCode.toString(publicUrl, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: foreground,
        light: background,
      },
    });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orbitpage-public-qr.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-card p-6 text-left transition-smooth hover:glow-effect">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <QrCode className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="truncate text-base font-semibold text-foreground">Public QR</h2>
        </div>
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Open public page">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <div className="flex items-center justify-center rounded-lg border border-primary/10 bg-white p-4">
          <div className="relative aspect-square w-full max-w-[260px] overflow-hidden">
            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Locked URL</Label>
            <Input value={publicUrl || "Loading..."} readOnly className="glass-card border-primary/20 text-xs" />
            <p className="text-[10px] text-muted-foreground opacity-70">
              {source === "configured" ? "Using PUBLIC_SITE_URL." : "Using the current installation URL."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Foreground</Label>
              <Input type="color" value={foreground} onChange={(e) => setForeground(e.target.value)} className="h-10 w-full" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Background</Label>
              <Input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-10 w-full" />
            </div>
            <div className="min-w-0 space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Output size</Label>
              <Input
                type="number"
                min={160}
                max={1024}
                step={40}
                value={size}
                onChange={(e) => setSize(Math.max(160, Math.min(1024, Number(e.target.value) || 320)))}
                className="h-10 w-full"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={downloadPng} size="sm" variant="outline" disabled={!publicUrl}>
              <Download className="h-4 w-4" />
              PNG
            </Button>
            <Button type="button" onClick={() => { void downloadSvg(); }} size="sm" variant="outline" disabled={!publicUrl}>
              <Download className="h-4 w-4" />
              SVG
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
