import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Check,
  Compass,
  Globe2,
  Image as ImageIcon,
  ImageUp,
  Loader2,
  LockKeyhole,
  MapPin,
  Play,
  RotateCcw,
  Save,
  UserRound,
  Linkedin,
  Github,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DiscordIcon, MastodonIcon, TelegramIcon, TikTokIcon, WhatsAppIcon } from "./SocialIcons";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { internalAssetPath } from "@/lib/base-path";
import { RASTER_IMAGE_ACCEPT } from "@/lib/media-validation";
import { optimizeImageForUpload } from "@/lib/image-upload";
import type { CardSurfaceEffect, ThemeConfig } from "@/lib/theme";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import { uploadApi } from "@/lib/api-client";
import type { SaasSeoAccess } from "@/lib/saas-plan";
import { useAppI18n } from "@/lib/i18n";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: Record<string, string | undefined>;
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
  tabTitle?: string;
  metaDescription?: string;
  footerText?: string;
  favicon?: string;
  adminOnboardingEnabled?: boolean;
}

interface ProfileSectionProps {
  profile: ProfileData;
  theme: ThemeConfig;
  onProfileUpdate: (profile: ProfileData) => void | Promise<void>;
  onProfilePreview?: (profile: ProfileData) => void;
  onStartOnboarding?: () => void;
  onAdminOnboardingEnabledChange?: (enabled: boolean) => void;
  seoAccess?: SaasSeoAccess;
  managePlanHref?: string;
}

type ProfilePreset = NonNullable<ProfileAppearance["profilePreset"]>;
type AvatarShape = NonNullable<ProfileAppearance["avatarShape"]>;

const PROFILE_PRESETS: Array<{
  id: ProfilePreset;
  label: string;
  description: string;
  primaryLabel: string;
  primaryPlaceholder: string;
  secondaryLabel: string;
  secondaryPlaceholder: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "creator",
    label: "Creator / name",
    description: "Personal work, content and contact points.",
    primaryLabel: "Role or focus",
    primaryPlaceholder: "Designer, creator, photographer...",
    secondaryLabel: "Location",
    secondaryPlaceholder: "Turin, Italy or Remote",
    icon: UserRound,
  },
  {
    id: "company",
    label: "Company",
    description: "A clear business identity and location.",
    primaryLabel: "Industry",
    primaryPlaceholder: "Hospitality, software, retail...",
    secondaryLabel: "Business address",
    secondaryPlaceholder: "Street, city, country",
    icon: Building2,
  },
  {
    id: "studio",
    label: "Studio",
    description: "Services, discipline and studio location.",
    primaryLabel: "Specialty",
    primaryPlaceholder: "Architecture, design, production...",
    secondaryLabel: "Studio location",
    secondaryPlaceholder: "Street, city or By appointment",
    icon: BriefcaseBusiness,
  },
];

const SOCIAL_FIELDS: Array<{
  id: string;
  label: string;
  placeholder: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/username", icon: Linkedin },
  { id: "github", label: "GitHub", placeholder: "https://github.com/username", icon: Github },
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/username", icon: Instagram },
  { id: "facebook", label: "Facebook", placeholder: "https://facebook.com/username", icon: Facebook },
  { id: "twitter", label: "X / Twitter", placeholder: "https://x.com/username", icon: Twitter },
  { id: "youtube", label: "YouTube", placeholder: "https://youtube.com/@channel", icon: Youtube },
  { id: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@username", icon: TikTokIcon },
  { id: "discord", label: "Discord", placeholder: "https://discord.gg/invite", icon: DiscordIcon },
  { id: "telegram", label: "Telegram", placeholder: "https://t.me/username", icon: TelegramIcon },
  { id: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/number", icon: WhatsAppIcon },
  { id: "mastodon", label: "Mastodon", placeholder: "https://mastodon.social/@username", icon: MastodonIcon },
];

const ProfileColorField = ({
  label,
  value,
  inherited,
  onChange,
  onReset,
}: {
  label: string;
  value: string;
  inherited: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      {!inherited && <button type="button" onClick={onReset} className="text-[11px] font-semibold text-blue-700 hover:underline">Use theme</button>}
    </div>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-11 cursor-pointer rounded-md border border-slate-200 bg-transparent p-1" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-9 font-mono text-xs uppercase" maxLength={7} />
    </div>
  </div>
);

export const ProfileSection = ({
  profile,
  theme,
  onProfileUpdate,
  onProfilePreview,
  onStartOnboarding,
  onAdminOnboardingEnabledChange,
  seoAccess,
  managePlanHref = "/dashboard/billing",
}: ProfileSectionProps) => {
  const { tr } = useAppI18n();
  const [draft, setDraft] = useState(profile);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingFaviconFile, setPendingFaviconFile] = useState<File | null>(null);
  const [pendingLogoPreviewUrl, setPendingLogoPreviewUrl] = useState<string | null>(null);
  const [pendingFaviconPreviewUrl, setPendingFaviconPreviewUrl] = useState<string | null>(null);
  const [faviconDialogOpen, setFaviconDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const seoLocked = seoAccess === "none";
  const preset = PROFILE_PRESETS.find((item) => item.id === (draft.appearance?.profilePreset || "creator")) || PROFILE_PRESETS[0];
  const localPreset = (item: typeof PROFILE_PRESETS[number]) => item.id === "creator" ? {
    ...item, label: tr("Creator / name", "Creator / nome"), description: tr("Personal work, content and contact points.", "Lavori personali, contenuti e contatti."),
    primaryLabel: tr("Role or focus", "Ruolo o attività"), primaryPlaceholder: tr("Designer, creator, photographer...", "Designer, creator, fotografo..."), secondaryLabel: tr("Location", "Località"), secondaryPlaceholder: tr("Turin, Italy or Remote", "Torino, Italia o Da remoto"),
  } : item.id === "company" ? {
    ...item, label: tr("Company", "Azienda"), description: tr("A clear business identity and location.", "Un'identità aziendale chiara, con sede e riferimenti."),
    primaryLabel: tr("Industry", "Settore"), primaryPlaceholder: tr("Hospitality, software, retail...", "Ospitalità, software, vendita..."), secondaryLabel: tr("Business address", "Indirizzo aziendale"), secondaryPlaceholder: tr("Street, city, country", "Via, città, paese"),
  } : {
    ...item, description: tr("Services, discipline and studio location.", "Servizi, specializzazione e sede dello studio."), primaryLabel: tr("Specialty", "Specializzazione"),
    primaryPlaceholder: tr("Architecture, design, production...", "Architettura, design, produzione..."), secondaryLabel: tr("Studio location", "Sede dello studio"), secondaryPlaceholder: tr("Street, city or By appointment", "Via, città o Solo su appuntamento"),
  };
  const activePreset = localPreset(preset);
  const connectedSocials = Object.values(draft.socialLinks || {}).filter(Boolean).length;
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(profile) || Boolean(pendingLogoFile || pendingFaviconFile),
    [draft, pendingFaviconFile, pendingLogoFile, profile],
  );

  useEffect(() => {
    if (!pendingLogoFile && !pendingFaviconFile) setDraft(profile);
  }, [profile, pendingFaviconFile, pendingLogoFile]);

  useEffect(() => {
    onProfilePreview?.(draft);
  }, [draft, onProfilePreview]);

  useEffect(() => () => {
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    if (pendingFaviconPreviewUrl) URL.revokeObjectURL(pendingFaviconPreviewUrl);
  }, [pendingFaviconPreviewUrl, pendingLogoPreviewUrl]);

  const getImageUrl = (value?: string | null) => {
    if (!value) return profileAvatar as unknown as string;
    if (value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("http")) return value;
    return internalAssetPath(value) || (profileAvatar as unknown as string);
  };

  const updateAppearance = (updates: Partial<ProfileAppearance>) => {
    setDraft((current) => ({ ...current, appearance: { ...current.appearance, ...updates } }));
  };

  const updateProfileDetail = (key: "primary" | "secondary", value: string) => {
    setDraft((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        profileDetails: { ...current.appearance?.profileDetails, [key]: value },
      },
    }));
  };

  const prepareImage = async (file: File, target: "logo" | "favicon") => {
    setUploadError(null);
    try {
      const optimized = await optimizeImageForUpload(file, "profile");
      const previewUrl = URL.createObjectURL(optimized);
      if (target === "logo") {
        if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
        setPendingLogoFile(optimized);
        setPendingLogoPreviewUrl(previewUrl);
        setDraft((current) => ({ ...current, avatar: previewUrl, showAvatar: true }));
      } else {
        if (pendingFaviconPreviewUrl) URL.revokeObjectURL(pendingFaviconPreviewUrl);
        setPendingFaviconFile(optimized);
        setPendingFaviconPreviewUrl(previewUrl);
        setDraft((current) => ({ ...current, favicon: previewUrl }));
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The selected image could not be processed.");
    }
  };

  const handleSave = async () => {
    setUploadError(null);
    setIsSaving(true);
    try {
      let nextProfile = { ...draft };
      if (pendingLogoFile) {
        const uploaded = await uploadApi.uploadImage(pendingLogoFile, "profile-logo");
        const faviconFollowsLogo = !profile.favicon || profile.favicon === profile.avatar;
        nextProfile = {
          ...nextProfile,
          avatar: uploaded.filePath,
          showAvatar: true,
          ...(faviconFollowsLogo && !pendingFaviconFile ? { favicon: uploaded.filePath } : {}),
        };
      }
      if (pendingFaviconFile) {
        const uploaded = await uploadApi.uploadImage(pendingFaviconFile, "profile-favicon");
        nextProfile = { ...nextProfile, favicon: uploaded.filePath };
      }
      await onProfileUpdate(nextProfile);
      setDraft(nextProfile);
      setPendingLogoFile(null);
      setPendingFaviconFile(null);
      setPendingLogoPreviewUrl(null);
      setPendingFaviconPreviewUrl(null);
      setFaviconDialogOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The page profile could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetDraft = () => {
    setDraft(profile);
    setPendingLogoFile(null);
    setPendingFaviconFile(null);
    setPendingLogoPreviewUrl(null);
    setPendingFaviconPreviewUrl(null);
    setUploadError(null);
  };

  const resetCardAppearance = () => {
    setDraft((current) => ({
      ...current,
      appearance: {
        profilePreset: current.appearance?.profilePreset,
        profileDetails: current.appearance?.profileDetails,
        cardBorderEnabled: current.appearance?.cardBorderEnabled,
        avatarBorderEnabled: current.appearance?.avatarBorderEnabled,
        avatarBorderColor: current.appearance?.avatarBorderColor,
        avatarShape: current.appearance?.avatarShape,
        avatarSize: current.appearance?.avatarSize,
      },
    }));
  };

  const faviconValue = draft.favicon || draft.avatar;

  return (
    <div className="space-y-5" data-onboarding="profile-card">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_4px_14px_rgb(15_23_42_/_0.04)]">
        <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{tr("Page profile", "Profilo pagina")}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{tr("Identity and presentation", "Identità e presentazione")}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">{tr("Choose the page type, then add only the details that matter for it.", "Scegli il tipo di pagina e aggiungi solo i dettagli davvero utili.")}</p>
          </div>
          <div className="flex gap-2" data-onboarding="profile-actions">
            <Button type="button" variant="outline" size="sm" onClick={resetDraft} disabled={!isDirty || isSaving}>
              <RotateCcw className="h-4 w-4" /> {tr("Reset", "Ripristina")}
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? tr("Saving", "Salvataggio") : tr("Save page", "Salva pagina")}
            </Button>
          </div>
        </header>

        <div className="space-y-6 p-5">
          <div className="grid gap-3 sm:grid-cols-3" aria-label={tr("Profile type", "Tipo di profilo")}>
            {PROFILE_PRESETS.map((item) => {
              const Icon = item.icon;
              const active = item.id === preset.id;
              const localized = localPreset(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateAppearance({ profilePreset: item.id })}
                  className={`relative flex min-h-28 items-start gap-3 rounded-lg border p-4 text-left transition-colors ${active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <strong className="block text-sm text-slate-950">{localized.label}</strong>
                    <small className="mt-1 block text-xs leading-5 text-slate-600">{localized.description}</small>
                  </span>
                  {active && <Check className="absolute right-3 top-3 h-4 w-4 text-blue-700" />}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <ImageIcon className="h-4 w-4 shrink-0 text-slate-500" />
                <div><p className="text-sm font-semibold text-slate-950">{tr("Show profile image", "Mostra immagine profilo")}</p><p className="text-xs text-slate-500">{tr("Display the logo or photo above the name.", "Mostra il logo o la foto sopra il nome.")}</p></div>
              </div>
              <Switch checked={draft.showAvatar !== false} onCheckedChange={(showAvatar) => setDraft((current) => ({ ...current, showAvatar }))} aria-label={tr("Show profile image", "Mostra immagine profilo")} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Globe2 className="h-4 w-4 shrink-0 text-slate-500" />
                <div><p className="text-sm font-semibold text-slate-950">{tr("Show card border", "Mostra bordo della card")}</p><p className="text-xs text-slate-500">{tr("Use the border from the active theme.", "Usa il bordo del tema attivo.")}</p></div>
              </div>
              <Switch checked={draft.appearance?.cardBorderEnabled !== false} onCheckedChange={(cardBorderEnabled) => updateAppearance({ cardBorderEnabled })} aria-label={tr("Show profile card border", "Mostra bordo della card profilo")} />
            </div>
          </div>

          <div className="grid gap-5 border-t border-slate-200 pt-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <div className="space-y-3">
              <button type="button" onClick={() => logoInputRef.current?.click()} className="group relative flex aspect-square w-full max-w-56 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <img src={getImageUrl(draft.avatar)} alt={tr("Profile image preview", "Anteprima immagine profilo")} className="h-full w-full object-cover" />
                <span className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-md bg-slate-950/85 px-3 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-slate-950"><ImageUp className="h-4 w-4" /> {tr("Replace image", "Sostituisci immagine")}</span>
              </button>
              <input ref={logoInputRef} type="file" accept={RASTER_IMAGE_ACCEPT} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareImage(file, "logo"); event.target.value = ""; }} />
              <p className="text-xs leading-5 text-slate-500">{tr("PNG, JPG, GIF or WebP. Images are optimized before upload.", "PNG, JPG, GIF o WebP. Le immagini vengono ottimizzate prima del caricamento.")}</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-name">{tr("Page name", "Nome pagina")}</Label>
                <Input id="profile-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={activePreset.label} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-bio">{tr("Description", "Descrizione")}</Label>
                <Textarea id="profile-bio" value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} placeholder={tr("A short, useful introduction to this page.", "Una presentazione breve e utile della pagina.")} rows={3} maxLength={2000} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-primary-detail">{activePreset.primaryLabel}</Label>
                  <div className="relative"><BriefcaseBusiness className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input id="profile-primary-detail" className="pl-9" value={draft.appearance?.profileDetails?.primary || ""} onChange={(event) => updateProfileDetail("primary", event.target.value)} placeholder={activePreset.primaryPlaceholder} maxLength={160} /></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-secondary-detail">{activePreset.secondaryLabel}</Label>
                  <div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input id="profile-secondary-detail" className="pl-9" value={draft.appearance?.profileDetails?.secondary || ""} onChange={(event) => updateProfileDetail("secondary", event.target.value)} placeholder={activePreset.secondaryPlaceholder} maxLength={240} /></div>
                </div>
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
              <div>
                <Label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{tr("Image shape", "Forma immagine")}</Label>
                <div className="mt-2 grid grid-cols-3 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label={tr("Profile image shape", "Forma immagine profilo")}>
                  {(["round", "rounded", "square"] as AvatarShape[]).map((shape) => (
                    <button key={shape} type="button" onClick={() => updateAppearance({ avatarShape: shape })} aria-pressed={(draft.appearance?.avatarShape || "round") === shape} className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${(draft.appearance?.avatarShape || "round") === shape ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{shape === "round" ? tr("Circle", "Cerchio") : shape === "rounded" ? tr("Rounded", "Arrotondata") : tr("Square", "Quadrata")}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3"><Label htmlFor="profile-avatar-size" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{tr("Image size", "Dimensione immagine")}</Label><span className="text-xs font-semibold tabular-nums text-slate-600">{draft.appearance?.avatarSize ?? 112}px</span></div>
                <Slider id="profile-avatar-size" className="mt-4" min={56} max={192} step={4} value={[draft.appearance?.avatarSize ?? 112]} onValueChange={([avatarSize]) => updateAppearance({ avatarSize })} aria-label={tr("Profile image size", "Dimensione immagine profilo")} />
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2"><Globe2 className="h-4 w-4 text-blue-700" /><h3 className="text-sm font-semibold text-slate-950">{tr("Browser title", "Titolo browser")}</h3></div>
              {seoLocked && <div className="admin-inline-plan-lock mb-3"><LockKeyhole className="h-4 w-4" /><span>{tr("Available on Starter.", "Disponibile con Starter.")}</span><a href={managePlanHref} target="_top">{tr("View plans", "Vedi i piani")}</a></div>}
              <Input disabled={seoLocked} value={draft.tabTitle || ""} onChange={(event) => setDraft((current) => ({ ...current, tabTitle: event.target.value }))} placeholder={draft.name ? `${draft.name} | OrbitPage` : tr("Title shown in the browser tab", "Titolo mostrato nella scheda del browser")} maxLength={200} />
            </div>
            <button type="button" onClick={() => setFaviconDialogOpen(true)} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {faviconValue && /^(?:https?:|data:image\/|blob:|\/)/i.test(faviconValue) ? <img className="h-full w-full object-contain p-1" src={getImageUrl(faviconValue)} alt={tr("Favicon preview", "Anteprima favicon")} /> : <ImageIcon className="h-5 w-5 text-slate-400" />}
              </span>
              <span><strong className="block text-sm text-slate-950">Favicon</strong><small className="mt-1 block text-xs leading-5 text-slate-500">{tr("Click to upload a browser icon independent from the profile image.", "Clicca per caricare un'icona del browser distinta dall'immagine profilo.")}</small></span>
            </button>
          </section>

          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4">
              <span><strong className="block text-sm text-slate-950">{tr("Social links", "Link social")}</strong><small className="mt-1 block text-xs text-slate-500">{connectedSocials} {tr(connectedSocials === 1 ? "connected channel" : "connected channels", connectedSocials === 1 ? "canale collegato" : "canali collegati")}. {tr("Add only profiles you actively use.", "Aggiungi solo i profili che utilizzi davvero.")}</small></span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{tr("Manage", "Gestisci")}</span>
            </summary>
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
              {SOCIAL_FIELDS.map((social) => {
                const Icon = social.icon;
                const value = draft.socialLinks?.[social.id] || "";
                return (
                  <label key={social.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <span className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700"><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{social.label}</span>{value && <Check className="h-3.5 w-3.5 text-emerald-600" />}</span>
                    <Input value={value} onChange={(event) => setDraft((current) => ({ ...current, socialLinks: { ...current.socialLinks, [social.id]: event.target.value } }))} placeholder={social.placeholder} inputMode="url" />
                  </label>
                );
              })}
            </div>
          </details>

          <details className="group rounded-lg border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4">
              <span><strong className="block text-sm text-slate-950">{tr("Profile card fine tuning", "Regolazioni card profilo")}</strong><small className="mt-1 block text-xs text-slate-500">{tr("Per-profile colors, typography, border and footer details.", "Colori, tipografia, bordo e footer specifici per questo profilo.")}</small></span>
              <span className="text-xs font-semibold text-blue-700">{tr("Open controls", "Apri controlli")}</span>
            </summary>
            <div className="space-y-6 border-t border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold text-slate-950">{tr("Profile card colors", "Colori card profilo")}</h3><p className="mt-1 text-xs text-slate-500">{tr("These values override the active theme only for this profile.", "Questi valori sostituiscono il tema attivo solo per questo profilo.")}</p></div><Button type="button" variant="outline" size="sm" onClick={resetCardAppearance}>{tr("Use theme colors", "Usa colori del tema")}</Button></div>
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
                <div><p className="text-sm font-semibold text-slate-950">{tr("Profile surface", "Superficie profilo")}</p><p className="mt-1 text-xs leading-5 text-slate-500">{tr("Keep the theme style, remove the card completely, or add a blurred liquid-glass surface.", "Mantieni lo stile del tema, rimuovi completamente la card oppure applica una superficie liquid glass sfocata.")}</p></div>
                <Select value={draft.appearance?.surfaceEffect || "inherit"} onValueChange={(surfaceEffect: CardSurfaceEffect | "inherit") => updateAppearance({ surfaceEffect })}>
                  <SelectTrigger aria-label={tr("Profile surface", "Superficie profilo")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">{tr("Use theme default", "Usa valore del tema")}</SelectItem>
                    <SelectItem value="solid">{tr("Solid", "Solida")}</SelectItem>
                    <SelectItem value="transparent">{tr("Transparent", "Trasparente")}</SelectItem>
                    <SelectItem value="liquid-glass">Liquid glass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileColorField label={tr("Card background", "Sfondo card")} value={draft.appearance?.cardBackgroundColor || theme.profileCard.background} inherited={!draft.appearance?.cardBackgroundColor} onChange={(cardBackgroundColor) => updateAppearance({ cardBackgroundColor })} onReset={() => updateAppearance({ cardBackgroundColor: undefined })} />
                <ProfileColorField label={tr("Main text", "Testo principale")} value={draft.appearance?.cardTextColor || theme.profileCard.foreground} inherited={!draft.appearance?.cardTextColor} onChange={(cardTextColor) => updateAppearance({ cardTextColor })} onReset={() => updateAppearance({ cardTextColor: undefined })} />
                <ProfileColorField label={tr("Secondary text", "Testo secondario")} value={draft.appearance?.cardMutedColor || theme.profileCard.muted} inherited={!draft.appearance?.cardMutedColor} onChange={(cardMutedColor) => updateAppearance({ cardMutedColor })} onReset={() => updateAppearance({ cardMutedColor: undefined })} />
                <ProfileColorField label={tr("Card border", "Bordo card")} value={draft.appearance?.cardBorderColor || theme.profileCard.border} inherited={!draft.appearance?.cardBorderColor} onChange={(cardBorderColor) => updateAppearance({ cardBorderColor })} onReset={() => updateAppearance({ cardBorderColor: undefined })} />
                <ProfileColorField label={tr("Social accent", "Accento social")} value={draft.appearance?.accentColor || theme.profileCard.accent} inherited={!draft.appearance?.accentColor} onChange={(accentColor) => updateAppearance({ accentColor })} onReset={() => updateAppearance({ accentColor: undefined })} />
                <ProfileColorField label={tr("Image border", "Bordo immagine")} value={draft.appearance?.avatarBorderColor || theme.profileCard.accent} inherited={!draft.appearance?.avatarBorderColor} onChange={(avatarBorderColor) => updateAppearance({ avatarBorderColor })} onReset={() => updateAppearance({ avatarBorderColor: undefined })} />
              </div>
              <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3"><div><p className="text-sm font-semibold">{tr("Image border", "Bordo immagine")}</p><p className="text-xs text-slate-500">{tr("Outline the profile image.", "Aggiungi un contorno all'immagine profilo.")}</p></div><Switch checked={draft.appearance?.avatarBorderEnabled !== false} onCheckedChange={(avatarBorderEnabled) => updateAppearance({ avatarBorderEnabled })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">{tr("Name size", "Dimensione nome")}</Label><Input type="number" min={12} max={96} value={parseInt(draft.nameFontSize || "32", 10)} onChange={(event) => setDraft((current) => ({ ...current, nameFontSize: `${event.target.value}px` }))} /></div>
                  <div><Label className="text-xs">{tr("Description size", "Dimensione descrizione")}</Label><Input type="number" min={10} max={48} value={parseInt(draft.bioFontSize || "14", 10)} onChange={(event) => setDraft((current) => ({ ...current, bioFontSize: `${event.target.value}px` }))} /></div>
                </div>
              </div>
              <div className="space-y-2 border-t border-slate-200 pt-5">
                <Label htmlFor="profile-meta-description">{tr("Search description", "Descrizione per i motori di ricerca")}</Label>
                <Textarea id="profile-meta-description" disabled={seoLocked} value={draft.metaDescription || ""} onChange={(event) => setDraft((current) => ({ ...current, metaDescription: event.target.value }))} placeholder={tr("A concise description for search engines and link previews.", "Una descrizione concisa per motori di ricerca e anteprime dei link.")} rows={2} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-footer">{tr("Footer text", "Testo del footer")}</Label>
                <Textarea id="profile-footer" value={draft.footerText || ""} onChange={(event) => setDraft((current) => ({ ...current, footerText: event.target.value }))} placeholder={tr("(c) Your name. All rights reserved.", "(c) Il tuo nome. Tutti i diritti riservati.")} rows={2} maxLength={300} />
              </div>
            </div>
          </details>

          {uploadError && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{uploadError}</p>}
        </div>
      </section>

      <Dialog open={faviconDialogOpen} onOpenChange={setFaviconDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("Browser favicon", "Favicon del browser")}</DialogTitle>
            <DialogDescription>{tr("Upload a square image for browser tabs and saved shortcuts. It can be different from the public profile image.", "Carica un'immagine quadrata per le schede del browser e i collegamenti salvati. Può essere diversa dall'immagine profilo pubblica.")}</DialogDescription>
          </DialogHeader>
          <button type="button" onClick={() => faviconInputRef.current?.click()} className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-blue-400 hover:bg-blue-50/50">
            {faviconValue ? <img src={getImageUrl(faviconValue)} alt={tr("Selected favicon", "Favicon selezionata")} className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-contain p-1" /> : <ImageUp className="h-8 w-8 text-slate-400" />}
            <span><strong className="block text-sm text-slate-950">{tr("Choose favicon image", "Scegli immagine favicon")}</strong><small className="mt-1 block text-xs text-slate-500">PNG, JPG, GIF o WebP</small></span>
          </button>
          <input ref={faviconInputRef} type="file" accept={RASTER_IMAGE_ACCEPT} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareImage(file, "favicon"); event.target.value = ""; }} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFaviconDialogOpen(false)}>{tr("Close", "Chiudi")}</Button>
            <Button type="button" onClick={handleSave} disabled={!isDirty || isSaving}>{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isSaving ? tr("Saving", "Salvataggio") : tr("Save favicon", "Salva favicon")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(onStartOnboarding || onAdminOnboardingEnabledChange) && (
        <Card className="p-5" data-onboarding="onboarding-settings">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2"><span className="admin-panel-icon"><Compass className="h-4 w-4" /></span><h2 className="text-base font-semibold text-slate-950">{tr("Guided setup", "Configurazione guidata")}</h2></div>
              <p className="text-sm leading-6 text-slate-600">{tr("Keep the setup guide available while the page is being prepared.", "Mantieni disponibile la guida mentre prepari la pagina.")}</p>
            </div>
            {onStartOnboarding && <Button onClick={onStartOnboarding} className="admin-action admin-action-primary shrink-0" size="sm"><Play className="h-4 w-4" />{tr("Start guide", "Avvia guida")}</Button>}
          </div>
          {onAdminOnboardingEnabledChange && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
              <div><p className="text-sm font-semibold text-slate-950">{tr("Show at every login", "Mostra a ogni accesso")}</p><p className="text-xs leading-5 text-slate-500">{tr("Useful during initial setup.", "Utile durante la configurazione iniziale.")}</p></div>
              <Switch checked={profile.adminOnboardingEnabled !== false} onCheckedChange={onAdminOnboardingEnabledChange} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
