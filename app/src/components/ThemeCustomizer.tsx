import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { OrbitLoader } from "@/components/ui/orbit-loader";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImagePlay,
  Info,
  Layout,
  Layers3,
  LockKeyhole,
  Palette,
  RotateCcw,
  Type,
} from "@/components/ui/material-icons";
import {
  type CardShadowConfig,
  type CardSurfaceEffect,
  type ThemeConfig,
  defaultTheme,
  getCardSurfaceGradient,
  getCardShadowCss,
} from "@/lib/theme";
import { themePresets, type ThemePreset } from "@/lib/theme-presets";
import { cardThemePresets, type CardThemePreset } from "@/lib/card-theme-presets";
import { BackgroundMediaCustomizer } from "@/components/BackgroundMediaCustomizer";
import { commitPendingTheme } from "./theme-save-state";
import type { HostedThemeAccess } from "@/lib/hosted-editor-contract";
import { PreviewDeviceToggle, type PreviewDevice } from "./LivePreview";
import { useAppI18n } from "@/lib/i18n";
import { Comparison, ComparisonHandle, ComparisonItem } from "@/components/ui/comparison";

interface ThemeCustomizerProps {
  theme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>;
  onThemePreview?: (theme: ThemeConfig) => void;
  renderPreview?: (theme: ThemeConfig, device: PreviewDevice) => ReactNode;
  showEmbeddedPreview?: boolean;
  accessLevel?: HostedThemeAccess;
  videoUploadsEnabled?: boolean;
  maxUploadBytes?: number | null;
  maxVideoUploadBytes?: number | null;
  managePlanHref?: string;
}

export type EditableTheme = ThemeConfig & { cardBlurTint?: string };
type PresetScope = "page" | "cards";

interface ThemeColorControlProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (color: string) => void;
}

const FONT_FAMILY_OPTIONS = [
  ["Inter, system-ui, sans-serif", "Inter"],
  ["Poppins, system-ui, sans-serif", "Poppins"],
  ["Roboto, system-ui, sans-serif", "Roboto"],
  ["Montserrat, system-ui, sans-serif", "Montserrat"],
  ["Open Sans, system-ui, sans-serif", "Open Sans"],
  ["Lato, system-ui, sans-serif", "Lato"],
  ["Playfair Display, Georgia, serif", "Playfair Display"],
  ["Georgia, serif", "Georgia"],
] as const;

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

const sameCardSurface = (left: ThemeConfig['contentCard'], right: ThemeConfig['contentCard']) => (
  Object.keys(left).every((key) => left[key as keyof typeof left] === right[key as keyof typeof right])
);

const findMatchingCardPreset = (theme: ThemeConfig) => cardThemePresets.find((preset) => (
  preset.mode === theme.contentCardMode &&
  sameCardSurface(preset.card, theme.contentCard) &&
  preset.variants.length === theme.contentCardVariants.length &&
  preset.variants.every((variant, index) => sameCardSurface(variant, theme.contentCardVariants[index]))
))?.id || null;

export const buildPagePresetTheme = (
  pendingTheme: EditableTheme,
  preset: ThemePreset,
  accessLevel?: HostedThemeAccess,
): EditableTheme => {
  const advanced = !accessLevel || accessLevel === "advanced";
  const premium = advanced || accessLevel === "premium";
  const cardPresetId = premium ? findMatchingCardPreset(pendingTheme) : null;
  const preserveCards = advanced || Boolean(cardPresetId);
  return {
    ...preset.theme,
    content: pendingTheme.content,
    contentCard: preserveCards ? pendingTheme.contentCard : preset.theme.contentCard,
    contentCardMode: preserveCards ? pendingTheme.contentCardMode : preset.theme.contentCardMode,
    contentCardVariants: preserveCards ? pendingTheme.contentCardVariants : preset.theme.contentCardVariants,
    profileCardEffect: advanced ? pendingTheme.profileCardEffect : preset.theme.profileCardEffect,
    contentCardEffect: advanced ? pendingTheme.contentCardEffect : preset.theme.contentCardEffect,
    profileCardOpacity: advanced ? pendingTheme.profileCardOpacity : preset.theme.profileCardOpacity,
    contentCardOpacity: advanced ? pendingTheme.contentCardOpacity : preset.theme.contentCardOpacity,
    orbitPageAccess: { mode: "preset", presetId: preset.id, cardPresetId },
  };
};

export const buildCardPresetTheme = (
  pendingTheme: EditableTheme,
  preset: CardThemePreset,
  accessLevel?: HostedThemeAccess,
): EditableTheme => {
  const advanced = !accessLevel || accessLevel === "advanced";
  const baseTheme = advanced || pendingTheme.orbitPageAccess?.mode === "preset"
    ? pendingTheme
    : defaultTheme;
  return {
    ...baseTheme,
    content: pendingTheme.content,
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
      presetId: baseTheme.orbitPageAccess?.presetId || "default",
      cardPresetId: preset.id,
    },
  };
};

const ThemeColorControl = ({
  id,
  label,
  description,
  value,
  onChange,
}: ThemeColorControlProps) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5">
      <Label htmlFor={`theme-${id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
        {label}
      </Label>
      {description && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-slate-400 hover:text-slate-700" aria-label={`${label}: ${description}`}>
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 text-xs leading-5">{description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    <ColorPicker id={`theme-${id}`} label={label} value={value} onChange={onChange} />
  </div>
);

const FontFamilyControl = ({
  id,
  label,
  description,
  value,
  defaultLabel,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  defaultLabel?: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <p className="text-xs leading-5 text-slate-500">{description}</p>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        {defaultLabel && <SelectItem value="inherit">{defaultLabel}</SelectItem>}
        {FONT_FAMILY_OPTIONS.map(([fontFamily, name]) => <SelectItem key={fontFamily} value={fontFamily}>{name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

const ThemeMockup = ({ theme, compact = false }: { theme: ThemeConfig; compact?: boolean }) => {
  const boxShadow = getCardShadowCss(theme.cardShadow);
  const cardStyle: CSSProperties = {
    background: getCardSurfaceGradient(theme.contentCard, theme.contentCardOpacity),
    borderColor: theme.contentCard.border,
    borderRadius: `${Math.max(3, theme.cardRadius * 0.72)}px`,
    boxShadow,
  };
  const profileStyle: CSSProperties = {
    background: getCardSurfaceGradient(theme.profileCard, theme.profileCardOpacity),
    borderColor: theme.profileCard.border,
    borderRadius: `${Math.max(3, theme.cardRadius * 0.72)}px`,
    boxShadow,
  };

  return (
    <div
      className={`admin-theme-mockup relative overflow-hidden ${compact ? "admin-theme-mockup--compact h-44" : "h-72"}`}
      style={{ background: getPreviewBackground(theme), fontFamily: theme.fontFamily }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.18),transparent_38%)]" />
      <div className={`admin-theme-mockup__inner relative mx-auto flex h-full max-w-[15rem] flex-col ${compact ? "px-4 py-4" : "px-5 py-6"}`}>
        <div className="admin-theme-mockup__profile mb-4 flex flex-col items-center border px-3 py-3 text-center" style={profileStyle}>
          <div
            className={`${compact ? "h-9 w-9" : "h-12 w-12"} rounded-full border-2 shadow-sm`}
            style={{ backgroundColor: theme.profileCard.accent, borderColor: theme.profileCard.border }}
          />
          <div className="mt-2 h-2.5 w-20 rounded-full" style={{ backgroundColor: theme.profileCard.foreground }} />
          <div className="mt-1.5 h-1.5 w-28 rounded-full opacity-75" style={{ backgroundColor: theme.profileCard.muted }} />
        </div>
        <div className="admin-theme-mockup__cards flex flex-col" style={{ gap: `${Math.max(6, theme.cardSpacing * 0.58)}px` }}>
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

const PresetCard = ({ preset, active, onApply }: { preset: ThemePreset; active: boolean; onApply: () => void }) => {
  const { tr } = useAppI18n();
  return <article className={`admin-theme-preset-card group overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-xl ${active ? "border-blue-500 shadow-[0_0_0_3px_rgb(59_130_246_/_0.12)]" : "border-slate-200"}`}>
    <ThemeMockup theme={preset.theme} compact />
    <div className="admin-theme-preset-copy space-y-4 p-4">
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
        {active ? tr("Selected", "Selezionato") : tr("Use this theme", "Usa questo tema")}
      </Button>
    </div>
  </article>;
};

const CardPresetCard = ({ preset, active, onApply }: { preset: CardThemePreset; active: boolean; onApply: () => void }) => {
  const { tr } = useAppI18n();
  return <article className={`admin-theme-card-preset w-[17rem] shrink-0 overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-xl ${active ? "border-blue-500 shadow-[0_0_0_3px_rgb(59_130_246_/_0.12)]" : "border-slate-200"}`}>
    <div className="admin-theme-card-preset__preview flex h-44 flex-col gap-2 bg-slate-100 p-4" aria-hidden="true">
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
        {active ? tr("Selected", "Selezionato") : tr("Use card style", "Usa stile card")}
      </Button>
    </div>
  </article>;
};

export const ThemeCustomizer = ({
  theme,
  onThemeChange,
  onThemePreview,
  renderPreview,
  showEmbeddedPreview = true,
  accessLevel,
  videoUploadsEnabled = true,
  maxUploadBytes,
  maxVideoUploadBytes,
  managePlanHref = "/dashboard/billing",
}: ThemeCustomizerProps) => {
  const { tr } = useAppI18n();
  const [presetScope, setPresetScope] = useState<PresetScope>("page");
  const [pendingTheme, setPendingTheme] = useState<EditableTheme>(theme);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => findMatchingPreset(theme));
  const [selectedCardPresetId, setSelectedCardPresetId] = useState<string | null>(() => findMatchingCardPreset(theme));
  const themePresetRailRef = useRef<HTMLDivElement>(null);
  const cardPresetRailRef = useRef<HTMLDivElement>(null);
  const [manualControlsOpen, setManualControlsOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("mobile");
  const [previewOpen, setPreviewOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 1121px)").matches);
  const [comparisonPosition, setComparisonPosition] = useState(50);
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
    if (!premiumThemesEnabled && presetScope === "cards") setPresetScope("page");
  }, [premiumThemesEnabled, presetScope]);

  useEffect(() => {
    const wideWorkspace = window.matchMedia("(min-width: 1121px)");
    const syncPreviewDisclosure = (event: MediaQueryListEvent) => setPreviewOpen(event.matches);
    setPreviewOpen(wideWorkspace.matches);
    wideWorkspace.addEventListener("change", syncPreviewDisclosure);
    return () => wideWorkspace.removeEventListener("change", syncPreviewDisclosure);
  }, []);

  const previewTheme = (nextTheme: EditableTheme, presetId: string | null) => {
    setPendingTheme(nextTheme);
    setSelectedPresetId(presetId);
    setIsDirty(true);
    setPreviewOpen(true);
    setComparisonPosition(50);
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
    const nextTheme = buildPagePresetTheme(pendingTheme, preset, accessLevel);
    previewTheme(nextTheme, preset.id);
  };

  const applyCardPreset = (preset: CardThemePreset) => {
    const nextTheme = buildCardPresetTheme(pendingTheme, preset, accessLevel);
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

  const resetTheme = () => {
    previewTheme({
      ...defaultTheme,
      content: pendingTheme.content,
      orbitPageAccess: { mode: "preset", presetId: "default", cardPresetId: null },
    }, findMatchingPreset(defaultTheme));
  };

  const colorControl = (id: string, label: string, description: string, value: string, onChange: (color: string) => void) => (
    <ThemeColorControl
      id={id}
      label={label}
      description={description}
      value={value}
      onChange={onChange}
    />
  );

  const livePreviewPanel = (
    <aside className="admin-theme-preview-rail">
      <details className="admin-theme-preview-disclosure" open={previewOpen} onToggle={(event) => setPreviewOpen(event.currentTarget.open)}>
        <summary className="admin-theme-preview-summary">
          <span className="admin-theme-preview-summary-identity">
            <span className="admin-theme-preview-summary-icon" aria-hidden="true"><Eye /></span>
            <strong>{tr("Page preview", "Anteprima pagina")}</strong>
          </span>
          <span className="admin-theme-preview-summary-action">
            <span className="admin-theme-preview-summary-open">{tr("Hide", "Nascondi")}</span>
            <span className="admin-theme-preview-summary-closed">{tr("Show", "Mostra")}</span>
            <ChevronRight aria-hidden="true" />
          </span>
        </summary>
        <div className="admin-theme-preview-body">
          <div className="admin-theme-preview-context">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">{tr("Page preview", "Anteprima pagina")}</p>
              <PreviewDeviceToggle value={previewDevice} onChange={setPreviewDevice} />
            </div>
          </div>
          <div className="admin-theme-live-preview">
            {isDirty ? (
              <div className="space-y-2" data-theme-comparison="">
                <div className="flex items-center justify-between gap-3 px-1 text-[11px] font-bold uppercase tracking-[0.12em]">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <i className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
                    {tr("Before · saved", "Prima · salvato")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-blue-700">
                    {tr("After · draft", "Dopo · bozza")}
                    <i className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                  </span>
                </div>
                <Comparison
                  value={comparisonPosition}
                  onValueChange={setComparisonPosition}
                  className="rounded-xl border border-slate-200 bg-slate-100 shadow-inner"
                >
                  <ComparisonItem position="left">
                    {renderPreview ? renderPreview(theme, previewDevice) : <ThemeMockup theme={theme} />}
                  </ComparisonItem>
                  <ComparisonItem position="right">
                    {renderPreview ? renderPreview(pendingTheme, previewDevice) : <ThemeMockup theme={pendingTheme} />}
                  </ComparisonItem>
                  <ComparisonHandle
                    label={tr("Compare saved theme and draft", "Confronta tema salvato e bozza")}
                    beforeLabel={tr("Saved", "Salvato")}
                    afterLabel={tr("Draft", "Bozza")}
                  />
                </Comparison>
              </div>
            ) : renderPreview ? renderPreview(pendingTheme, previewDevice) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <ThemeMockup theme={pendingTheme} />
              </div>
            )}
          </div>
        </div>
      </details>
    </aside>
  );

  return (
    <div className="admin-theme-customizer space-y-6" data-onboarding="theme-customizer">
      <div className={showEmbeddedPreview ? "admin-theme-layout" : "admin-theme-layout admin-theme-layout--without-preview"}>
        <section className="admin-theme-catalog rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-6">
          <div className="admin-theme-toolbar mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative grid min-w-0 flex-1 grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
              <span className={`pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out ${presetScope === "cards" ? "translate-x-full" : "translate-x-0"}`} />
              <button type="button" onClick={() => setPresetScope("page")} className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${presetScope === "page" ? "text-blue-700" : "text-slate-600"}`}>
                <Palette className="h-4 w-4" /> {tr("Page themes", "Temi pagina")}
              </button>
              <button type="button" disabled={!premiumThemesEnabled} onClick={() => premiumThemesEnabled && setPresetScope("cards")} className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${presetScope === "cards" ? "text-blue-700" : "text-slate-600"} ${!premiumThemesEnabled ? "cursor-not-allowed opacity-60" : ""}`}>
                {premiumThemesEnabled ? <Layers3 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />} {tr("Card styles", "Stili card")}
              </button>
            </div>
            <Button aria-busy={saveState === "saving"} type="button" onClick={saveTheme} disabled={!isDirty || saveState === "saving"} className="min-h-12 shrink-0 bg-blue-600 px-5 text-white hover:bg-blue-700">
              {saveState === "saving" && <OrbitLoader size={16} state="shaping" />}
              {saveState === "saving" ? tr("Saving theme", "Salvataggio tema") : saveState === "saved" ? tr("Saved", "Salvato") : tr("Save theme", "Salva tema")}
            </Button>
          </div>
          {(isDirty || saveState === "saved" || saveState === "error") ? (
            <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${saveState === "error" ? "border-red-200 bg-red-50 text-red-700" : saveState === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`} role={saveState === "error" ? "alert" : "status"}>
              {saveState === "error" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : saveState === "saved" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
              <span>{saveState === "error" ? saveError || tr("Theme could not be saved.", "Non è stato possibile salvare il tema.") : saveState === "saved" ? tr("Theme saved successfully.", "Tema salvato correttamente.") : tr("Preview active. Save when you are ready to publish it.", "Anteprima attiva. Salva quando sei pronto a pubblicarla.")}</span>
            </div>
          ) : null}
          {presetScope === "page" ? (
            <>
              <div className="admin-theme-preset-heading mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-950">{tr("Page background", "Sfondo pagina")}</h3>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={tr("How page themes work", "Come funzionano i temi pagina")}>
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent align="start" className="max-w-72 px-3 py-2 text-xs leading-5" side="bottom">
                          {premiumThemesEnabled
                            ? tr("Page themes update the background and overall palette. Card backgrounds and colors stay controlled by Card styles.", "I temi pagina aggiornano lo sfondo e la palette generale. Sfondo e colori delle card restano gestiti da Stili card.")
                            : tr("Essential page themes update the page background and card palette together.", "I temi pagina essenziali aggiornano insieme lo sfondo della pagina e la palette delle card.")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="admin-theme-preset-heading-actions">
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" size="icon" aria-label={tr("Previous page themes", "Temi pagina precedenti")} onClick={() => themePresetRailRef.current?.scrollBy({ left: -280, behavior: "smooth" })}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" aria-label={tr("Next page themes", "Temi pagina successivi")} onClick={() => themePresetRailRef.current?.scrollBy({ left: 280, behavior: "smooth" })}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
              <div ref={themePresetRailRef} className="admin-theme-preset-rail" aria-label={tr("Page theme catalog", "Catalogo temi pagina")}>
                {availableThemePresets.map((preset) => (
                  <PresetCard key={preset.id} preset={preset} active={selectedPresetId === preset.id} onApply={() => applyPreset(preset)} />
                ))}
              </div>
              {!premiumThemesEnabled && (
                <div className="admin-inline-plan-lock mt-5">
                  <LockKeyhole className="h-4 w-4" />
                  <span>{tr("Starter adds premium page themes and card styles.", "Starter aggiunge temi pagina premium e stili card.")}</span>
                  <a href={managePlanHref} target="_top">{tr("View plans", "Vedi i piani")}</a>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">{tr("Card background & colors", "Sfondo e colori delle card")}</h3>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label={tr("Previous card styles", "Stili card precedenti")} onClick={() => cardPresetRailRef.current?.scrollBy({ left: -300, behavior: "smooth" })}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="icon" aria-label={tr("Next card styles", "Stili card successivi")} onClick={() => cardPresetRailRef.current?.scrollBy({ left: 300, behavior: "smooth" })}><ChevronRight className="h-4 w-4" /></Button>
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
        {showEmbeddedPreview && livePreviewPanel}
      </div>

      <section className="admin-theme-fine-tuning rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className={`flex flex-wrap items-center justify-between gap-3${manualControlsOpen ? " mb-5" : ""}`}>
              <div>
                <h3 className="text-xl font-bold text-slate-950">{tr("Fine tuning", "Regolazioni fini")}</h3>
                <p className="mt-1 text-sm text-slate-500">{tr("Adjust colors, type, layout and background after choosing a starting theme.", "Regola colori, caratteri, layout e sfondo dopo aver scelto il tema di partenza.")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {manualControlsOpen && (
                  <Button type="button" variant="outline" size="sm" onClick={resetTheme} disabled={!advancedCustomizationEnabled}>
                    <RotateCcw className="mr-2 h-4 w-4" /> {tr("Reset defaults", "Ripristina valori iniziali")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={manualControlsOpen ? "default" : "outline"}
                  size="sm"
                  aria-expanded={manualControlsOpen}
                  aria-controls="admin-theme-manual-controls"
                  onClick={() => setManualControlsOpen((current) => !current)}
                >
                  {manualControlsOpen ? tr("Close controls", "Chiudi controlli") : tr("Open controls", "Apri controlli")}
                  <ChevronRight className={`ml-2 h-4 w-4 transition-transform ${manualControlsOpen ? "rotate-90" : ""}`} />
                </Button>
              </div>
            </div>

            {manualControlsOpen && <div id="admin-theme-manual-controls" className="admin-theme-fine-tuning-body">{!advancedCustomizationEnabled ? (
              <div className="admin-inline-plan-lock">
                <LockKeyhole className="h-4 w-4" />
                <span>{tr("Fine tuning is available on Pro. Your preset and card-style controls remain available above.", "Le regolazioni fini sono disponibili con Pro. I controlli di preset e stile card restano disponibili qui sopra.")}</span>
                <a href={managePlanHref} target="_top">{tr("View plans", "Vedi i piani")}</a>
              </div>
            ) : (
            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-100 p-1 sm:grid-cols-4">
                <TabsTrigger value="colors" className="gap-1.5 py-2.5"><Palette className="h-4 w-4" /> {tr("Colors", "Colori")}</TabsTrigger>
                <TabsTrigger value="typography" className="gap-1.5 py-2.5"><Type className="h-4 w-4" /> {tr("Type", "Testo")}</TabsTrigger>
                <TabsTrigger value="layout" className="gap-1.5 py-2.5"><Layout className="h-4 w-4" /> Layout</TabsTrigger>
                <TabsTrigger value="background" className="gap-1.5 py-2.5"><ImagePlay className="h-4 w-4" /> {tr("Background", "Sfondo")}</TabsTrigger>
              </TabsList>

              <TabsContent value="colors" className="mt-6 space-y-7" data-onboarding="theme-colors">
                <div>
                  <h4 className="font-bold text-slate-900">{tr("Core palette", "Palette principale")}</h4>
                  <p className="mt-1 text-sm text-slate-500">{tr("Shared by the page, profile, cards and calls to action.", "Condivisa da pagina, profilo, card e call to action.")}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("primary", tr("Buttons & highlights", "Pulsanti ed elementi in evidenza"), tr("Used for primary buttons, active controls, links and highlights.", "Usato per pulsanti principali, controlli attivi, link ed elementi in evidenza."), pendingTheme.primary, (primary) => updatePendingTheme({ primary, accent: primary }))}
                    {colorControl("primaryGlow", tr("Accent glow", "Bagliore accento"), tr("The second accent color used in branded gradients and glow effects.", "Il secondo colore di accento usato nei gradienti del brand e negli effetti luminosi."), pendingTheme.primaryGlow, (primaryGlow) => updatePendingTheme({ primaryGlow }))}
                    {colorControl("foreground", tr("Default page text", "Testo predefinito pagina"), tr("Main text outside the profile and content cards.", "Testo principale esterno alle card profilo e contenuto."), pendingTheme.foreground, (foreground) => updatePendingTheme({ foreground }))}
                    {colorControl("muted", tr("Secondary page text", "Testo secondario pagina"), tr("Descriptions and supporting text outside the cards.", "Descrizioni e testi di supporto esterni alle card."), pendingTheme.muted, (muted) => updatePendingTheme({ muted }))}
                    {colorControl("border", tr("Default borders", "Bordi predefiniti"), tr("Borders of shared page elements that do not use a dedicated card palette.", "Bordi degli elementi della pagina che non usano una palette dedicata alle card."), pendingTheme.border, (border) => updatePendingTheme({ border }))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-bold text-slate-900">{tr("Surfaces", "Superfici")}</h4>
                  <p className="mt-1 text-sm text-slate-500">{tr("Control the page canvas and every card surface independently.", "Controlla separatamente lo sfondo pagina e ogni superficie delle card.")}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("background", tr("Page background", "Sfondo pagina"), tr("The base color behind the entire public page and the start of its gradient.", "Il colore di base dietro l'intera pagina pubblica e l'inizio del suo gradiente."), pendingTheme.background, (background) => updatePendingTheme({
                      background,
                      ...(pendingTheme.backgroundMedia?.type === "gradient" ? { backgroundGradient: { ...pendingTheme.backgroundGradient, from: background } } : {}),
                    }))}
                    {colorControl("backgroundSecondary", tr("Secondary page surfaces", "Superfici secondarie pagina"), tr("Used by secondary controls, inputs and muted areas outside content cards.", "Usato da controlli secondari, input e aree attenuate esterne alle card contenuto."), pendingTheme.backgroundSecondary, (backgroundSecondary) => updatePendingTheme({ backgroundSecondary }))}
                    {colorControl("card", tr("Content card background", "Sfondo card contenuto"), tr("The first background color of link and content cards.", "Il primo colore di sfondo delle card link e contenuto."), pendingTheme.contentCard.background, (card) => updatePendingTheme({ card, cardGradient: { ...pendingTheme.cardGradient, from: card }, contentCard: { ...pendingTheme.contentCard, background: card } }))}
                    {colorControl("cardTint", tr("Glass card tint", "Tinta card trasparenti"), tr("Color applied to blurred and liquid-glass card surfaces.", "Colore applicato alle superfici sfocate e liquid glass delle card."), pendingTheme.cardBlurTint || pendingTheme.card, (cardBlurTint) => updatePendingTheme({ cardBlurTint }))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-bold text-slate-900">{tr("Content cards", "Card contenuti")}</h4>
                  <p className="mt-1 text-sm text-slate-500">{tr("Fine tune the selected card style without changing the page or profile palette.", "Perfeziona lo stile card selezionato senza cambiare la palette di pagina o profilo.")}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("contentForeground", tr("Main card text", "Testo principale card"), tr("Titles and primary text inside content cards.", "Titoli e testo principale dentro le card contenuto."), pendingTheme.contentCard.foreground, (foreground) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, foreground } }))}
                    {colorControl("contentMuted", tr("Secondary card text", "Testo secondario card"), tr("Descriptions and supporting text inside content cards.", "Descrizioni e testi di supporto dentro le card contenuto."), pendingTheme.contentCard.muted, (muted) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, muted } }))}
                    {colorControl("contentBorder", tr("Content card border", "Bordo card contenuto"), tr("Outline around link and content cards.", "Contorno delle card link e contenuto."), pendingTheme.contentCard.border, (border) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, border } }))}
                    {colorControl("contentAccent", tr("Card icons & buttons", "Icone e pulsanti card"), tr("Icons, links and button backgrounds inside content cards.", "Icone, link e sfondi dei pulsanti dentro le card contenuto."), pendingTheme.contentCard.accent, (accent) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, accent } }))}
                    {colorControl("contentAccentForeground", tr("Text on card buttons", "Testo sui pulsanti card"), tr("Text and icons displayed on accent-colored buttons.", "Testo e icone mostrati sui pulsanti con colore di accento."), pendingTheme.contentCard.accentForeground, (accentForeground) => updatePendingTheme({ contentCard: { ...pendingTheme.contentCard, accentForeground } }))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-bold text-slate-900">{tr("Profile card", "Card profilo")}</h4>
                  <p className="mt-1 text-sm text-slate-500">{tr("A dedicated palette for the page header, logo, profile text and social actions.", "Una palette dedicata a intestazione, logo, testo profilo e azioni social.")}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {colorControl("profileBackground", tr("Profile background start", "Inizio sfondo profilo"), tr("First color of the profile card background.", "Primo colore dello sfondo della card profilo."), pendingTheme.profileCard.background, (background) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, background } }))}
                    {colorControl("profileBackgroundSecondary", tr("Profile background end", "Fine sfondo profilo"), tr("Second color of the profile card background gradient.", "Secondo colore del gradiente di sfondo della card profilo."), pendingTheme.profileCard.backgroundSecondary, (backgroundSecondary) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, backgroundSecondary } }))}
                    {colorControl("profileForeground", tr("Main profile text", "Testo principale profilo"), tr("Profile name and primary text in the page header.", "Nome profilo e testo principale nell'intestazione della pagina."), pendingTheme.profileCard.foreground, (foreground) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, foreground } }))}
                    {colorControl("profileMuted", tr("Secondary profile text", "Testo secondario profilo"), tr("Biography, location and supporting profile information.", "Biografia, posizione e informazioni di supporto del profilo."), pendingTheme.profileCard.muted, (muted) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, muted } }))}
                    {colorControl("profileBorder", tr("Profile card border", "Bordo card profilo"), tr("Outline around the profile header card.", "Contorno della card di intestazione del profilo."), pendingTheme.profileCard.border, (border) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, border } }))}
                    {colorControl("profileAccent", tr("Profile icons & links", "Icone e link profilo"), tr("Logo details, social icons and interactive accents in the profile card.", "Dettagli del logo, icone social e accenti interattivi nella card profilo."), pendingTheme.profileCard.accent, (accent) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, accent } }))}
                  </div>
                  <div className="mt-4 max-w-sm space-y-2">
                    <Label htmlFor="theme-profile-gradient-direction">{tr("Profile background direction", "Direzione sfondo profilo")}</Label>
                    <Select value={pendingTheme.profileCard.direction} onValueChange={(direction) => updatePendingTheme({ profileCard: { ...pendingTheme.profileCard, direction } })}>
                      <SelectTrigger id="theme-profile-gradient-direction"><SelectValue /></SelectTrigger>
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
                    <h4 className="font-bold text-slate-900">{tr("Page background gradient", "Gradiente sfondo pagina")}</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {colorControl("bgGradientFrom", tr("Start color", "Colore iniziale"), tr("Color shown at the beginning of the page background gradient.", "Colore mostrato all'inizio del gradiente di sfondo della pagina."), pendingTheme.backgroundGradient.from, (from) => updatePendingTheme({ backgroundGradient: { ...pendingTheme.backgroundGradient, from } }))}
                      {colorControl("bgGradientTo", tr("End color", "Colore finale"), tr("Color shown at the end of the page background gradient.", "Colore mostrato alla fine del gradiente di sfondo della pagina."), pendingTheme.backgroundGradient.to, (to) => updatePendingTheme({ backgroundGradient: { ...pendingTheme.backgroundGradient, to } }))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="theme-background-gradient-direction">{tr("Gradient direction", "Direzione gradiente")}</Label>
                      <Select value={pendingTheme.backgroundGradient.direction} onValueChange={(direction) => updatePendingTheme({ backgroundGradient: { ...pendingTheme.backgroundGradient, direction } })}>
                        <SelectTrigger id="theme-background-gradient-direction"><SelectValue /></SelectTrigger>
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
                    <h4 className="font-bold text-slate-900">{tr("Content card gradient", "Gradiente card contenuto")}</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {colorControl("cardGradientFrom", tr("Start color", "Colore iniziale"), tr("First color of link and content card backgrounds.", "Primo colore dello sfondo delle card link e contenuto."), pendingTheme.contentCard.background, (from) => updatePendingTheme({ card: from, cardGradient: { ...pendingTheme.cardGradient, from }, contentCard: { ...pendingTheme.contentCard, background: from } }))}
                      {colorControl("cardGradientTo", tr("End color", "Colore finale"), tr("Second color of link and content card backgrounds.", "Secondo colore dello sfondo delle card link e contenuto."), pendingTheme.contentCard.backgroundSecondary, (to) => updatePendingTheme({ cardGradient: { ...pendingTheme.cardGradient, to }, contentCard: { ...pendingTheme.contentCard, backgroundSecondary: to } }))}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="theme-card-gradient-direction">{tr("Gradient direction", "Direzione gradiente")}</Label>
                      <Select value={pendingTheme.contentCard.direction} onValueChange={(direction) => updatePendingTheme({ cardGradient: { ...pendingTheme.cardGradient, direction }, contentCard: { ...pendingTheme.contentCard, direction } })}>
                        <SelectTrigger id="theme-card-gradient-direction"><SelectValue /></SelectTrigger>
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
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <FontFamilyControl
                    id="theme-font-family"
                    label={tr("Page default", "Predefinito pagina")}
                    description={tr("Fallback font for every element without a dedicated choice.", "Font usato dagli elementi senza una scelta dedicata.")}
                    value={pendingTheme.fontFamily}
                    onChange={(fontFamily) => updatePendingTheme({ fontFamily })}
                  />
                  <FontFamilyControl
                    id="theme-profile-name-font"
                    label={tr("Name and surname", "Nome e cognome")}
                    description={tr("Main name in the profile card.", "Nome principale nella card profilo.")}
                    defaultLabel={tr("Use page default", "Usa predefinito pagina")}
                    value={pendingTheme.profileNameFontFamily}
                    onChange={(profileNameFontFamily) => updatePendingTheme({ profileNameFontFamily })}
                  />
                  <FontFamilyControl
                    id="theme-profile-description-font"
                    label={tr("Profile description", "Descrizione profilo")}
                    description={tr("Biography and profile details in the main card.", "Biografia e dettagli del profilo nella card principale.")}
                    defaultLabel={tr("Use page default", "Usa predefinito pagina")}
                    value={pendingTheme.profileDescriptionFontFamily}
                    onChange={(profileDescriptionFontFamily) => updatePendingTheme({ profileDescriptionFontFamily })}
                  />
                  <FontFamilyControl
                    id="theme-card-title-font"
                    label={tr("Card titles", "Titoli delle card")}
                    description={tr("Titles of links and other content blocks.", "Titoli dei link e degli altri blocchi contenuto.")}
                    defaultLabel={tr("Use page default", "Usa predefinito pagina")}
                    value={pendingTheme.cardTitleFontFamily}
                    onChange={(cardTitleFontFamily) => updatePendingTheme({ cardTitleFontFamily })}
                  />
                  <FontFamilyControl
                    id="theme-card-description-font"
                    label={tr("Card descriptions", "Descrizioni delle card")}
                    description={tr("Descriptions and supporting copy inside content cards.", "Descrizioni e testi di supporto nelle card contenuto.")}
                    defaultLabel={tr("Use page default", "Usa predefinito pagina")}
                    value={pendingTheme.cardDescriptionFontFamily}
                    onChange={(cardDescriptionFontFamily) => updatePendingTheme({ cardDescriptionFontFamily })}
                  />
                  <FontFamilyControl
                    id="theme-url-font"
                    label="URL"
                    description={tr("Web addresses shown below link descriptions.", "Indirizzi web mostrati sotto le descrizioni dei link.")}
                    defaultLabel={tr("Use page default", "Usa predefinito pagina")}
                    value={pendingTheme.urlFontFamily}
                    onChange={(urlFontFamily) => updatePendingTheme({ urlFontFamily })}
                  />
                  <FontFamilyControl
                    id="theme-button-font"
                    label={tr("Buttons and actions", "Pulsanti e azioni")}
                    description={tr("Buttons and calls to action on the public page.", "Pulsanti e call to action nella pagina pubblica.")}
                    defaultLabel={tr("Use page default", "Usa predefinito pagina")}
                    value={pendingTheme.buttonFontFamily}
                    onChange={(buttonFontFamily) => updatePendingTheme({ buttonFontFamily })}
                  />
                  <FontFamilyControl
                    id="theme-footer-font"
                    label={tr("Footer and legal links", "Footer e link legali")}
                    description={tr("Footer text, privacy links and the OrbitPage badge.", "Testo del footer, link privacy e badge OrbitPage.")}
                    defaultLabel={tr("Use page default", "Usa predefinito pagina")}
                    value={pendingTheme.footerFontFamily}
                    onChange={(footerFontFamily) => updatePendingTheme({ footerFontFamily })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="layout" className="mt-6 space-y-7">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p>Card radius <span className="text-slate-500">{pendingTheme.cardRadius}px</span></p>
                    <Slider aria-label="Card radius" value={[pendingTheme.cardRadius]} valueLabelFormat={(cardRadius) => `${cardRadius}px`} onValueChange={([cardRadius]) => updatePendingTheme({ cardRadius })} max={28} min={0} step={1} />
                  </div>
                  <div className="space-y-3">
                    <p>Card spacing <span className="text-slate-500">{pendingTheme.cardSpacing}px</span></p>
                    <Slider aria-label="Card spacing" value={[pendingTheme.cardSpacing]} valueLabelFormat={(cardSpacing) => `${cardSpacing}px`} onValueChange={([cardSpacing]) => updatePendingTheme({ cardSpacing })} max={32} min={4} step={1} />
                  </div>
                  <div className="space-y-3">
                    <p>Surface blur <span className="text-slate-500">{pendingTheme.blurIntensity}px</span></p>
                    <Slider aria-label="Surface blur" value={[pendingTheme.blurIntensity]} valueLabelFormat={(blurIntensity) => `${blurIntensity}px`} onValueChange={([blurIntensity]) => updatePendingTheme({ blurIntensity })} max={50} min={0} step={1} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-5">
                  <div>
                    <h4 className="font-bold text-slate-900">{tr("Card surfaces", "Superfici delle card")}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{tr("Choose a solid, fully transparent or liquid-glass default. Opacity changes only the surface; text, media and actions stay fully visible.", "Scegli un default solido, completamente trasparente o liquid glass. L'opacità modifica solo la superficie: testo, media e azioni restano pienamente visibili.")}</p>
                  </div>
                  <div className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 sm:p-5">
                    <div className="space-y-3">
                      <Label htmlFor="content-card-effect">{tr("Content card style", "Stile card contenuto")}</Label>
                      <Select value={pendingTheme.contentCardEffect} onValueChange={(contentCardEffect: CardSurfaceEffect) => updatePendingTheme({ contentCardEffect })}>
                        <SelectTrigger id="content-card-effect"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">{tr("Solid", "Solida")}</SelectItem>
                          <SelectItem value="transparent">{tr("Transparent", "Trasparente")}</SelectItem>
                          <SelectItem value="liquid-glass">Liquid glass</SelectItem>
                        </SelectContent>
                      </Select>
                      <Label htmlFor="content-card-transparency" className="flex items-center justify-between gap-3">
                        <span>{tr("Surface transparency", "Trasparenza superficie")}</span>
                        <span className="tabular-nums text-slate-500">{Math.round((1 - pendingTheme.contentCardOpacity) * 100)}%</span>
                      </Label>
                      <Slider
                        id="content-card-transparency"
                        aria-label="Content card transparency"
                        value={[1 - pendingTheme.contentCardOpacity]}
                        valueLabelFormat={(transparency) => `${Math.round(transparency * 100)}%`}
                        onValueChange={([transparency]) => updatePendingTheme({ contentCardOpacity: 1 - transparency })}
                        max={1}
                        min={0}
                        step={0.01}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="profile-card-effect">{tr("Profile card style", "Stile card profilo")}</Label>
                      <Select value={pendingTheme.profileCardEffect} onValueChange={(profileCardEffect: CardSurfaceEffect) => updatePendingTheme({ profileCardEffect })}>
                        <SelectTrigger id="profile-card-effect"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">{tr("Solid", "Solida")}</SelectItem>
                          <SelectItem value="transparent">{tr("Transparent", "Trasparente")}</SelectItem>
                          <SelectItem value="liquid-glass">Liquid glass</SelectItem>
                        </SelectContent>
                      </Select>
                      <Label htmlFor="profile-card-transparency" className="flex items-center justify-between gap-3">
                        <span>{tr("Surface transparency", "Trasparenza superficie")}</span>
                        <span className="tabular-nums text-slate-500">{Math.round((1 - pendingTheme.profileCardOpacity) * 100)}%</span>
                      </Label>
                      <Slider
                        id="profile-card-transparency"
                        aria-label="Profile card transparency"
                        value={[1 - pendingTheme.profileCardOpacity]}
                        valueLabelFormat={(transparency) => `${Math.round(transparency * 100)}%`}
                        onValueChange={([transparency]) => updatePendingTheme({ profileCardOpacity: 1 - transparency })}
                        max={1}
                        min={0}
                        step={0.01}
                      />
                    </div>
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
                      {colorControl('cardShadowColor', tr('Card shadow color', 'Colore ombra card'), tr('Color used by the shadow below profile and content cards.', 'Colore usato dall’ombra sotto le card profilo e contenuto.'), pendingTheme.cardShadow.color, (color) => updateCardShadow({ color }))}
                      <div className="space-y-3">
                        <p>Opacity <span className="text-slate-500">{Math.round(pendingTheme.cardShadow.opacity * 100)}%</span></p>
                        <Slider aria-label="Card shadow opacity" value={[pendingTheme.cardShadow.opacity]} valueLabelFormat={(opacity) => `${Math.round(opacity * 100)}%`} onValueChange={([opacity]) => updateCardShadow({ opacity })} max={1} min={0} step={0.01} />
                      </div>
                      <div className="space-y-3">
                        <p>Horizontal offset <span className="text-slate-500">{pendingTheme.cardShadow.offsetX}px</span></p>
                        <Slider aria-label="Card shadow horizontal offset" value={[pendingTheme.cardShadow.offsetX]} valueLabelFormat={(offsetX) => `${offsetX}px`} onValueChange={([offsetX]) => updateCardShadow({ offsetX })} max={32} min={-32} step={1} />
                      </div>
                      <div className="space-y-3">
                        <p>Vertical offset <span className="text-slate-500">{pendingTheme.cardShadow.offsetY}px</span></p>
                        <Slider aria-label="Card shadow vertical offset" value={[pendingTheme.cardShadow.offsetY]} valueLabelFormat={(offsetY) => `${offsetY}px`} onValueChange={([offsetY]) => updateCardShadow({ offsetY })} max={48} min={-32} step={1} />
                      </div>
                      <div className="space-y-3">
                        <p>Softness <span className="text-slate-500">{pendingTheme.cardShadow.blur}px</span></p>
                        <Slider aria-label="Card shadow softness" value={[pendingTheme.cardShadow.blur]} valueLabelFormat={(blur) => `${blur}px`} onValueChange={([blur]) => updateCardShadow({ blur })} max={96} min={0} step={1} />
                      </div>
                      <div className="space-y-3">
                        <p>Spread <span className="text-slate-500">{pendingTheme.cardShadow.spread}px</span></p>
                        <Slider aria-label="Card shadow spread" value={[pendingTheme.cardShadow.spread]} valueLabelFormat={(spread) => `${spread}px`} onValueChange={([spread]) => updateCardShadow({ spread })} max={48} min={-32} step={1} />
                      </div>
                    </div>

                    <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 p-8">
                      <div
                        className="h-24 w-28 border"
                        style={{
                          background: getCardSurfaceGradient(pendingTheme.contentCard, pendingTheme.contentCardOpacity),
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
                  <Label htmlFor="theme-public-page-width">Public page width</Label>
                  <Select value={pendingTheme.maxWidth} onValueChange={(maxWidth) => updatePendingTheme({ maxWidth })}>
                    <SelectTrigger id="theme-public-page-width"><SelectValue /></SelectTrigger>
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
            )}</div>}
      </section>
    </div>
  );
};
