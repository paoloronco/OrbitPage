import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <section className="border-t border-primary/10 pt-5 text-left">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Public QR</h2>
        </div>
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Open public page">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex justify-center rounded-lg border border-primary/10 bg-white p-3">
          <canvas ref={canvasRef} width={size} height={size} className="h-40 w-40" />
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Locked URL</Label>
            <Input value={publicUrl || "Loading..."} readOnly className="glass-card border-primary/20 text-xs" />
            <p className="text-[10px] text-muted-foreground opacity-70">
              {source === "configured" ? "Using PUBLIC_SITE_URL." : "Using the current installation URL."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Foreground</Label>
              <Input type="color" value={foreground} onChange={(e) => setForeground(e.target.value)} className="h-8 w-full" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Background</Label>
              <Input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-8 w-full" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Size</Label>
              <Input
                type="number"
                min={160}
                max={1024}
                step={40}
                value={size}
                onChange={(e) => setSize(Math.max(160, Math.min(1024, Number(e.target.value) || 320)))}
                className="h-8 w-full"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-2">
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
    </section>
  );
}
