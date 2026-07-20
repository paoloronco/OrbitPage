import { useEffect, useMemo, useState } from "react";
import { ProfileSection } from "./ProfileSection";
import { LinkManager } from "./LinkManager";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { MenuEditor } from "./MenuEditor";
import { LinkData } from "./LinkCard";
import { ClickAnalyticsChart } from "./ClickAnalyticsChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CurrentUser } from "@/pages/Admin";
import { Permission, hasPermission, hasAnyPermission, getLinkEditMode } from "@/lib/permissions";
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Cookie,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  HelpCircle,
  Key,
  Languages,
  Link,
  LockKeyhole,
  LogOut,
  MousePointerClick,
  Map,
  Palette,
  QrCode,
  UtensilsCrossed,
  ShieldCheck,
  User,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { ThemeConfig, applyTheme } from "@/lib/theme";
import { PasswordManager } from "./PasswordManager";
import { UserManager } from "./UserManager";
import { OrbitPageBrand } from "./OrbitPageBrand";
import { PrivacySettings } from "./PrivacySettings";
import { BackupManager } from "./BackupManager";
import { TextFileManager } from "./TextFileManager";
import { SitemapManager } from "./SitemapManager";
import { AdminOnboarding } from "./AdminOnboarding";
import { LivePreview, PreviewDeviceToggle, type PreviewDevice } from "./LivePreview";
import { isSaasMode, utilityApi } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { DEMO_MODE } from "@/lib/config";
import { getPublicUrlOverride } from "@/lib/public-url-override";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import type { SaasBillingContext, SaasPlanDefinition, SaasWorkspaceUsage } from "@/lib/saas-plan";
import type { AdminTab } from "@/lib/admin-navigation";
import { createDefaultMenu, type MenuCatalog } from "@/lib/menu";
import { APP_LOCALES, APP_LOCALE_LABELS, useAppI18n, type AppLocale } from "@/lib/i18n";
import { createNativeMenuLink, isNativeMenuLink, upsertNativeMenuLink } from "@/lib/native-menu-link";
import { ManagedAnalyticsDashboard } from "./ManagedAnalyticsDashboard";
import { VersionHistory } from "./VersionHistory";
import { ProfileQrCode } from "./ProfileQrCode";

interface ProfileData {
  name: string;
  bio: string;
  avatar: string;
  showAvatar?: boolean;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    discord?: string;
    telegram?: string;
    whatsapp?: string;
    mastodon?: string;
  };
  nameFontSize?: string;
  bioFontSize?: string;
  appearance?: ProfileAppearance;
  tabTitle?: string;
  metaDescription?: string;
  footerText?: string;
  favicon?: string;
  googleAnalyticsId?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  adminOnboardingEnabled?: boolean;
}

interface AdminViewProps {
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  menu?: MenuCatalog;
  currentUser: CurrentUser | null;
  saasPlan?: SaasPlanDefinition | null;
  saasUsage?: SaasWorkspaceUsage | null;
  saasBilling?: SaasBillingContext | null;
  onProfileUpdate: (profile: ProfileData) => void | Promise<void>;
  onLinksUpdate: (links: LinkData[]) => void | Promise<void>;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>;
  onMenuUpdate: (menu: MenuCatalog) => Promise<void>;
  onLogout: () => void;
  requestedTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
}

const tabs: Array<{ value: AdminTab; icon: React.ElementType }> = [
  { value: "profile", icon: User },
  { value: "links", icon: Link },
  { value: "theme", icon: Palette },
  { value: "menu", icon: UtensilsCrossed },
  { value: "qr", icon: QrCode },
  { value: "access", icon: Key },
  { value: "backup", icon: Database },
  { value: "analytics", icon: BarChart2 },
  { value: "privacy", icon: Cookie },
  { value: "txt", icon: FileText },
  { value: "sitemap", icon: Map },
];

const ctaActionLabels: Record<string, string> = {
  book: "Book",
  contact: "Contact me",
  download: "Download",
  subscribe: "Subscribe",
  buy: "Buy",
};

export const AdminView = ({
  profile,
  links,
  theme,
  menu = createDefaultMenu(),
  currentUser,
  saasPlan,
  saasUsage,
  saasBilling,
  onProfileUpdate,
  onLinksUpdate,
  onThemeChange,
  onMenuUpdate,
  onLogout,
  requestedTab = "profile",
  onTabChange,
}: AdminViewProps) => {
  const { locale, setLocale, tr } = useAppI18n();
  const tabLabel = (tab: AdminTab) => ({
    profile: tr("Page", "Pagina"), links: "Links", theme: tr("Theme", "Tema"), menu: "Menu", qr: "QR",
    access: tr("Access", "Accesso"), backup: "Backup", analytics: "Analytics", privacy: "Privacy", txt: "TXT", sitemap: "Sitemap",
  })[tab];
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__);
  const [gaId, setGaId] = useState<string>(profile.googleAnalyticsId || "");
  const [gaSaved, setGaSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("profile");
  const [onboardingReplayKey, setOnboardingReplayKey] = useState(0);
  const [didPickInitialTab, setDidPickInitialTab] = useState(false);
  const [onboardingThemeSaved, setOnboardingThemeSaved] = useState(false);
  const [previewProfile, setPreviewProfile] = useState(profile);
  const [previewLinks, setPreviewLinks] = useState(links);
  const publicPageHref = getPublicUrlOverride() || withBasePath('/');
  const entitlements = saasPlan?.entitlements;
  const managePlanHref = saasBilling?.manageUrl || "/dashboard/billing";
  const isHostedAdmin = isSaasMode() || Boolean(
    saasPlan ||
    saasUsage ||
    saasBilling ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("apiBase"))
  );

  useEffect(() => {
    setPreviewProfile(profile);
  }, [profile]);

  useEffect(() => {
    setPreviewLinks(links);
  }, [links]);

  const userPerms = (currentUser?.permissions || []) as Permission[];
  const canManageUsers = hasPermission(userPerms, 'users:manage');
  const canEditProfile = hasPermission(userPerms, 'profile:write');
  const canEditLinks = hasAnyPermission(userPerms, 'links:write', 'links:style', 'links:images');
  const canEditTheme = hasPermission(userPerms, 'theme:write');
  const canEditMenu = hasPermission(userPerms, 'menu:write');
  const canViewAnalytics = hasPermission(userPerms, 'analytics:read');
  const canEditCompliance = hasPermission(userPerms, 'compliance:write');
  const linkEditMode = getLinkEditMode(userPerms);

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const health = await utilityApi.getHealth();
        if (health.version) setAppVersion(health.version);
      } catch (error) {
        console.warn("Failed to load app version from server, using build version:", error);
      }
    };
    loadVersion();
  }, []);

  const visibleTabs = tabs.filter(tab => {
    switch (tab.value) {
      case 'profile':   return canEditProfile;
      case 'links':     return canEditLinks;
      case 'theme':     return canEditTheme;
      case 'menu':      return canEditMenu;
      case 'qr':        return canEditProfile;
      case 'access':    return !isHostedAdmin;
      case 'backup':    return isHostedAdmin && canManageUsers;
      case 'analytics': return canViewAnalytics;
      case 'privacy':   return canEditCompliance;
      case 'txt':       return canEditCompliance;
      case 'sitemap':   return canEditCompliance;
      default:          return false;
    }
  });

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Keep activeTab in sync when permission set changes (e.g. after login)
  useEffect(() => {
    if (visibleTabs.length === 0) return;

    if (currentUser && !didPickInitialTab) {
      const preferred = visibleTabs.find(tab => tab.value === requestedTab)
        || visibleTabs.find(tab => tab.value === "profile")
        || visibleTabs[0];
      setActiveTab(preferred.value);
      if (preferred.value !== requestedTab) onTabChange?.(preferred.value);
      setDidPickInitialTab(true);
      return;
    }

    if (!visibleTabs.some(t => t.value === activeTab)) {
      selectTab(visibleTabs[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, didPickInitialTab, requestedTab]);

  useEffect(() => {
    if (!didPickInitialTab || !visibleTabs.some((tab) => tab.value === requestedTab)) return;
    setActiveTab((current) => current === requestedTab ? current : requestedTab);
  // Permission booleans are included so a deep link is applied as soon as its tab becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab, didPickInitialTab, canEditProfile, canEditLinks, canEditTheme, canEditMenu, canManageUsers, canViewAnalytics, canEditCompliance]);

  useEffect(() => {
    setGaId(profile.googleAnalyticsId || "");
  }, [profile.googleAnalyticsId]);

  const metrics = useMemo(() => {
    const contentLinks = links.filter(link => link.type !== "separator");
    const ctaLinks = contentLinks.filter(link => link.type === "cta");
    const ctaPerformance = ctaLinks
      .filter(link => (link.ctaClicks ?? 0) > 0)
      .sort((a, b) => (b.ctaClicks ?? 0) - (a.ctaClicks ?? 0))
      .slice(0, 5);
    const visibleLinks = contentLinks.filter(link => link.isActive !== false);
    const scheduledLinks = contentLinks.filter(link => link.startDate || link.endDate);
    const totalClicks = links.reduce((sum, link) => sum + (link.clickCount ?? 0), 0);
    const ctaClicks = ctaLinks.reduce((sum, link) => sum + (link.ctaClicks ?? 0), 0);
    const socialCount = Object.values(profile.socialLinks || {}).filter(Boolean).length;

    return {
      visibleLinks: visibleLinks.length,
      totalLinks: contentLinks.length,
      ctaLinks: ctaLinks.length,
      ctaClicks,
      ctaPerformance,
      scheduledLinks: scheduledLinks.length,
      totalClicks,
      socialCount,
      profileReady: Boolean(profile.name?.trim() && profile.bio?.trim()),
    };
  }, [links, profile]);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleSaveIntegrations = () => {
    void onProfileUpdate({ ...profile, googleAnalyticsId: gaId.trim() || undefined });
    setGaSaved(true);
    setTimeout(() => setGaSaved(false), 2500);
  };

  const handleThemeSave = async (nextTheme: ThemeConfig) => {
    await onThemeChange(nextTheme);
    setOnboardingThemeSaved(true);
  };

  return (
    <div className="orbitpage-admin min-h-screen">
      <div className="admin-app-shell">
        <header className="admin-topbar">
          <div className="admin-heading min-w-0">
            <OrbitPageBrand showName={false} size="md" />
            <div className="min-w-0">
              <div className="admin-title-row">
                <h1 className="admin-title">OrbitPage <span>Admin</span></h1>
                {appVersion && <span className="admin-version" title={tr("Embedded OrbitPage OSS runtime version", "Versione del runtime OrbitPage OSS incorporato")}>OSS v{appVersion}</span>}
                {saasPlan && (
                  <a className="admin-plan-badge" href={managePlanHref} target="_top" title={tr("Manage plan", "Gestisci piano")}>
                    {saasPlan.name}
                  </a>
                )}
              </div>
              <p className="admin-subtitle">
                {tr("Your page workspace", "Il workspace della tua pagina")}
              </p>
            </div>
          </div>

          <div className="admin-header-actions">
            <label className="admin-action flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700" title={tr("Language", "Lingua")}>
              <Languages className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{tr("Language", "Lingua")}</span>
              <select className="bg-transparent py-1 outline-none" aria-label={tr("Language", "Lingua")} value={locale} onChange={(event) => setLocale(event.target.value as AppLocale)}>
                {APP_LOCALES.map((supportedLocale) => <option key={supportedLocale} value={supportedLocale}>{APP_LOCALE_LABELS[supportedLocale]}</option>)}
              </select>
            </label>
            <Button
              className="admin-action"
              variant="outline"
              size="sm"
              onClick={() => setOnboardingReplayKey(key => key + 1)}
            >
              <HelpCircle className="h-4 w-4" />
              {tr("Guide", "Guida")}
            </Button>
            <a href={publicPageHref} target="_blank" rel="noopener noreferrer" data-onboarding="public-page">
              <Button className="admin-action admin-action-primary" size="sm">
                <ExternalLink className="h-4 w-4" />
                {tr("Public page", "Pagina pubblica")}
              </Button>
            </a>
            {!isHostedAdmin && (
              <Button className="admin-action" variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                {tr("Logout", "Esci")}
              </Button>
            )}
          </div>
        </header>

        <section className={`admin-metrics${isHostedAdmin ? " admin-metrics-saas" : ""}`} aria-label={tr("Workspace status", "Stato del workspace")}>
          <MetricCard
            icon={Globe2}
            label={tr("Visible links", "Link visibili")}
            value={`${metrics.visibleLinks}/${metrics.totalLinks}`}
            detail={entitlements?.maxBlocks !== undefined
              ? `${saasUsage?.blocks ?? links.length}/${entitlements.maxBlocks ?? "∞"} ${tr("plan blocks", "blocchi del piano")}`
              : metrics.scheduledLinks > 0 ? `${metrics.scheduledLinks} ${tr("scheduled", "programmati")}` : tr("Ready to publish", "Pronta per la pubblicazione")}
          />
          <MetricCard
            icon={MousePointerClick}
            label={tr("Total clicks", "Clic totali")}
            value={String(metrics.totalClicks)}
            detail={metrics.ctaClicks > 0 ? `${metrics.ctaClicks} ${tr("CTA clicks", "clic sulle CTA")}` : tr("Built-in tracking", "Monitoraggio integrato")}
          />
          <MetricCard
            icon={CheckCircle2}
            label={tr("Page", "Pagina")}
            value={metrics.profileReady ? tr("Ready", "Pronta") : tr("Draft", "Bozza")}
            detail={`${metrics.socialCount} ${tr("social links", "link social")}`}
          />
          {!isHostedAdmin && (
            <MetricCard
              icon={ShieldCheck}
              label={tr("Admin access", "Accesso amministratore")}
              value={tr("Protected", "Protetto")}
              detail={tr("Encrypted session token", "Token di sessione crittografato")}
            />
          )}
        </section>

        <Tabs value={activeTab} onValueChange={(value) => selectTab(value as AdminTab)} className="mt-5 flex-1">
          <div className="admin-nav-shell">
            <TabsList className="admin-tabs">
              {visibleTabs.map(({ value, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="admin-tab" data-onboarding={`${value}-tab`}>
                  <Icon className="h-4 w-4" />
                  <span>{tabLabel(value)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="profile" className="admin-tab-content">
            <div className="admin-content-grid admin-content-grid-editor">
              <div className="admin-main-column">
                <ProfileSection
                  profile={profile}
                  theme={theme}
                  onProfileUpdate={onProfileUpdate}
                  onProfilePreview={setPreviewProfile}
                  seoAccess={entitlements?.seo}
                  managePlanHref={managePlanHref}
                  onStartOnboarding={() => setOnboardingReplayKey(key => key + 1)}
                  onAdminOnboardingEnabledChange={(enabled) => {
                    void onProfileUpdate({ ...profile, adminOnboardingEnabled: enabled });
                  }}
                />
              </div>
              <aside className="admin-workbench-rail">
                <PreviewPanel
                  title={tr("Profile and identity", "Profilo e identità")}
                  profile={previewProfile}
                  links={links}
                  theme={theme}
                  publicPageHref={publicPageHref}
                  showOrbitPageBadge={entitlements?.badgeRequired ?? true}
                />
                <section className="admin-side-panel admin-checklist-panel">
                  <PanelHeader icon={User} title={tr("Page checklist", "Verifica pagina")} />
                  <ChecklistItem checked={Boolean(profile.name?.trim())} label={tr("Name or brand is set", "Nome o brand impostato")} />
                  <ChecklistItem checked={Boolean(profile.bio?.trim())} label={tr("Description is set", "Descrizione impostata")} />
                  <ChecklistItem checked={metrics.socialCount > 0} label={tr("At least one social link", "Almeno un link social")} />
                  <ChecklistItem checked={Boolean(profile.tabTitle?.trim())} label={tr("Browser title customized", "Titolo del browser personalizzato")} />
                </section>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="links" className="admin-tab-content">
            <div className="admin-content-grid admin-content-grid-wide">
              <div className="admin-main-column">
                <LinkManager
                  links={links}
                  theme={theme}
                  onLinksUpdate={onLinksUpdate}
                  onLinksPreview={setPreviewLinks}
                  editMode={linkEditMode}
                  maxBlocks={entitlements?.maxBlocks}
                  planName={saasPlan?.name}
                  schedulingEnabled={entitlements?.scheduling ?? true}
                  videoUploadsEnabled={entitlements?.videoUploads ?? true}
                  maxVideoUploadBytes={entitlements?.maxVideoUploadBytes}
                  managePlanHref={managePlanHref}
                  nativeMenuEnabled={!saasPlan || entitlements?.nativeMenu === true}
                  publicPageHref={publicPageHref}
                />
              </div>
              <aside className="admin-workbench-rail">
                <PreviewPanel
                  title={tr("Blocks and composition", "Blocchi e composizione")}
                  profile={profile}
                  links={previewLinks}
                  theme={theme}
                  publicPageHref={publicPageHref}
                  showOrbitPageBadge={entitlements?.badgeRequired ?? true}
                />
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="theme" className="admin-tab-content">
            <ThemeCustomizer
              theme={theme}
              onThemeChange={handleThemeSave}
              onThemePreview={(nextTheme) => applyTheme(nextTheme)}
              renderPreview={(previewTheme, device) => (
                <LivePreview
                  profile={profile}
                  links={links}
                  theme={previewTheme}
                  publicPageHref={publicPageHref}
                  device={device}
                  showOrbitPageBadge={entitlements?.badgeRequired ?? true}
                />
              )}
              accessLevel={entitlements?.themes}
              videoUploadsEnabled={entitlements?.videoUploads ?? true}
              maxUploadBytes={entitlements?.maxUploadBytes}
              maxVideoUploadBytes={entitlements?.maxVideoUploadBytes}
              managePlanHref={managePlanHref}
            />
          </TabsContent>

          <TabsContent value="menu" className="admin-tab-content">
            <MenuEditor
              menu={menu}
              publicPageHref={publicPageHref}
              enabled={!saasPlan || entitlements?.nativeMenu === true}
              maxItems={entitlements?.maxMenuItems ?? null}
              planName={saasPlan?.name}
              advancedTheme={!saasPlan || entitlements?.themes === "advanced"}
              onSave={onMenuUpdate}
              onPreview={() => undefined}
              onAddMenuLink={async () => {
                const menuLink = createNativeMenuLink(publicPageHref, {
                  title: tr('View menu', 'Vedi il menu'),
                  description: tr('Browse food and drinks', 'Scopri piatti e bevande'),
                });
                const exists = links.some(isNativeMenuLink);
                await onLinksUpdate(upsertNativeMenuLink(links, menuLink, exists ? 'append' : 'prepend'));
              }}
            />
          </TabsContent>

          <TabsContent value="qr" className="admin-tab-content">
            <div className="admin-single-column">
              <ProfileQrCode menuEnabled={menu.enabled} />
            </div>
          </TabsContent>

          {!isHostedAdmin && (
            <TabsContent value="access" className="admin-tab-content">
              <div className="admin-single-column space-y-6" data-onboarding="access-section">
                {canManageUsers && <UserManager />}
                {canManageUsers && <BackupManager />}
                <PasswordManager />
              </div>
            </TabsContent>
          )}

          {isHostedAdmin && canManageUsers && (
            <TabsContent value="backup" className="admin-tab-content">
              <div className="admin-single-column space-y-6" data-onboarding="backup-section">
                <VersionHistory />
                <BackupManager hosted />
              </div>
            </TabsContent>
          )}

          <TabsContent value="analytics" className="admin-tab-content">
            {isHostedAdmin ? <ManagedAnalyticsDashboard /> : <div className="admin-analytics-grid">
              <section className="admin-panel" data-onboarding="analytics-section">
                <PanelHeader icon={BarChart2} title={tr("Click analytics", "Analytics dei clic")} />
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <StatusTile label={tr("Total clicks", "Clic totali")} value={String(metrics.totalClicks)} />
                  <StatusTile label={tr("Tracked items", "Elementi monitorati")} value={String(metrics.totalLinks)} />
                  <StatusTile label={tr("CTA clicks", "Clic sulle CTA")} value={String(metrics.ctaClicks)} />
                  <StatusTile label={tr("Smart CTAs", "CTA intelligenti")} value={String(metrics.ctaLinks)} />
                </div>
                {(!saasPlan || entitlements?.analytics !== "basic-clicks") ? (
                  <ClickAnalyticsChart links={links} />
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    {tr("Free includes basic click totals. Trends and per-block comparisons unlock on Starter.", "Free include i totali di base dei clic. Trend e confronti per blocco si sbloccano con Starter.")}
                  </p>
                )}
                {(!saasPlan || entitlements?.analytics !== "basic-clicks") && <div className="mt-6 border-t border-slate-200 pt-5">
                  <PanelHeader icon={MousePointerClick} title={tr("CTA performance", "Prestazioni CTA")} />
                  {metrics.ctaPerformance.length > 0 ? (
                    <div className="space-y-2">
                      {metrics.ctaPerformance.map((link) => (
                        <div key={link.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{link.title || tr('Untitled CTA', 'CTA senza titolo')}</p>
                            <p className="text-xs text-slate-500">{ctaActionLabels[link.ctaAction || 'book']}</p>
                          </div>
                          <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            {link.ctaClicks ?? 0} {tr("clicks", "clic")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">
                      {tr("Smart CTA clicks will appear here separately from normal link clicks.", "I clic sulle CTA intelligenti compariranno qui separati dai clic sui link normali.")}
                    </p>
                  )}
                </div>}
              </section>

              {(!saasPlan || entitlements?.analytics === "advanced-ga4") ? <Card className="admin-panel space-y-5">
                <PanelHeader icon={Globe2} title="Google Analytics 4" />
                <p className="text-sm leading-6 text-slate-600">
                  {tr("Tracking runs on the public page only. Admin activity stays out of analytics.", "Il monitoraggio viene eseguito solo sulla pagina pubblica. L'attività nell'Admin resta esclusa dalle analytics.")}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="ga-id" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    ID di misurazione
                  </Label>
                  <Input
                    id="ga-id"
                    value={gaId}
                    onChange={(e) => setGaId(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="admin-input font-mono text-sm"
                    spellCheck={false}
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    {tr("Find it in Google Analytics, Admin, Data streams, Measurement ID.", "Lo trovi in Google Analytics, Amministrazione, Stream di dati, ID misurazione.")}
                  </p>
                </div>

                {gaId && !gaId.match(/^G-[A-Z0-9]+$/i) && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {tr("The ID must start with G- and use only letters and numbers.", "L'ID deve iniziare con G- e contenere solo lettere e numeri.")}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleSaveIntegrations}
                    className="admin-action admin-action-primary"
                    size="sm"
                    disabled={!canEditProfile || (!!gaId && !gaId.match(/^G-[A-Z0-9]+$/i))}
                  >
                    {gaSaved ? tr("Saved", "Salvato") : tr("Save", "Salva")}
                  </Button>
                  {profile.googleAnalyticsId && (
                    <p className="text-xs text-slate-500">
                      {tr("Active", "Attivo")}: <span className="font-mono text-blue-700">{profile.googleAnalyticsId}</span>
                    </p>
                  )}
                </div>
              </Card> : (
                <PlanLockedFeature
                  title="Google Analytics 4"
                  description={tr("Connect a GA4 Measurement ID with the Pro plan.", "Collega un ID di misurazione GA4 con il piano Pro.")}
                  managePlanHref={managePlanHref}
                />
              )}
            </div>}
          </TabsContent>

          <TabsContent value="privacy" className="admin-tab-content">
            <div data-onboarding="privacy-section">
              <PrivacySettings
                privacyPolicyUrl={profile.privacyPolicyUrl}
                cookiePolicyUrl={profile.cookiePolicyUrl}
                readOnly={DEMO_MODE}
                onLegalPolicyUpdate={({ privacyPolicyUrl, cookiePolicyUrl }) =>
                  onProfileUpdate({ ...profile, privacyPolicyUrl, cookiePolicyUrl })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="txt" className="admin-tab-content">
            <div className="admin-single-column" data-onboarding="txt-section">
              <TextFileManager readOnly={DEMO_MODE} />
            </div>
          </TabsContent>

          <TabsContent value="sitemap" className="admin-tab-content">
            <div className="admin-single-column" data-onboarding="sitemap-section">
              <SitemapManager readOnly={DEMO_MODE} />
            </div>
          </TabsContent>
        </Tabs>

        <AdminOnboarding
          key={onboardingReplayKey}
          activeTab={activeTab}
          visibleTabs={visibleTabs.map(tab => tab.value)}
          onSelectTab={selectTab}
          forceOpen={onboardingReplayKey > 0}
          repeatEnabled={profile.adminOnboardingEnabled !== false}
          profile={{
            name: profile.name,
            bio: profile.bio,
            googleAnalyticsId: profile.googleAnalyticsId,
            privacyPolicyUrl: profile.privacyPolicyUrl,
            cookiePolicyUrl: profile.cookiePolicyUrl,
          }}
          savedLinkCount={links.length}
          themeSaved={onboardingThemeSaved}
        />

        <footer className="admin-footer">
          {DEMO_MODE && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs leading-5 text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                <span>{tr("Demo Mode", "Modalità demo")}</span>
              </div>
              <p>
                {tr(
                  "This instance is automatically reset every 5 minutes. Any changes made during the demo will be lost after the reset. Any users created during the demo will be removed. Changing the admin password is disabled. Editing privacy settings and TXT files, including Privacy Policy, Cookie Policy, Consent Management, crawler files, and related compliance configuration, is disabled.",
                  "Questa istanza viene ripristinata automaticamente ogni 5 minuti. Le modifiche e gli utenti creati durante la demo verranno rimossi. Il cambio della password amministratore e la modifica di privacy, consenso e file TXT sono disabilitati."
                )}
              </p>
            </div>
          )}
          {profile.footerText && (
            <p className="whitespace-pre-line text-xs text-slate-500">
              {profile.footerText}
            </p>
          )}
          <p>
            {tr("Powered by", "Realizzato con")}{" "}
            <a href="https://github.com/paoloronco/OrbitPage" target="_blank" rel="noopener noreferrer">
              OrbitPage
            </a>
            {appVersion && <span> OSS v{appVersion}</span>}
          </p>
        </footer>
      </div>
    </div>
  );
};

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="admin-metric-card">
      <div className="admin-metric-icon">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="admin-metric-label">{label}</p>
        <p className="admin-metric-value">{value}</p>
        <p className="admin-metric-detail">{detail}</p>
      </div>
    </div>
  );
}

function PreviewPanel({
  title,
  profile,
  links,
  theme,
  menu,
  publicPageHref,
  showOrbitPageBadge,
}: {
  title: string;
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  menu: MenuCatalog;
  publicPageHref: string;
  showOrbitPageBadge: boolean;
}) {
  const { tr } = useAppI18n();
  const [device, setDevice] = useState<PreviewDevice>("mobile");

  return (
    <section className="admin-preview-panel">
      <div className="admin-preview-heading">
        <div>
          <h2>{tr("Page preview", "Anteprima pagina")}</h2>
          <p>{title}</p>
        </div>
        <div className="admin-preview-heading-actions">
          <PreviewDeviceToggle value={device} onChange={setDevice} />
          <a
            href={publicPageHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={tr("Open published page", "Apri la pagina pubblicata")}
            title={tr("Open published page", "Apri la pagina pubblicata")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
      <LivePreview
        profile={profile}
        links={links}
        theme={theme}
        publicPageHref={publicPageHref}
        device={device}
        showOrbitPageBadge={showOrbitPageBadge}
      />
    </section>
  );
}

function PanelHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="admin-panel-icon">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
    </div>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <span className={checked ? "admin-check admin-check-active" : "admin-check"} />
      <span>{label}</span>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PlanLockedFeature({
  title,
  description,
  managePlanHref,
}: {
  title: string;
  description: string;
  managePlanHref: string;
}) {
  return (
    <Card className="admin-plan-locked">
      <span className="admin-plan-locked-icon"><LockKeyhole className="h-5 w-5" /></span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <a href={managePlanHref} target="_top">View plans</a>
    </Card>
  );
}



