import { useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Paintbrush,
  Layers,
  Film,
  ImagePlay,
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { BackgroundMediaConfig, defaultBackgroundMedia } from "@/lib/theme";
import { uploadApi } from "@/lib/api-client";

interface BackgroundMediaCustomizerProps {
  config: BackgroundMediaConfig;
  onChange: (config: BackgroundMediaConfig) => void;
}

type BgType = "color" | "gradient" | "video" | "gif";

const TYPE_OPTIONS: { type: BgType; label: string; icon: React.ElementType; description: string }[] = [
  { type: "color", label: "Color", icon: Paintbrush, description: "Solid background color" },
  { type: "gradient", label: "Gradient", icon: Layers, description: "Gradient (from Colors tab)" },
  { type: "video", label: "Video", icon: Film, description: "Looping video background" },
  { type: "gif", label: "GIF", icon: ImagePlay, description: "Animated GIF background" },
];

const ACCEPTED_MIME: Record<"video" | "gif", string> = {
  video: "video/mp4,video/webm",
  gif: "image/gif",
};

type UploadState = "idle" | "uploading" | "done" | "error";

export const BackgroundMediaCustomizer = ({ config, onChange }: BackgroundMediaCustomizerProps) => {
  const [overlayPickerOpen, setOverlayPickerOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<BackgroundMediaConfig>) =>
    onChange({ ...config, ...patch });

  const handleTypeChange = (type: BgType) => {
    onChange({ ...config, type });
    setUploadState("idle");
    setUploadError("");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadState("uploading");
    setUploadError("");

    try {
      const result = await uploadApi.uploadBackgroundMedia(file);
      update({ mediaUrl: result.filePath });
      setUploadState("done");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadState("error");
    } finally {
      // Reset input so the same file can be re-selected after an error
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearMedia = () => {
    update({ mediaUrl: undefined });
    setUploadState("idle");
    setUploadError("");
  };

  const isMedia = config.type === "video" || config.type === "gif";

  return (
    <div className="space-y-6">
      {/* ── Type selector ─────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Background Type</Label>
        <div className="grid grid-cols-4 gap-2">
          {TYPE_OPTIONS.map(({ type, label, icon: Icon, description }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              title={description}
              className={[
                "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all",
                "hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                config.type === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
        {(config.type === "color" || config.type === "gradient") && (
          <p className="text-xs text-muted-foreground">
            {config.type === "color"
              ? "Uses the Background color from the Colors tab."
              : "Uses the Background Gradient settings from the Colors tab."}
          </p>
        )}
      </div>

      {/* ── Media upload (video / gif) ─────────────────────────── */}
      {isMedia && (
        <div className="space-y-3">
          <Separator />
          <Label className="text-sm font-medium">
            {config.type === "video" ? "Video File" : "GIF File"}
          </Label>

          {config.mediaUrl ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs text-foreground">{config.mediaUrl.split("/").pop()}</p>
                <p className="text-xs text-muted-foreground">
                  {config.type === "video" ? "Video active" : "GIF active"}
                </p>
              </div>
              <button
                type="button"
                onClick={clearMedia}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-destructive/10 transition-colors"
                title="Remove media"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
              {uploadState === "uploading" ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Uploading…</span>
                </>
              ) : uploadState === "error" ? (
                <>
                  <AlertCircle className="h-6 w-6 text-destructive" />
                  <span className="text-xs text-destructive">{uploadError}</span>
                  <span className="text-xs text-muted-foreground">Click to retry</span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {config.type === "video" ? "Upload MP4 / WebM" : "Upload GIF"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {config.type === "video" ? "Up to 200 MB" : "Up to 200 MB"}
                  </span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME[config.type]}
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploadState === "uploading"}
              />
            </label>
          )}

          {uploadState === "done" && config.mediaUrl && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <CheckCircle className="h-3.5 w-3.5" />
              Uploaded successfully
            </div>
          )}

          {config.type === "video" && (
            <p className="text-xs text-muted-foreground">
              Video autoplays muted on loop. Animations pause when the visitor has
              reduced-motion enabled.
            </p>
          )}
        </div>
      )}

      {/* ── Visual effects (shown for video + gif) ─────────────── */}
      {isMedia && (
        <>
          <Separator />
          <div className="space-y-4">
            <Label className="text-sm font-medium">Visual Effects</Label>

            <SliderRow
              label="Opacity"
              value={config.opacity}
              min={0} max={1} step={0.05}
              display={`${Math.round(config.opacity * 100)}%`}
              onChange={(v) => update({ opacity: v })}
            />
            <SliderRow
              label="Blur"
              value={config.blur}
              min={0} max={50} step={1}
              display={`${config.blur}px`}
              onChange={(v) => update({ blur: v })}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-sm font-medium">Overlay</Label>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Overlay Color</Label>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 w-8 rounded border-2 border-border transition-all hover:scale-110"
                  style={{ backgroundColor: config.overlayColor }}
                  onClick={() => setOverlayPickerOpen((o) => !o)}
                />
                <Input
                  value={config.overlayColor}
                  onChange={(e) => update({ overlayColor: e.target.value })}
                  className="font-mono text-xs"
                  placeholder="#000000"
                />
                {overlayPickerOpen && (
                  <div className="absolute left-0 top-10 z-50">
                    <div className="fixed inset-0" onClick={() => setOverlayPickerOpen(false)} />
                    <div className="relative bg-card border border-border rounded-lg p-4 shadow-xl">
                      <HexColorPicker
                        color={config.overlayColor}
                        onChange={(c) => update({ overlayColor: c })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SliderRow
              label="Overlay Opacity"
              value={config.overlayOpacity}
              min={0} max={1} step={0.05}
              display={`${Math.round(config.overlayOpacity * 100)}%`}
              onChange={(v) => update({ overlayOpacity: v })}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-sm font-medium">Adjustments</Label>

            <SliderRow
              label="Brightness"
              value={config.brightness}
              min={0.1} max={2} step={0.05}
              display={config.brightness.toFixed(2)}
              onChange={(v) => update({ brightness: v })}
            />
            <SliderRow
              label="Saturation"
              value={config.saturation}
              min={0} max={3} step={0.05}
              display={config.saturation.toFixed(2)}
              onChange={(v) => update({ saturation: v })}
            />
            <SliderRow
              label="Contrast"
              value={config.contrast}
              min={0.1} max={2} step={0.05}
              display={config.contrast.toFixed(2)}
              onChange={(v) => update({ contrast: v })}
            />
            <SliderRow
              label="Scale / Zoom"
              value={config.scale}
              min={1} max={3} step={0.05}
              display={`${config.scale.toFixed(2)}×`}
              onChange={(v) => update({ scale: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Object Fit</Label>
            <Select
              value={config.objectFit}
              onValueChange={(v: "cover" | "contain" | "fill") => update({ objectFit: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover (fills screen, may crop)</SelectItem>
                <SelectItem value="contain">Contain (letterboxed)</SelectItem>
                <SelectItem value="fill">Fill (stretches to fit)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Glassmorphism on Cards</p>
              <p className="text-xs text-muted-foreground">
                Adds frosted-glass effect to link cards, improving readability over busy backgrounds.
              </p>
            </div>
            <Switch
              checked={config.glassmorphism}
              onCheckedChange={(v) => update({ glassmorphism: v })}
            />
          </div>
        </>
      )}

      {/* ── Reset button ──────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onChange({ ...defaultBackgroundMedia, type: config.type })}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
      >
        Reset background effects
      </button>
    </div>
  );
};

// Inline slider row helper
const SliderRow = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <span className="font-mono text-xs text-foreground tabular-nums">{display}</span>
    </div>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
    />
  </div>
);
