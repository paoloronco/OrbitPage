import { type ChangeEvent, type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  ImagePlay,
  Layout,
  Layers3,
  LockKeyhole,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";
import {
  type CardShadowConfig,
  type ThemeConfig,
  defaultTheme,
  getCardShadowCss,
  normalizeTheme,
} from "@/lib/theme";
import { themePresets, type ThemePreset } from "@/lib/theme-presets";
import { cardThemePresets, type CardThemePreset } from "@/lib/card-theme-presets";
import { BackgroundMediaCustomizer } from "@/components/BackgroundMediaCustomizer";
import { commitPendingTheme, parseImportedTheme, prepareThemeExport } from "./theme-save-state";
import type { SaasThemeAccess } from "@/lib/saas-plan";

interface ThemeCustomizerProps {
  theme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>;
  onThemePreview?: (theme: ThemeConfig) => void;
  renderPreview?: (theme: ThemeConfig) => ReactNode;
  accessLevel?: SaasThemeAccess;
  videoUploadsEnabled?: boolean;
  maxUploadBytes?: number | null;
  maxVideoUploadBytes?: number | null;
  managePlanHref?: string;
}

type EditableTheme = ThemeConfig & { cardBlurTint?: string };
type WorkspaceMode = "presets" | "manual";
type PresetScope = "page" | "cards";

interface ThemeColorControlProps {
  id: string;
  label: string;
  value: string;
  active: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (color: string) => void;
}

const cardShadowPresets: Array<{ id: string; label: string; value: CardShadowConfig }> = [
  { id: 'none', label: 'None', value: { color: '#07111f', offsetX: 0, offsetY: 0, blur: 0, spread: 0, opacity: 0 } },
  { id: 'soft', label: 'Soft', value: { color: '#172033', offsetX: 0, offsetY: 12, blur: 30, spread: -10, opacity: 0.2 } },
  { id: 'lifted', label: 'Lifted', value: { color: '#07111f', offsetX: 0, offsetY: 18, blur: 42, spread: -12, opacity: 0.34 } },
  { id: 'graphic', label: 'Graphic', value: { color: '#172033', offsetX: 7, offsetY: 7, blur: 0, spread: 0, opacity: 0.72 } },
];

const getPreviewBackground = (theme: ThemeConfig) => (
  theme.backgroundMedia?.type === "color"
    ? theme.background
    : `linear-gradient(${theme.backgroundGradient.direction}, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`
);

const findMatchingPreset = (theme: ThemeConfig) => themePresets.find((preset) => (
  preset.theme.primary === theme.primary &&
  preset.theme.background === theme.background &&
  preset.theme.foreground === theme.foreground &&
  preset.theme.fontFamily === theme.fontFamily &&
  preset.theme.cardRadius === theme.cardRadius
))?.id || null;

const findMatchingCardPreset = (theme: ThemeConfig) => cardThemePresets.find((preset) => (
  preset.mode === theme.contentCardMode &&
  preset.card.background === theme.contentCard.background &&
  preset.card.backgroundSecondary === theme.contentCard.backgroundSecondary &&
  preset.card.foreground === theme.contentCard.foreground &&
  preset.card.accent === theme.contentCard.accent
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
  const boxShadow = getCardShadowCss(theme.cardShadow);
  const cardStyle: CSSProperties = {
    background: `linear-gradient(${theme.contentCard.direction}, ${theme.contentCard.background}, ${theme.contentCard.backgroundSecondary})`,
    borderColor: theme.contentCard.border,
    borderRadius: `${Math.max(3, theme.cardRadius * 0.72)}px`,
    boxShadow,
  };
  const profileStyle: CSSProperties = {
    background: `linear-gradient(${theme.profileCard.direction}, ${theme.profileCard.background}, ${theme.profileCard.backgroundSecondary})`,
    borderColor: theme.profileCard.border,
    borderRadius: `${Math.max(3, theme.cardRadius * 0.72)}px`,
    boxShadow,
  };

  return (
    <div
      className={`relative overflow-hidden ${compact ? "h-44" : "h-72"}`}
      style={{ background: getPreviewBackground(theme), fontFamily: theme.fontFamily }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.18),transparent_38%)]" />
      <div className={`relative mx-auto flex h-full max-w-[15rem] flex-col ${compact ? "px-4 py-4" : "px-5 py-6"}`}>
        <div className="mb-4 flex flex-col items-center border px-3 py-3 text-center" style={profileStyle}>
          <div
            className={`${compact ? "h-9 w-9" : "h-12 w-12"} rounded-full border-2 shadow-sm`}
            style={{ backgroundColor: theme.profileCard.accent, borderColor: theme.profileCard.border }}
          />
          <div className="mt-2 h-2.5 w-20 rounded-full" style={{ backgroundColor: theme.profileCard.foreground }} />
          <div className="mt-1.5 h-1.5 w-28 rounded-full opacity-75" style={{ backgroundColor: theme.profileCard.muted }} />
        </div>
        <div className="flex flex-col" style={{ gap: `${Math.max(6, theme.cardSpacing * 0.58)}px` }}>
          <div className="flex items-center gap-2 border px-3 py-2.5" style={cardStyle}>
            <div className="h-5 w-5 rounded-md" style={{ backgroundColor: theme.primary }} />
            <div className="h-1.5 flex-1 rounded-full opacity-90" style={{ backgroundColor: theme.contentCard.foreground }} />
            <div className="h-1.5 w-5 rounded-full opacity-70" style={{ backgroundColor: theme.contentCard.muted }} />
          </div>
          <div className="border px-3 py-2.5" style={cardStyle}>
            <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: theme.contentCard.foreground }} />
            <div className="mt-2 h-1.5 w-full rounded-full opacity-70" style={{ backgroundColor: theme.contentCard.muted }} />
            <div className="mt-1.5 h-1.5 w-3/4 rounded-full opacity-70" style={{ backgroundColor: theme.contentCard.muted }} />
          </div>
          {!compact ? (
            <div
              className="flex h-9 items-center justify-center rounded-lg text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{ background: theme.contentCard.accent, color: theme.contentCard.accentForeground }}
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
          <p className="min-h-10 text-base font-bold leading-5 text-slate-950">{preset.name}</p>
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

const CardPresetCard = ({ preset, active, onApply }: { preset: CardThemePreset; active: boolean; onApply: () => void }) => (
  <article className={`w-[17rem] shrink-0 overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-xl ${active ? "border-blue-500 shadow-[0_0_0_3px_rgb(59_130_246_/_0.12)]" : "border-slate-200"}`}>
    <div className="flex h-44 flex-col gap-2 bg-slate-100 p-4" aria-hidden="true">
      {(preset.mode === 'multi' ? preset.variants.slice(0, 3) : [preset.card, preset.card]).map((variant, index) => (
        <div
          key={`${preset.id}-${index}`}
          className="flex min-h-0 flex-1 items-center gap-3 rounded-xl border px-3 shadow-sm"
          style={{ background: `linear-gradient(${variant.direction}, ${variant.background}, ${variant.backgroundSecondary})`, borderColor: variant.border }}
        >
          <span className="h-7 w-7 shrink-0 rounded-lg" style={{ background: variant.accent }} />
          <span className="h-2 flex-1 rounded-full" style={{ background: variant.foreground }} />
          <span className="h-5 w-8 rounded-md" style={{ background: variant.accent, color: variant.accentForeground }} />
        </div>
      ))}
    </div>
    <div className="space-y-3 p-4">
      <div>
        <p className="font-bold text-slate-950">{preset.name}</p>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{preset.mood}</p>
      </div>
      <p className="min-h-10 text-sm leading-5 text-slate-600">{preset.description}</p>
      <Button type="button" variant={active ? "default" : "outline"} className="w-full" onClick={onApply}>
        {active ? <Check className="mr-2 h-4 w-4" /> : <Layers3 className="mr-2 h-4 w-4" />}
        {active ? "Selected" : "Use card style"}
      </Button>
    </div>
  </article>
);

export const ThemeCustomizer = ({
  theme,
  onThemeChange,
  onThemePreview,
  renderPreview,
  accessLevel,
  videoUploadsEnabled = true,
  maxUploadBytes,
  maxVideoUploadBytes,
  managePlanHref = "/dashboard?section=billing",
}: ThemeCustomizerProps) => {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("presets");
  const [presetScope, setPresetScope] = useState<PresetScope>("page");
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [pendingTheme, setPendingTheme] = useState<EditableTheme>(theme);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => findMatchingPreset(theme));
  const [selectedCardPresetId, setSelectedCardPresetId] = useState<string | null>(() => findMatchingCardPreset(theme));
  const cardPresetRailRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const advancedCustomizationEnabled = !accessLevel || accessLevel === "advanced";
  const premiumThemesEnabled = !accessLevel || accessLevel === "premium" || accessLevel === "advanced";
  const availableThemePresets = accessLevel === "essential" ? themePresets.slice(0, 3) : themePresets;

  useEffect(() => {
    setPendingTheme(theme);
    setSelectedPresetId(findMatchingPreset(theme));
    setSelectedCardPresetId(findMatchingCardPreset(theme));
    setIsDirty(false);
    setSaveError("");
    setSaveState("idle");
  }, [theme]);

  useEffect(() => {
    if (!advancedCustomizationEnabled && workspaceMode === "manual") setWorkspaceMode("presets");
    if (!premiumThemesEnabled && presetScope === "cards") setPresetScope("page");
  }, [advancedCustomizationEnabled, premiumThemesEnabled, presetScope, workspaceMode]);

  const previewTheme = (nextTheme: EditableTheme, presetId: string | null) => {
    setPendingTheme(nextTheme);
    setSelectedPresetId(presetId);
    setIsDirty(true);
    setSaveError("");
    setSaveState("idle");
    onThemePreview?.(nextTheme);
  };

  const updatePendingTheme = (updates: Partial<EditableTheme>) => {
    if (updates.contentCard || updates.card || updates.cardGradient) setSelectedCardPresetId(null);
    const nextTheme = {
      ...pendingTheme,
      ...updates,
      orbitPageAccess: { mode: 'custom' as const, presetId: null, cardPresetId: null },
    };
    if (updates.contentCard && !updates.contentCardVariants) {
      nextTheme.contentCardMode = 'mono';
      nextTheme.contentCardVariants = [updates.contentCard];
    }
    previewTheme(nextTheme, null);
  };

  const updateCardShadow = (updates: Partial<CardShadowConfig>) => {
    updatePendingTheme({ cardShadow: { ...pendingTheme.cardShadow, ...updates } });
  };

  const applyPreset = (preset: ThemePreset) => {
    const nextTheme: EditableTheme = {
      ...preset.theme,
      content: pendingTheme.content,
      contentCard: premiumThemesEnabled ? pendingTheme.contentCard : preset.theme.contentCard,
      contentCardMode: premiumThemesEnabled ? pendingTheme.contentCardMode : preset.theme.contentCardMode,
      contentCardVariants: premiumThemesEnabled ? pendingTheme.contentCardVariants : preset.theme.contentCardVariants,
      orbitPageAccess: {
        mode: "preset",
        presetId: preset.id,
        cardPresetId: premiumThemesEnabled ? pendingTheme.orbitPageAccess?.cardPresetId || null : null,
      },
    };
    previewTheme(nextTheme, preset.id);
  };

  const applyCardPreset = (preset: CardThemePreset) => {
    const nextTheme: EditableTheme = {
      ...pendingTheme,
      card: preset.card.background,
      cardGradient: {
        from: preset.card.background,
        to: preset.card.backgroundSecondary,
        direction: preset.card.direction,
      },
      contentCard: preset.card,
      contentCardMode: preset.mode,
      contentCardVariants: preset.variants,
      orbitPageAccess: {
        mode: "preset",
        presetId: pendingTheme.orbitPageAccess?.presetId || selectedPresetId || "default",
        cardPresetId: preset.id,
      },
    };
    previewTheme(nextTheme, selectedPresetId);
    setSelectedCardPresetId(preset.id);
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
        importedTheme.orbitPageAccess = { mode: "custom", presetId: null, cardPresetId: null };
        setPendingTheme(importedTheme);
        setSelectedPresetId(findMatchingPreset(importedTheme));
        setSelectedCardPresetId(findMatchingCardPreset(importedTheme));
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
    previewTheme({
      ...defaultTheme,
      content: pendingTheme.content,
      orbitPageAccess: { mode: "preset", presetId: "default", cardPresetId: null },
    }, findMatchingPreset(defaultTheme));
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

  const livePreviewPanel = (
    <aside className="sticky top-5 min-w-0 space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Live page</p>
          <p className="mt-1 font-bold text-slate-950">
            {selectedPresetId ? themePresets.find((preset) => preset.id === selectedPresetId)?.name : "Custom theme"}
          </p>
        </div>
        <div className="flex gap-1.5" aria-label="Active theme colors">
          {[pendingTheme.background, pendingTheme.card, pendingTheme.primary, pendingTheme.foreground].map((color, index) => (
            <span key={`${color}-${index}`} className="h-6 w-6 rounded-md border border-slate-200" style={{ backgroundColor: color }} title={color} />
          ))}
        </div>
      </div>
      {renderPreview ? renderPreview(pendingTheme) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <ThemeMockup theme={pendingTheme} />
        </div>
      )}
      <p className="px-1 text-xs leading-5 text-slate-500">This is the same renderer used by the public page. Changes remain a preview until you save the theme.</p>
    </aside>
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
            {advancedCustomizationEnabled ? (
              <Button type="button" variant="outline" asChild className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white">
                <label className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" /> Import
                  <input type="file" accept=".json" onChange={importTheme} className="hidden" />
                </label>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled className="border-slate-700 bg-transparent text-slate-400">
                <LockKeyhole className="mr-2 h-4 w-4" /> Import
              </Button>
            )}
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
          onClick={() => advancedCustomizationEnabled && setWorkspaceMode("manual")}
          disabled={!advancedCustomizationEnabled}
          aria-pressed={workspaceMode === "manual"}
          className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all ${workspaceMode === "manual" ? "border-blue-500 bg-blue-50 shadow-[0_0_0_3px_rgb(59_130_246_/_0.1)]" : "border-slate-200 bg-white hover:border-slate-300"} ${!advancedCustomizationEnabled ? "cursor-not-allowed opacity-65" : ""}`}
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${workspaceMode === "manual" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><SlidersHorizontal className="h-5 w-5" /></span>
          <span>
            <span className="block font-bold text-slate-950">Fine tuning {!advancedCustomizationEnabled && <LockKeyhole className="ml-1 inline h-4 w-4" />}</span>
            <span className="mt-1 block text-sm leading-5 text-slate-600">{advancedCustomizationEnabled ? "Edit every color, surface, type and layout value without restrictions." : "Advanced customization is available on Pro."}</span>
          </span>
        </button>
      </div>

      {workspaceMode === "presets" ? (
        <div className="admin-theme-layout">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-6">
          <div className="relative mb-6 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
            <span className={`pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out ${presetScope === "cards" ? "translate-x-full" : "translate-x-0"}`} />
            <button type="button" onClick={() => setPresetScope("page")} className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${presetScope === "page" ? "text-blue-700" : "text-slate-600"}`}>
              <Palette className="h-4 w-4" /> Page themes
            </button>
            <button type="button" disabled={!premiumThemesEnabled} onClick={() => premiumThemesEnabled && setPresetScope("cards")} className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${presetScope === "cards" ? "text-blue-700" : "text-slate-600"} ${!premiumThemesEnabled ? "cursor-not-allowed opacity-60" : ""}`}>
              {premiumThemesEnabled ? <Layers3 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />} Card styles
            </button>
          </div>
          {presetScope === "page" ? (
            <>
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{availableThemePresets.length} page themes</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">Page identity and background</h3>
                </div>
                <p className="text-sm text-slate-500">{premiumThemesEnabled ? "Page themes leave your selected card style untouched." : "Essential themes style the complete page."}</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {availableThemePresets.map((preset) => (
                  <PresetCard key={preset.id} preset={preset} active={selectedPresetId === preset.id} onApply={() => applyPreset(preset)} />
                ))}
              </div>
              {!premiumThemesEnabled && (
                <div className="admin-inline-plan-lock mt-5">
                  <LockKeyhole className="h-4 w-4" />
                  <span>Starter adds premium page themes and card styles.</span>
                  <a href={managePlanHref} target="_top">View plans</a>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">6 Mono + 6 Multi</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">Ready-balanced Mono and Multi cards</h3>
                  <p className="mt-1 text-sm text-slate-500">Surface, text, borders, icons and CTA are designed as one palette.</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label="Previous card styles" onClick={() => cardPresetRailRef.current?.scrollBy({ left: -300, behavior: "smooth" })}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="icon" aria-label="Next card styles" onClick={() => cardPresetRailRef.current?.scrollBy({ left: 300, behavior: "smooth" })}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <div ref={cardPresetRailRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1 [scrollbar-width:thin]">
                {cardThemePresets.map((preset) => (
                  <div key={preset.id} className="snap-start"><CardPresetCard preset={preset} active={selectedCardPresetId === preset.id} onApply={() => applyCardPreset(preset)} /></div>
                ))}
              </div>
            </>
          )}
        </section>
        {livePreviewPanel}
        </div>
      ) : (
        <section className="admin-theme-layout">
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
                    {colorControl("card", "Card background", pendingTheme.contentCard.background, (card) => updatePendingTheme({ card, cardGradient: { ...pendingTheme.cardGradient, from: card }, contentCard: { ...pendingTheme.contentCard, background: card } }))}
                    {colorControl("cardTint", "Card blur tint", pendingTheme.cardBlurTint || pendingTheme.card, (cardBlurTint) => updatePendingTheme({ cardBlurTint }))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-bold text-slate-900">Content cards</h4>
                  <p className="mt-1 text-sm text-slate-500">Fine tune the selected card style without changing the page or profile palette.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("contentForeground", "Card text", pendingTheme.contentCard.foreground, (foreground) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, foreground } }))}
                    {colorControl("contentMuted", "Secondary text", pendingTheme.contentCard.muted, (muted) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, muted } }))}
                    {colorControl("contentBorder", "Card border", pendingTheme.contentCard.border, (border) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, border } }))}
                    {colorControl("contentAccent", "Icons & CTA", pendingTheme.contentCard.accent, (accent) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, accent } }))}
                    {colorControl("contentAccentForeground", "CTA text", pendingTheme.contentCard.accentForeground, (accentForeground) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, accentForeground } }))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-bold text-slate-900">Profile card</h4>
                  <p className="mt-1 text-sm text-slate-500">A dedicated palette for the page header, logo, profile text and social actions.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("profileBackground", "Background start", pendingTheme.profileCard.background, (background) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, background } }))}
                    {colorControl("profileBackgroundSecondary", "Background end", pendingTheme.profileCard.backgroundSecondary, (backgroundSecondary) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, backgroundSecondary } }))}
                    {colorControl("profileForeground", "Profile text", pendingTheme.profileCard.foreground, (foreground) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, foreground } }))}
                    {colorControl("profileMuted", "Profile secondary text", pendingTheme.profileCard.muted, (muted) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, muted } }))}
                    {colorControl("profileBorder", "Profile border", pendingTheme.profileCard.border, (border) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, border } }))}
                    {colorControl("profileAccent", "Logo & social accent", pendingTheme.profileCard.accent, (accent) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, accent } }))}
                  </div>
                  <div className="mt-4 max-w-sm space-y-2">
                    <Label>Profile gradient direction</Label>
                    <Select value={pendingTheme.profileCard.direction} onValueChange={(direction) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, direction } })}>
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
                      {colorControl("cardGradientFrom", "Start", pendingTheme.contentCard.background, (from) => updatePendingTheme({ card: from, cardGradient: { ...pendingTheme.cardGradient, from }, contentCard: { ...pendingTheme.contentCard, background: from } }))}
                      {colorControl("cardGradientTo", "End", pendingTheme.contentCard.backgroundSecondary, (to) => updatePendingTheme({ cardGradient: { ...pendingTheme.cardGradient, to }, contentCard: { ...pendingTheme.contentCard, backgroundSecondary: to } }))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Direction</Label>
                      <Select value={pendingTheme.contentCard.direction} onValueChange={(direction) => updatePendingTheme({ cardGradient: { ...pendingTheme.cardGradient, direction }, contentCard: { ...pendingTheme.contentCard, direction } })}>
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
                    <Label>Surface blur <span className="text-slate-500">{pendingTheme.blurIntensity}px</span></Label>
                    <Slider value={[pendingTheme.blurIntensity]} onValueChange={([blurIntensity]) => updatePendingTheme({ blurIntensity })} max={50} min={0} step={1} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <h4 className="font-bold text-slate-900">Card shadow</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-500">Shape the depth of profile and content cards. Start from a style, then tune every value.</p>
                    </div>
                    <div className="flex flex-wrap gap-2" aria-label="Card shadow styles">
                      {cardShadowPresets.map((preset) => (
                        <Button
                          key={preset.id}
                          type="button"
                          size="sm"
                          variant={JSON.stringify(pendingTheme.cardShadow) === JSON.stringify(preset.value) ? 'default' : 'outline'}
                          onClick={() => updatePendingTheme({ cardShadow: preset.value })}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_12rem]">
                    <div className="grid gap-6 sm:grid-cols-2">
                      {colorControl('cardShadowColor', 'Shadow color', pendingTheme.cardShadow.color, (color) => updateCardShadow({ color }))}
                      <div className="space-y-3">
                        <Label>Opacity <span className="text-slate-500">{Math.round(pendingTheme.cardShadow.opacity * 100)}%</span></Label>
                        <Slider value={[pendingTheme.cardShadow.opacity]} onValueChange={([opacity]) => updateCardShadow({ opacity })} max={1} min={0} step={0.01} />
                      </div>
                      <div className="space-y-3">
                        <Label>Horizontal offset <span className="text-slate-500">{pendingTheme.cardShadow.offsetX}px</span></Label>
                        <Slider value={[pendingTheme.cardShadow.offsetX]} onValueChange={([offsetX]) => updateCardShadow({ offsetX })} max={32} min={-32} step={1} />
                      </div>
                      <div className="space-y-3">
                        <Label>Vertical offset <span className="text-slate-500">{pendingTheme.cardShadow.offsetY}px</span></Label>
                        <Slider value={[pendingTheme.cardShadow.offsetY]} onValueChange={([offsetY]) => updateCardShadow({ offsetY })} max={48} min={-32} step={1} />
                      </div>
                      <div className="space-y-3">
                        <Label>Softness <span className="text-slate-500">{pendingTheme.cardShadow.blur}px</span></Label>
                        <Slider value={[pendingTheme.cardShadow.blur]} onValueChange={([blur]) => updateCardShadow({ blur })} max={96} min={0} step={1} />
                      </div>
                      <div className="space-y-3">
                        <Label>Spread <span className="text-slate-500">{pendingTheme.cardShadow.spread}px</span></Label>
                        <Slider value={[pendingTheme.cardShadow.spread]} onValueChange={([spread]) => updateCardShadow({ spread })} max={48} min={-32} step={1} />
                      </div>
                    </div>

                    <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-8">
                      <div
                        className="h-24 w-28 border"
                        style={{
                          background: `linear-gradient(${pendingTheme.contentCard.direction}, ${pendingTheme.contentCard.background}, ${pendingTheme.contentCard.backgroundSecondary})`,
                          borderColor: pendingTheme.contentCard.border,
                          borderRadius: `${pendingTheme.cardRadius}px`,
                          boxShadow: getCardShadowCss(pendingTheme.cardShadow),
                        }}
                        aria-label="Card shadow preview"
                      />
                    </div>
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
                <BackgroundMediaCustomizer
                  config={pendingTheme.backgroundMedia}
                  onChange={(backgroundMedia) => updatePendingTheme({ backgroundMedia })}
                  videoUploadsEnabled={videoUploadsEnabled}
                  maxUploadBytes={maxUploadBytes}
                  maxVideoUploadBytes={maxVideoUploadBytes}
                  managePlanHref={managePlanHref}
                />
              </TabsContent>
            </Tabs>
          </div>

          {livePreviewPanel}
        </section>
      )}
    </div>
  );
};
