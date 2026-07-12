import { type ChangeEvent, type CSSProperties, useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Eye,
  FileDown,
  ImagePlay,
  Layout,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import { type ThemeConfig, defaultTheme, normalizeTheme } from "@/lib/theme";
import { themePresets, type ThemePreset } from "@/lib/theme-presets";
import { BackgroundMediaCustomizer } from "@/components/BackgroundMediaCustomizer";
import { commitPendingTheme, parseImportedTheme, prepareThemeExport } from "./theme-save-state";

interface ThemeCustomizerProps {
  theme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>;
  onThemePreview?: (theme: ThemeConfig) => void;
}

type EditableTheme = ThemeConfig & { cardBlurTint?: string };
type WorkspaceMode = "presets" | "manual";

interface ThemeColorControlProps {
  id: string;
  label: string;
  value: string;
  active: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (color: string) => void;
}

const getPreviewBackground = (theme: ThemeConfig) => (
  theme.backgroundMedia?.type === "color"
    ? theme.background
    : `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`
);

const findMatchingPreset = (theme: ThemeConfig) => themePresets.find((preset) => (
  preset.theme.primary === theme.primary &&
  preset.theme.background === theme.background &&
  preset.theme.card === theme.card &&
  preset.theme.foreground === theme.foreground &&
  preset.theme.fontFamily === theme.fontFamily &&
  preset.theme.cardRadius === theme.cardRadius
))?.id || null;

const ThemeColorControl = ({
  id,
  label,
  value,
  active,
  onToggle,
  onClose,
  onChange,
}: ThemeColorControlProps) => (
  <div className="relative space-y-2">
    <Label htmlFor={`theme-${id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
      {label}
    </Label>
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Choose ${label}`}
        aria-expanded={active}
        onClick={onToggle}
        className="h-10 w-10 shrink-0 rounded-lg border-2 border-white shadow-[0_0_0_1px_rgb(203_213_225)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ backgroundColor: value }}
      />
      <Input
        id={`theme-${id}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 font-mono text-xs uppercase"
        placeholder="#000000"
      />
    </div>
    {active ? (
      <div className="absolute left-0 top-full z-50 mt-2">
        <button type="button" className="fixed inset-0 cursor-default" aria-label="Close color picker" onClick={onClose} />
        <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
          <HexColorPicker color={value} onChange={onChange} />
        </div>
      </div>
    ) : null}
  </div>
);

const ThemeMockup = ({ theme, compact = false }: { theme: ThemeConfig; compact?: boolean }) => {
  const cardStyle: CSSProperties = {
    background: `linear-gradient(${theme.cardGradient.direction}, ${theme.cardGradient.from}, ${theme.cardGradient.to})`,
    borderColor: theme.border,
    borderRadius: `${Math.max(3, theme.cardRadius * 0.72)}px`,
  };

  return (
    <div
      className={`relative overflow-hidden ${compact ? "h-44" : "h-72"}`}
      style={{ background: getPreviewBackground(theme), fontFamily: theme.fontFamily }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.18),transparent_38%)]" />
      <div className={`relative mx-auto flex h-full max-w-[15rem] flex-col ${compact ? "px-4 py-4" : "px-5 py-6"}`}>
        <div className="mb-4 flex flex-col items-center text-center">
          <div
            className={`${compact ? "h-9 w-9" : "h-12 w-12"} rounded-full border-2 shadow-sm`}
            style={{ backgroundColor: theme.primary, borderColor: theme.primaryGlow }}
          />
          <div className="mt-2 h-2.5 w-20 rounded-full" style={{ backgroundColor: theme.foreground }} />
          <div className="mt-1.5 h-1.5 w-28 rounded-full opacity-60" style={{ backgroundColor: theme.muted }} />
        </div>
        <div className="flex flex-col" style={{ gap: `${Math.max(6, theme.cardSpacing * 0.58)}px` }}>
          <div className="flex items-center gap-2 border px-3 py-2.5 shadow-sm" style={cardStyle}>
            <div className="h-5 w-5 rounded-md" style={{ backgroundColor: theme.primary }} />
            <div className="h-1.5 flex-1 rounded-full opacity-90" style={{ backgroundColor: theme.foreground }} />
            <div className="h-1.5 w-5 rounded-full opacity-50" style={{ backgroundColor: theme.muted }} />
          </div>
          <div className="border px-3 py-2.5 shadow-sm" style={cardStyle}>
            <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: theme.foreground }} />
            <div className="mt-2 h-1.5 w-full rounded-full opacity-50" style={{ backgroundColor: theme.muted }} />
            <div className="mt-1.5 h-1.5 w-3/4 rounded-full opacity-50" style={{ backgroundColor: theme.muted }} />
          </div>
          {!compact ? (
            <div
              className="flex h-9 items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryGlow})`, color: theme.background }}
            >
              Call to action
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const PresetCard = ({ preset, active, onApply }: { preset: ThemePreset; active: boolean; onApply: () => void }) => (
  <article className={`group overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-xl ${active ? "border-blue-500 shadow-[0_0_0_3px_rgb(59_130_246_/_0.12)]" : "border-slate-200"}`}>
    <ThemeMockup theme={preset.theme} compact />
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-950">{preset.name}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{preset.mood}</p>
        </div>
        <div className="flex shrink-0 -space-x-1">
          {[preset.theme.background, preset.theme.card, preset.theme.primary].map((color) => (
            <span key={color} className="h-5 w-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>
      <p className="min-h-10 text-sm leading-5 text-slate-600">{preset.description}</p>
      <Button type="button" variant={active ? "default" : "outline"} className="w-full" onClick={onApply}>
        {active ? <Check className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
        {active ? "Selected" : "Use this theme"}
      </Button>
    </div>
  </article>
);

export const ThemeCustomizer = ({ theme, onThemeChange, onThemePreview }: ThemeCustomizerProps) => {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("presets");
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [pendingTheme, setPendingTheme] = useState<EditableTheme>(theme);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => findMatchingPreset(theme));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setPendingTheme(theme);
    setSelectedPresetId(findMatchingPreset(theme));
    setIsDirty(false);
    setSaveError("");
    setSaveState("idle");
  }, [theme]);

  const previewTheme = (nextTheme: EditableTheme, presetId: string | null) => {
    setPendingTheme(nextTheme);
    setSelectedPresetId(presetId);
    setIsDirty(true);
    setSaveError("");
    setSaveState("idle");
    onThemePreview?.(nextTheme);
  };

  const updatePendingTheme = (updates: Partial<EditableTheme>) => {
    previewTheme({ ...pendingTheme, ...updates }, null);
  };

  const applyPreset = (preset: ThemePreset) => {
    const nextTheme: EditableTheme = {
      ...preset.theme,
      content: pendingTheme.content,
    };
    previewTheme(nextTheme, preset.id);
  };

  const saveTheme = async () => {
    if (!isDirty) return;
    setSaveState("saving");
    setSaveError("");
    const result = await commitPendingTheme({ isDirty, theme: pendingTheme, onSave: onThemeChange });
    setIsDirty(result.isDirty);
    setSaveError(result.error);
    if (result.saved) {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } else if (result.error) {
      setSaveState("error");
    } else {
      setSaveState("idle");
    }
  };

  const exportTheme = () => {
    const dataBlob = new Blob([prepareThemeExport(pendingTheme)], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orbitpage-theme.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importTheme = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const result = parseImportedTheme(loadEvent.target?.result as string, normalizeTheme);
        const importedTheme = result.theme as EditableTheme;
        setPendingTheme(importedTheme);
        setSelectedPresetId(findMatchingPreset(importedTheme));
        setIsDirty(result.isDirty);
        setSaveError(result.error);
        setSaveState("idle");
        onThemePreview?.(importedTheme);
      } catch (error) {
        console.error("Failed to import theme:", error);
        setSaveError("Theme import failed. Choose a valid JSON theme file.");
        setSaveState("error");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const resetTheme = () => {
    previewTheme({ ...defaultTheme, content: pendingTheme.content }, findMatchingPreset(defaultTheme));
  };

  const colorControl = (id: string, label: string, value: string, onChange: (color: string) => void) => (
    <ThemeColorControl
      id={id}
      label={label}
      value={value}
      active={activeColorPicker === id}
      onToggle={() => setActiveColorPicker(activeColorPicker === id ? null : id)}
      onClose={() => setActiveColorPicker(null)}
      onChange={onChange}
    />
  );

  return (
    <div className="space-y-6" data-onboarding="theme-customizer">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-[0_24px_70px_rgb(15_23_42_/_0.18)]">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
              <Sparkles className="h-4 w-4" />
              Theme Studio
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Choose a complete look. Then make it yours.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Presets style the public background, profile, cards, type and effects together. Every value remains available in Fine tuning.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveTheme} disabled={!isDirty || saveState === "saving"} className="bg-blue-500 text-white hover:bg-blue-400">
              {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save theme"}
            </Button>
            <Button type="button" variant="outline" onClick={exportTheme} className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white">
              <FileDown className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button type="button" variant="outline" asChild className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white">
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" /> Import
                <input type="file" accept=".json" onChange={importTheme} className="hidden" />
              </label>
            </Button>
          </div>
        </div>
        {(isDirty || saveState === "saved" || saveState === "error") ? (
          <div className={`flex items-center gap-2 border-t px-5 py-3 text-sm sm:px-7 ${saveState === "error" ? "border-red-900/60 bg-red-950/60 text-red-200" : saveState === "saved" ? "border-emerald-900/60 bg-emerald-950/50 text-emerald-200" : "border-amber-900/50 bg-amber-950/35 text-amber-100"}`} role={saveState === "error" ? "alert" : "status"}>
            {saveState === "error" ? <AlertTriangle className="h-4 w-4" /> : saveState === "saved" ? <CheckCircle className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-amber-400" />}
            <span>{saveState === "error" ? saveError || "Theme could not be saved." : saveState === "saved" ? "Theme saved successfully." : "Preview active. Save when you are ready to publish it."}</span>
          </div>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2" aria-label="Theme workflow">
        <button
          type="button"
          onClick={() => setWorkspaceMode("presets")}
          aria-pressed={workspaceMode === "presets"}
          className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all ${workspaceMode === "presets" ? "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgb(59_130_246_/_0.1)]" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${workspaceMode === "presets" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><Palette className="h-5 w-5" /></span>
          <span>
            <span className="block font-bold text-slate-950">Ready-made themes</span>
            <span className="mt-1 block text-sm leading-5 text-slate-600">Start from a complete visual system with a real page mockup.</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceMode("manual")}
          aria-pressed={workspaceMode === "manual"}
          className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all ${workspaceMode === "manual" ? "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgb(59_130_246_/_0.1)]" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${workspaceMode === "manual" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><SlidersHorizontal className="h-5 w-5" /></span>
          <span>
            <span className="block font-bold text-slate-950">Fine tuning</span>
            <span className="mt-1 block text-sm leading-5 text-slate-600">Edit every color, surface, type and layout value without restrictions.</span>
          </span>
        </button>
      </div>

      {workspaceMode === "presets" ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">12 starting points</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Pick by personality, not by hex code</h3>
            </div>
            <p className="text-sm text-slate-500">Applying a preset changes the live preview, not the saved page.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {themePresets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} active={selectedPresetId === preset.id} onApply={() => applyPreset(preset)} />
            ))}
          </div>
        </section>
      ) : (
        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Manual controls</p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">Fine tuning</h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={resetTheme}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset defaults
              </Button>
            </div>

            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-100 p-1 sm:grid-cols-4">
                <TabsTrigger value="colors" className="gap-1.5 py-2.5"><Palette className="h-4 w-4" /> Colors</TabsTrigger>
                <TabsTrigger value="typography" className="gap-1.5 py-2.5"><Type className="h-4 w-4" /> Type</TabsTrigger>
                <TabsTrigger value="layout" className="gap-1.5 py-2.5"><Layout className="h-4 w-4" /> Layout</TabsTrigger>
                <TabsTrigger value="background" className="gap-1.5 py-2.5"><ImagePlay className="h-4 w-4" /> Background</TabsTrigger>
              </TabsList>

              <TabsContent value="colors" className="mt-6 space-y-7" data-onboarding="theme-colors">
                <div>
                  <h4 className="font-bold text-slate-900">Core palette</h4>
                  <p className="mt-1 text-sm text-slate-500">Shared by the page, profile, cards and calls to action.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("primary", "Primary", pendingTheme.primary, (primary) => updatePendingTheme({ primary, accent: primary }))}
                    {colorControl("primaryGlow", "Primary glow", pendingTheme.primaryGlow, (primaryGlow) => updatePendingTheme({ primaryGlow }))}
                    {colorControl("foreground", "Main text", pendingTheme.foreground, (foreground) => updatePendingTheme({ foreground }))}
                    {colorControl("muted", "Muted text", pendingTheme.muted, (muted) => updatePendingTheme({ muted }))}
                    {colorControl("border", "Borders", pendingTheme.border, (border) => updatePendingTheme({ border }))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-bold text-slate-900">Surfaces</h4>
                  <p className="mt-1 text-sm text-slate-500">Control the page canvas and every card surface independently.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("background", "Background", pendingTheme.background, (background) => updatePendingTheme({
                      background,
                      ...(pendingTheme.backgroundMedia?.type === "gradient" ? { backgroundGradient: { ...pendingTheme.backgroundGradient, from: background } } : {}),
                    }))}
                    {colorControl("backgroundSecondary", "Secondary surface", pendingTheme.backgroundSecondary, (backgroundSecondary) => updatePendingTheme({ backgroundSecondary }))}
                    {colorControl("card", "Card background", pendingTheme.card, (card) => updatePendingTheme({ card, cardGradient: { ...pendingTheme.cardGradient, from: card } }))}
                    {colorControl("cardTint", "Card blur tint", pendingTheme.cardBlurTint || pendingTheme.card, (cardBlurTint) => updatePendingTheme({ cardBlurTint }))}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-7 lg:grid-cols-2">
                  <div>
                    <h4 className="font-bold text-slate-900">Background gradient</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {colorControl("bgGradientFrom", "Start", pendingTheme.backgroundGradient.from, (from) => updatePendingTheme({ backgroundGradient: { ...pendingTheme.backgroundGradient, from } }))}
                      {colorControl("bgGradientTo", "End", pendingTheme.backgroundGradient.to, (to) => updatePendingTheme({ backgroundGradient: { ...pendingTheme.backgroundGradient, to } }))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Direction</Label>
                      <Select value={pendingTheme.backgroundGradient.direction} onValueChange={(direction) => updatePendingTheme({ backgroundGradient: { ...pendingTheme.backgroundGradient, direction } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0deg">Top to bottom</SelectItem>
                          <SelectItem value="90deg">Left to right</SelectItem>
                          <SelectItem value="135deg">Diagonal down</SelectItem>
                          <SelectItem value="45deg">Diagonal up</SelectItem>
                          <SelectItem value="180deg">Bottom to top</SelectItem>
                          <SelectItem value="270deg">Right to left</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Card gradient</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {colorControl("cardGradientFrom", "Start", pendingTheme.cardGradient.from, (from) => updatePendingTheme({ cardGradient: { ...pendingTheme.cardGradient, from } }))}
                      {colorControl("cardGradientTo", "End", pendingTheme.cardGradient.to, (to) => updatePendingTheme({ cardGradient: { ...pendingTheme.cardGradient, to } }))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Direction</Label>
                      <Select value={pendingTheme.cardGradient.direction} onValueChange={(direction) => updatePendingTheme({ cardGradient: { ...pendingTheme.cardGradient, direction } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0deg">Top to bottom</SelectItem>
                          <SelectItem value="90deg">Left to right</SelectItem>
                          <SelectItem value="135deg">Diagonal down</SelectItem>
                          <SelectItem value="45deg">Diagonal up</SelectItem>
                          <SelectItem value="180deg">Bottom to top</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="typography" className="mt-6 space-y-5">
                <div>
                  <h4 className="font-bold text-slate-900">Page typeface</h4>
                  <p className="mt-1 text-sm text-slate-500">Applied to profile, cards, labels and calls to action.</p>
                </div>
                <div className="max-w-xl space-y-2">
                  <Label>Font family</Label>
                  <Select value={pendingTheme.fontFamily} onValueChange={(fontFamily) => updatePendingTheme({ fontFamily })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter, system-ui, sans-serif">Inter</SelectItem>
                      <SelectItem value="Poppins, system-ui, sans-serif">Poppins</SelectItem>
                      <SelectItem value="Roboto, system-ui, sans-serif">Roboto</SelectItem>
                      <SelectItem value="Montserrat, system-ui, sans-serif">Montserrat</SelectItem>
                      <SelectItem value="Open Sans, system-ui, sans-serif">Open Sans</SelectItem>
                      <SelectItem value="Lato, system-ui, sans-serif">Lato</SelectItem>
                      <SelectItem value="Playfair Display, Georgia, serif">Playfair Display</SelectItem>
                      <SelectItem value="Georgia, serif">Georgia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                  Individual profile and card font sizes remain available in their respective editors and are not overwritten by a preset.
                </div>
              </TabsContent>

              <TabsContent value="layout" className="mt-6 space-y-7">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label>Card radius <span className="text-slate-500">{pendingTheme.cardRadius}px</span></Label>
                    <Slider value={[pendingTheme.cardRadius]} onValueChange={([cardRadius]) => updatePendingTheme({ cardRadius })} max={28} min={0} step={1} />
                  </div>
                  <div className="space-y-3">
                    <Label>Card spacing <span className="text-slate-500">{pendingTheme.cardSpacing}px</span></Label>
                    <Slider value={[pendingTheme.cardSpacing]} onValueChange={([cardSpacing]) => updatePendingTheme({ cardSpacing })} max={32} min={4} step={1} />
                  </div>
                  <div className="space-y-3">
                    <Label>Glow intensity <span className="text-slate-500">{pendingTheme.glowIntensity.toFixed(1)}</span></Label>
                    <Slider value={[pendingTheme.glowIntensity]} onValueChange={([glowIntensity]) => updatePendingTheme({ glowIntensity })} max={1} min={0} step={0.1} />
                  </div>
                  <div className="space-y-3">
                    <Label>Blur intensity <span className="text-slate-500">{pendingTheme.blurIntensity}px</span></Label>
                    <Slider value={[pendingTheme.blurIntensity]} onValueChange={([blurIntensity]) => updatePendingTheme({ blurIntensity })} max={50} min={0} step={1} />
                  </div>
                </div>
                <div className="max-w-xl space-y-2">
                  <Label>Public page width</Label>
                  <Select value={pendingTheme.maxWidth} onValueChange={(maxWidth) => updatePendingTheme({ maxWidth })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20rem">Small · 320px</SelectItem>
                      <SelectItem value="24rem">Medium · 384px</SelectItem>
                      <SelectItem value="28rem">Large · 448px</SelectItem>
                      <SelectItem value="32rem">Extra large · 512px</SelectItem>
                      <SelectItem value="36rem">XXL · 576px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="background" className="mt-6">
                <BackgroundMediaCustomizer config={pendingTheme.backgroundMedia} onChange={(backgroundMedia) => updatePendingTheme({ backgroundMedia })} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="sticky top-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <ThemeMockup theme={pendingTheme} />
            <div className="space-y-4 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Current preview</p>
                <p className="mt-1 font-bold text-slate-950">{selectedPresetId ? themePresets.find((preset) => preset.id === selectedPresetId)?.name : "Custom theme"}</p>
              </div>
              <div className="flex gap-2">
                {[pendingTheme.background, pendingTheme.card, pendingTheme.primary, pendingTheme.foreground].map((color, index) => (
                  <span key={`${color}-${index}`} className="h-7 flex-1 rounded-md border border-slate-200" style={{ backgroundColor: color }} title={color} />
                ))}
              </div>
              <p className="text-xs leading-5 text-slate-500">The mockup updates immediately. Saving publishes the same theme across the profile and every public card.</p>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
};
