import { createPortal } from "react-dom";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeFineTuning, type FineTuningProfile, type LinkStylePatch } from "./ThemeFineTuning";
import type { LinkData } from "./LinkCard";
import type { ProfileAppearance } from "@/lib/profile-appearance";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { OrbitLoader } from "@/components/ui/orbit-loader";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Layers3,
  LockKeyhole,
  Palette,
  Save,
} from "@/components/ui/material-icons";
import {
  type ThemeConfig,
  getCardSurfaceGradient,
  getCardShadowCss,
} from "@/lib/theme";
import { themePresets, type ThemePreset } from "@/lib/theme-presets";
import { cardThemePresets, type CardThemePreset } from "@/lib/card-theme-presets";

import { commitPendingTheme, themeHasChanges, buildPagePresetTheme, buildCardPresetTheme, findMatchingCardPreset, type EditableTheme } from "./theme-save-state";
import type { EditorThemeAccess } from "@/lib/editor-capabilities";
import { PreviewDeviceToggle, type PreviewDevice } from "./LivePreview";
import { useAppI18n } from "@/lib/i18n";
import { Comparison, ComparisonHandle, ComparisonItem } from "@/components/ui/comparison";

interface ThemeCustomizerProps {
  theme: ThemeConfig;
  profile: FineTuningProfile;
  links: LinkData[];
  onLinksChange: (links: LinkData[]) => void | Promise<void>;
  onProfileAppearanceChange: (appearance: ProfileAppearance) => void | Promise<void>;
  publicPageHref?: string;
  showOrbitPageBadge?: boolean;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>;
  onThemePreview?: (theme: ThemeConfig) => void;
  renderPreview?: (theme: ThemeConfig, device: PreviewDevice, profile: FineTuningProfile, links: LinkData[]) => ReactNode;
  showEmbeddedPreview?: boolean;
  accessLevel?: EditorThemeAccess;
  videoUploadsEnabled?: boolean;
  maxUploadBytes?: number | null;
  maxVideoUploadBytes?: number | null;
  managePlanHref?: string;
  selectedScope?: PresetScope;
  onScopeChange?: (scope: PresetScope) => void;
  headerAction?: ReactNode;
}

type PresetScope = "page" | "cards" | "fine-tuning";

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

const ThemeMockup = ({ theme, compact = false }: { theme: ThemeConfig; compact?: boolean }) => {
  const { tr } = useAppI18n();
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
              {tr("Call to action", "Invito all’azione")}
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
  profile, links, onLinksChange, onProfileAppearanceChange, publicPageHref, showOrbitPageBadge,
  onThemePreview,
  renderPreview,
  showEmbeddedPreview = true,
  accessLevel,
  videoUploadsEnabled = true,
  maxUploadBytes,
  maxVideoUploadBytes,
  managePlanHref = "/dashboard/billing",
  selectedScope,
  onScopeChange,
  headerAction,
}: ThemeCustomizerProps) => {
  const { tr } = useAppI18n();
  const [localScope, setLocalScope] = useState<PresetScope>("page");
  const presetScope = selectedScope ?? localScope;
  const setPresetScope = (scope: PresetScope) => { setLocalScope(scope); onScopeChange?.(scope); };
  const [pendingTheme, setPendingTheme] = useState<EditableTheme>(theme);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => findMatchingPreset(theme));
  const [selectedCardPresetId, setSelectedCardPresetId] = useState<string | null>(() => findMatchingCardPreset(theme));
  const themePresetRailRef = useRef<HTMLDivElement>(null);
  const cardPresetRailRef = useRef<HTMLDivElement>(null);
  const [linkEdits, setLinkEdits] = useState<Record<string, LinkStylePatch>>({});
  const [profileEdits, setProfileEdits] = useState<Partial<ProfileAppearance>>({});
  const [fineDialogOpen, setFineDialogOpen] = useState(false);
  const previewLinks = links.map(link => ({ ...link, ...linkEdits[link.id] }));
  const previewProfile = { ...profile, appearance: { ...profile.appearance, ...profileEdits } };
  const linksDirty = links.some(link => Object.entries(linkEdits[link.id] || {}).some(([key, value]) => value !== link[key as keyof LinkStylePatch]));
  const profileDirty = Object.entries(profileEdits).some(([key, value]) => value !== profile.appearance?.[key as keyof ProfileAppearance]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const hasDraft = isDirty || linksDirty || profileDirty;
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
    setSaveState(current => current === "saving" ? current : "idle");
  }, [theme]);

  useEffect(() => {
    if (!premiumThemesEnabled && presetScope === "cards") {
      setLocalScope("page");
      onScopeChange?.("page");
    }
  }, [premiumThemesEnabled, presetScope, onScopeChange]);

  useEffect(() => {
    const wideWorkspace = window.matchMedia("(min-width: 1121px)");
    const syncPreviewDisclosure = (event: MediaQueryListEvent) => setPreviewOpen(event.matches);
    setPreviewOpen(wideWorkspace.matches);
    wideWorkspace.addEventListener("change", syncPreviewDisclosure);
    return () => wideWorkspace.removeEventListener("change", syncPreviewDisclosure);
  }, []);

  const previewTheme = (nextTheme: EditableTheme, presetId: string | null) => {
    const changed = themeHasChanges(nextTheme, theme);
    setPendingTheme(changed ? nextTheme : theme);
    setSelectedPresetId(presetId);
    setIsDirty(changed);
    setPreviewOpen(true);
    setComparisonPosition(50);
    setSaveError("");
    setSaveState("idle");
    onThemePreview?.(changed ? nextTheme : theme);
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
    if (!hasDraft) return true;
    setSaveState("saving");
    setSaveError("");
    let savedSections = 0;
    try {
      if (isDirty) {
        const result = await commitPendingTheme({ isDirty, theme: pendingTheme, onSave: onThemeChange });
        if (result.error) throw new Error(result.error);
        setIsDirty(false);
        savedSections++;
      }
      if (linksDirty) { await onLinksChange(previewLinks); setLinkEdits({}); savedSections++; }
      if (profileDirty) { await onProfileAppearanceChange(previewProfile.appearance); setProfileEdits({}); }
      setSaveState("saved");
      return true;
    } catch (error) {
      setSaveError((savedSections ? tr("Some changes were saved. Retry to save the remaining changes. ", "Alcune modifiche sono state salvate. Riprova per salvare le restanti. ") : "") + (error instanceof Error ? error.message : tr("Could not save changes.", "Impossibile salvare le modifiche.")));
      setSaveState("error");
      return false;
    }
  };

  const revert = () => {
    setPendingTheme(theme); setSelectedPresetId(findMatchingPreset(theme)); setSelectedCardPresetId(findMatchingCardPreset(theme));
    setLinkEdits({}); setProfileEdits({}); setIsDirty(false); setSaveError(""); setSaveState("idle"); onThemePreview?.(theme);
  };

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
          <div className="admin-theme-live-preview">
            {hasDraft ? (
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
                    {renderPreview ? renderPreview(theme, previewDevice, profile, links) : <ThemeMockup theme={theme} />}
                  </ComparisonItem>
                  <ComparisonItem position="right">
                    {renderPreview ? renderPreview(pendingTheme, previewDevice, previewProfile, previewLinks) : <ThemeMockup theme={pendingTheme} />}
                  </ComparisonItem>
                  <ComparisonHandle
                    label={tr("Compare saved theme and draft", "Confronta tema salvato e bozza")}
                    beforeLabel={tr("Saved", "Salvato")}
                    afterLabel={tr("Draft", "Bozza")}
                  />
                </Comparison>
              </div>
            ) : renderPreview ? renderPreview(pendingTheme, previewDevice, previewProfile, previewLinks) : (
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
      <Tabs value={presetScope} onValueChange={value => setPresetScope(value as PresetScope)}>
        <div className="theme-workspace-header">
        <TabsList className="theme-workspace-tabs" aria-label={tr("Theme sections", "Sezioni del tema")}>
          <TabsTrigger value="page" disabled={saveState === "saving"}><Palette size={16} />{tr("Page themes", "Temi pagina")}</TabsTrigger>
          <TabsTrigger value="cards" disabled={!premiumThemesEnabled || saveState === "saving"}><Layers3 size={16} />{tr("Card styles", "Stili card")}</TabsTrigger>
          <TabsTrigger value="fine-tuning" disabled={saveState === "saving"}><Palette size={16} />{tr("Fine tuning", "Personalizzazione avanzata")}</TabsTrigger>
        </TabsList>
        {showEmbeddedPreview && <div className="admin-theme-preview-context admin-section-actions">
          <PreviewDeviceToggle value={previewDevice} onChange={setPreviewDevice} />
          {headerAction}
        </div>}
        </div>
          {(hasDraft || saveState === "saved" || saveState === "error") ? (
            <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${saveState === "error" ? "border-red-200 bg-red-50 text-red-700" : saveState === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`} role={saveState === "error" ? "alert" : "status"}>
              {saveState === "error" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : saveState === "saved" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
              <span>{saveState === "error" ? saveError || tr("Theme could not be saved.", "Non è stato possibile salvare il tema.") : saveState === "saved" ? tr("Theme saved successfully.", "Tema salvato correttamente.") : tr("Preview active. Save when you are ready to publish it.", "Anteprima attiva. Salva quando sei pronto a pubblicarla.")}</span>
            </div>
          ) : null}

      <TabsContent value={presetScope}>{presetScope === "fine-tuning" ? advancedCustomizationEnabled ? <ThemeFineTuning
        theme={pendingTheme} profile={previewProfile} links={previewLinks} onThemeChange={updatePendingTheme}
        device={previewDevice}
        onLinkChange={(id, patch) => { setLinkEdits(current => ({ ...current, [id]: { ...current[id], ...patch } })); setSaveState("idle"); setSaveError(""); }}
        onProfileChange={patch => { setProfileEdits(current => ({ ...current, ...patch })); setSaveState("idle"); setSaveError(""); }}
        publicPageHref={publicPageHref} showOrbitPageBadge={showOrbitPageBadge}
        onSave={saveTheme} saving={saveState === "saving"} dirty={hasDraft} error={saveError} onDialogChange={setFineDialogOpen}
        videoUploadsEnabled={videoUploadsEnabled} maxUploadBytes={maxUploadBytes} maxVideoUploadBytes={maxVideoUploadBytes} managePlanHref={managePlanHref}
      /> : <div className="admin-inline-plan-lock"><LockKeyhole size={20} /><span>{tr("Fine tuning is available on Pro.", "La personalizzazione avanzata è disponibile con Pro.")}</span><a href={managePlanHref} target="_top">{tr("View plans", "Vedi i piani")}</a></div> : <div className={showEmbeddedPreview ? "admin-theme-layout" : "admin-theme-layout admin-theme-layout--without-preview"}>
        <section className="admin-theme-catalog rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-6">
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
      </div>}</TabsContent>
      </Tabs>

    {typeof document !== "undefined" && !fineDialogOpen && (hasDraft || saveState === "saving") ? createPortal(
        <div className="admin-profile-save-layer"><div className="admin-profile-save-float">
          <Button variant="outline" size="sm" disabled={saveState === "saving"} onClick={revert}>{tr("Revert", "Ripristina")}</Button>
          <Button aria-busy={saveState === "saving"} size="sm" disabled={saveState === "saving"} onClick={() => void saveTheme()}>{saveState === "saving" ? <OrbitLoader size={16} /> : <Save className="h-4 w-4" />}{saveState === "saving" ? tr("Saving", "Salvataggio") : tr("Save", "Salva")}</Button>
        </div></div>, document.body
      ) : null}
      </div>
  );
};
