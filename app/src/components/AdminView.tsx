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
import { OrbitLoader } from "@/components/ui/orbit-loader";
import { CurrentUser } from "@/pages/Admin";
import { Permission, hasPermission, hasAnyPermission, getLinkEditMode } from "@/lib/permissions";
import {
  AlertTriangle,
  BarChart2,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Cookie,
  CreditCard,
  Database,
  ExternalLink,
  Files,
  Globe2,
  HelpCircle,
  Home,
  Languages,
  Link,
  LockKeyhole,
  LogOut,
  Mail,
  Menu as MenuIcon,
  MousePointerClick,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Power,
  Share2,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  ShieldCheck,
  User,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { ThemeConfig, applyTheme } from "@/lib/theme";
import { PasswordManager } from "./PasswordManager";
import { UserManager } from "./UserManager";
import { OrbitPageBrand } from "./OrbitPageBrand";
import { PrivacySettings } from "./PrivacySettings";
import { BackupManager } from "./BackupManager";
import { TwoFactorManager } from "./TwoFactorManager";
import { AdminOnboarding } from "./AdminOnboarding";
import { LivePreview, PreviewDeviceToggle, type PreviewDevice } from "./LivePreview";
import { isIntegratedHostedSurface, isSaasMode, publicUrlApi, utilityApi } from "@/lib/api-client";
import {
  getHostedSurfaceConfig,
  HOSTED_CONFIG_CHANGED_EVENT,
  type HostedSurfaceConfig,
} from "@/lib/hosted-surface";
import { withBasePath } from "@/lib/base-path";
import { DEMO_MODE } from "@/lib/config";
import { getPublicUrlOverride } from "@/lib/public-url-override";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import type { HostedEditorBilling, HostedEditorPlan, HostedEditorUsage } from "@/lib/hosted-editor-contract";
import { canonicalAdminTab, type AdminContentSection, type AdminTab } from "@/lib/admin-navigation";
import { DEFAULT_CONTENT_ROUTING, createDefaultMenu, type ContentDestination, type ContentRouting, type MenuCatalog } from "@/lib/menu";
import { APP_LOCALES, APP_LOCALE_LABELS, useAppI18n, type AppLocale } from "@/lib/i18n";
import { createNativeMenuLink, isNativeMenuLink, upsertNativeMenuLink } from "@/lib/native-menu-link";
import {
  beginOnboardingChecklistSession,
  dismissOnboardingChecklist,
  endOnboardingChecklistSession,
  readOnboardingChecklistSession,
  type OnboardingChecklistSession,
} from "@/lib/onboarding-checklist-storage";
import { ManagedAnalyticsDashboard } from "./ManagedAnalyticsDashboard";
import { VersionHistory } from "./VersionHistory";
import { SubpageManager, type EditorSubpage } from "./SubpageManager";
import { PublishTools } from "./PublishTools";
import { SelfHostedAiPanel } from "./SelfHostedAiPanel";
import { SelfHostedAiAgent } from "./SelfHostedAiAgent";
import { OpenSourcePlan } from "./OpenSourcePlan";

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
  showOrbitPageBadge?: boolean;
  favicon?: string;
  googleAnalyticsId?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  adminOnboardingEnabled?: boolean;
}

interface AdminViewProps {
  profile: ProfileData;
  links: LinkData[];
  subpages?: EditorSubpage[];
  theme: ThemeConfig;
  menu?: MenuCatalog;
  currentUser: CurrentUser | null;
  saasPlan?: HostedEditorPlan | null;
  saasUsage?: HostedEditorUsage | null;
  saasBilling?: HostedEditorBilling | null;
  onProfileUpdate: (profile: ProfileData) => void | Promise<void>;
  onLinksUpdate: (links: LinkData[]) => void | Promise<void>;
  onSubpagesUpdate?: (pages: EditorSubpage[]) => Promise<void>;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>;
  onMenuUpdate: (menu: MenuCatalog) => Promise<void>;
  onAiApplied?: () => void;
  onLogout: () => void;
  requestedTab?: AdminTab;
  requestedContentSection?: AdminContentSection;
  onTabChange?: (tab: AdminTab) => void;
  onContentSectionChange?: (section: AdminContentSection) => void;
}

const pageTabs: Array<{ value: AdminTab; icon: React.ElementType; iconName: string }> = [
  { value: "profile", icon: UserRound, iconName: "user-round" },
  { value: "content", icon: Files, iconName: "files" },
  { value: "ai", icon: Sparkles, iconName: "sparkles" },
  { value: "theme", icon: Palette, iconName: "palette" },
  { value: "publish", icon: Share2, iconName: "share-2" },
  { value: "backup", icon: Database, iconName: "database" },
  { value: "analytics", icon: BarChart3, iconName: "bar-chart-3" },
  { value: "privacy", icon: Cookie, iconName: "cookie" },
];

const workspaceTabs: Array<{ value: AdminTab; icon: React.ElementType; iconName: string }> = [
  { value: "newsletter", icon: Mail, iconName: "mail" },
  { value: "team", icon: UsersRound, iconName: "users-round" },
  { value: "account", icon: CircleUserRound, iconName: "circle-user-round" },
  { value: "plan", icon: CreditCard, iconName: "credit-card" },
];

const tabs = [...pageTabs, ...workspaceTabs];

function contentSectionForTab(tab: AdminTab): ContentDestination | null {
  if (tab === "links") return "link";
  if (tab === "menu") return "menu";
  if (tab === "pages") return "pages";
  return null;
}

function canonicalViewTab(tab: AdminTab): AdminTab {
  return canonicalAdminTab(tab);
}

const ctaActionLabels: Record<string, string> = {
  book: "Book",
  contact: "Contact me",
  download: "Download",
  subscribe: "Subscribe",
  buy: "Buy",
};

const SELF_HOSTED_SIDEBAR_STORAGE_KEY = "orbitpage.admin.sidebar-collapsed";
const EMBEDDED_PREVIEW_MEDIA_QUERY = "(min-width: 1121px)";

export const AdminView = ({
  profile,
  links,
  subpages = [],
  theme,
  menu = createDefaultMenu(),
  currentUser,
  saasPlan,
  saasUsage,
  saasBilling,
  onProfileUpdate,
  onLinksUpdate,
  onSubpagesUpdate = async () => undefined,
  onThemeChange,
  onMenuUpdate,
  onAiApplied,
  onLogout,
  requestedTab = "profile",
  requestedContentSection = "link",
  onTabChange,
  onContentSectionChange,
}: AdminViewProps) => {
  const { locale, setLocale, tr } = useAppI18n();
  const tabLabel = (tab: AdminTab) => ({
    profile: "Page", content: "Content", links: "Content", pages: "Content", ai: tr("AI Assistant", "Assistente AI"), theme: "Theme", menu: "Content",
    publish: tr("Publish", "Pubblica"), qr: tr("Publish", "Pubblica"), txt: tr("Publish", "Pubblica"), sitemap: tr("Publish", "Pubblica"),
    newsletter: "Newsletter", team: tr("Team", "Team"), account: tr("Account", "Account"), plan: tr("Plan", "Piano"), access: tr("Account", "Account"), backup: "Backup", analytics: "Analytics", privacy: "Privacy",
  })[tab];
  const tabDescription = (tab: AdminTab) => ({
    profile: tr("Shape the identity people see first.", "Definisci l'identità che le persone vedono per prima."),
    content: tr("Organize links, pages, menu and selling tools.", "Organizza link, pagine, menu e strumenti di vendita."),
    links: tr("Organize links, pages, menu and selling tools.", "Organizza link, pagine, menu e strumenti di vendita."),
    pages: tr("Organize links, pages, menu and selling tools.", "Organizza link, pagine, menu e strumenti di vendita."),
    menu: tr("Organize links, pages, menu and selling tools.", "Organizza link, pagine, menu e strumenti di vendita."),
    ai: tr("Ask for a change, review the proposal, then apply it.", "Chiedi una modifica, controlla la proposta e poi applicala."),
    theme: tr("Tune the visual system without losing readability.", "Perfeziona il sistema visivo senza perdere leggibilità."),
    publish: tr("Control how your page is discovered and shared.", "Controlla come la pagina viene trovata e condivisa."),
    qr: tr("Control how your page is discovered and shared.", "Controlla come la pagina viene trovata e condivisa."),
    txt: tr("Control how your page is discovered and shared.", "Controlla come la pagina viene trovata e condivisa."),
    sitemap: tr("Control how your page is discovered and shared.", "Controlla come la pagina viene trovata e condivisa."),
    newsletter: tr("Create, schedule and review campaigns in one place.", "Crea, programma e controlla le campagne in un unico posto."),
    team: tr("Give each collaborator the access they actually need.", "Assegna a ogni collaboratore solo l'accesso necessario."),
    account: tr("Manage identity, security and your active workspace.", "Gestisci identità, sicurezza e workspace attivo."),
    plan: tr("Review what is included in this open-source edition.", "Scopri cosa include questa edizione open source."),
    access: tr("Manage identity, security and your active workspace.", "Gestisci identità, sicurezza e workspace attivo."),
    backup: tr("Keep portable copies and restore with confidence.", "Mantieni copie portabili e ripristina in sicurezza."),
    analytics: tr("See visits, clicks and traffic sources.", "Controlla visite, clic e sorgenti di traffico."),
    privacy: tr("Manage consent, policies and visitor choices.", "Gestisci consenso, informative e scelte dei visitatori."),
  })[tab];
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__);
  const [gaId, setGaId] = useState<string>(profile.googleAnalyticsId || "");
  const [gaSaved, setGaSaved] = useState(false);
  const [gaSaving, setGaSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("profile");
  const [contentSection, setContentSection] = useState<ContentDestination>(() => (
    getHostedSurfaceConfig()?.contentSection
      || (getHostedSurfaceConfig()?.extensions?.shop?.selected ? "shop" : null)
      || requestedContentSection
      || contentSectionForTab(requestedTab)
      || "link"
  ));
  const [hostedSurfaceConfig, setHostedSurfaceConfig] = useState<HostedSurfaceConfig | null>(() => getHostedSurfaceConfig());
  const [onboardingReplayKey, setOnboardingReplayKey] = useState(0);
  const [didPickInitialTab, setDidPickInitialTab] = useState(false);
  const [onboardingThemeSaved, setOnboardingThemeSaved] = useState(false);
  const [previewProfile, setPreviewProfile] = useState(profile);
  const [previewLinks, setPreviewLinks] = useState(links);
  const [showEmbeddedPreview, setShowEmbeddedPreview] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia(EMBEDDED_PREVIEW_MEDIA_QUERY).matches;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SELF_HOSTED_SIDEBAR_STORAGE_KEY) === "true";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contentNavOpen, setContentNavOpen] = useState(() => requestedTab === "content");
  const [contentAction, setContentAction] = useState<string | null>(null);
  const [contentWorkspaceError, setContentWorkspaceError] = useState<string | null>(null);
  const publicUrlOverride = getPublicUrlOverride();
  const [publicPageHref, setPublicPageHref] = useState(publicUrlOverride || withBasePath('/'));
  const entitlements = saasPlan?.entitlements;
  const managePlanHref = saasBilling?.manageUrl || "/dashboard/billing";
  const isHostedAdmin = isSaasMode() || Boolean(
    saasPlan ||
    saasUsage ||
    saasBilling
  );
  const isIntegratedHostedAdmin = isHostedAdmin && isIntegratedHostedSurface();
  const hostedShop = isIntegratedHostedAdmin ? hostedSurfaceConfig?.extensions?.shop : undefined;
  const isProspectReadOnly = currentUser?.readOnly === true;
  const orbitPageBadgeEditable = entitlements?.badgeRequired !== true && !isProspectReadOnly;
  const resolveOrbitPageBadgeVisibility = (preference: boolean | undefined) => (
    orbitPageBadgeEditable ? (preference ?? !saasPlan) : true
  );
  const checklistIdentity = currentUser
    ? `${isHostedAdmin ? "hosted" : "self-hosted"}:${currentUser.username}`
    : "";
  const [checklistSession, setChecklistSession] = useState<OnboardingChecklistSession>(() => (
    checklistIdentity
      ? readOnboardingChecklistSession(
          checklistIdentity,
          typeof window === "undefined" ? undefined : window.localStorage,
          typeof window === "undefined" ? undefined : window.sessionStorage,
        )
      : { visible: false, sessionNumber: 1, sessionLimit: 3 }
  ));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(EMBEDDED_PREVIEW_MEDIA_QUERY);
    const syncPreviewVisibility = () => setShowEmbeddedPreview(mediaQuery.matches);
    syncPreviewVisibility();
    mediaQuery.addEventListener("change", syncPreviewVisibility);
    return () => mediaQuery.removeEventListener("change", syncPreviewVisibility);
  }, []);

  useEffect(() => {
    if (!isIntegratedHostedAdmin) return;
    const syncHostedConfig = () => {
      const nextConfig = getHostedSurfaceConfig();
      setHostedSurfaceConfig(nextConfig);
      setContentSection((current) => {
        if (nextConfig?.contentSection) return nextConfig.contentSection;
        if (nextConfig?.extensions?.shop?.selected) return "shop";
        return current;
      });
    };
    window.addEventListener(HOSTED_CONFIG_CHANGED_EVENT, syncHostedConfig);
    syncHostedConfig();
    return () => window.removeEventListener(HOSTED_CONFIG_CHANGED_EVENT, syncHostedConfig);
  }, [isIntegratedHostedAdmin]);

  const selectContentSection = (section: ContentDestination) => {
    setContentSection(section);
    setContentNavOpen(true);
    onContentSectionChange?.(section);
    if (!isIntegratedHostedAdmin) return;
    const config = getHostedSurfaceConfig();
    if (config?.onContentSectionChange) {
      config.onContentSectionChange(section);
    } else if (section === "shop") {
      config?.onOpenShop?.();
    }
  };

  useEffect(() => {
    if (!checklistIdentity || isProspectReadOnly) {
      setChecklistSession((current) => ({ ...current, visible: false }));
      return;
    }
    setChecklistSession(beginOnboardingChecklistSession(checklistIdentity, window.localStorage, window.sessionStorage));
  }, [checklistIdentity, isProspectReadOnly]);

  useEffect(() => {
    if (publicUrlOverride) {
      setPublicPageHref(publicUrlOverride);
      return;
    }
    if (isHostedAdmin) return;

    let cancelled = false;
    void publicUrlApi.get()
      .then((response) => {
        if (!cancelled && response.publicUrl) setPublicPageHref(response.publicUrl);
      })
      .catch(() => {
        if (!cancelled) setPublicPageHref(withBasePath('/'));
      });
    return () => {
      cancelled = true;
    };
  }, [isHostedAdmin, publicUrlOverride]);

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
  const contentRouting: ContentRouting = menu.routing || DEFAULT_CONTENT_ROUTING;
  const firstEnabledSubpage = subpages.find((page) => page.enabled) || null;
  const contentDestinationEnabled: Record<ContentDestination, boolean> = {
    link: contentRouting.linkEnabled,
    menu: menu.enabled,
    shop: Boolean(hostedShop?.enabled),
    pages: Boolean(firstEnabledSubpage),
  };

  useEffect(() => {
    if (!isIntegratedHostedAdmin) return;
    getHostedSurfaceConfig()?.onContentRoutingChange?.(contentRouting);
  }, [contentRouting, isIntegratedHostedAdmin]);

  const saveContentRouting = async (routing: ContentRouting) => {
    await onMenuUpdate({ ...menu, routing });
  };

  const makeContentHomepage = async (destination: ContentDestination) => {
    if (!contentDestinationEnabled[destination] || contentAction) return;
    const homepagePageSlug = destination === "pages" ? firstEnabledSubpage?.slug : undefined;
    if (destination === "pages" && !homepagePageSlug) return;
    setContentWorkspaceError(null);
    setContentAction(`homepage:${destination}`);
    try {
      await saveContentRouting({
        ...contentRouting,
        homepage: destination,
        ...(homepagePageSlug ? { homepagePageSlug } : { homepagePageSlug: undefined }),
      });
    } catch (error) {
      setContentWorkspaceError(error instanceof Error ? error.message : tr("The homepage could not be changed.", "Non è stato possibile cambiare la homepage."));
    } finally {
      setContentAction(null);
    }
  };

  const toggleContentDestination = async (destination: ContentDestination) => {
    if (contentAction || contentRouting.homepage === destination) return;
    const enabled = contentDestinationEnabled[destination];
    if (enabled && !window.confirm(tr(
      "Deactivate this destination? Its content stays saved and you can reactivate it later.",
      "Disattivare questa destinazione? I contenuti restano salvati e potrai riattivarla in seguito.",
    ))) return;

    setContentWorkspaceError(null);
    setContentAction(`toggle:${destination}`);
    try {
      if (destination === "link") {
        await saveContentRouting({ ...contentRouting, linkEnabled: !enabled });
      } else if (destination === "menu") {
        await onMenuUpdate({ ...menu, enabled: !enabled });
      } else if (destination === "pages") {
        if (subpages.length === 0) {
          selectContentSection("pages");
          return;
        }
        await onSubpagesUpdate(subpages.map((page) => ({ ...page, enabled: !enabled })));
      } else {
        const changeShopStatus = getHostedSurfaceConfig()?.onShopStatusChange;
        if (!changeShopStatus) {
          selectContentSection("shop");
          return;
        }
        await changeShopStatus(!enabled);
      }
    } catch (error) {
      setContentWorkspaceError(error instanceof Error ? error.message : tr("The destination status could not be changed.", "Non è stato possibile cambiare lo stato della destinazione."));
    } finally {
      setContentAction(null);
    }
  };

  const contentDestinationCards: Array<{
    description: string;
    enabled: boolean;
    icon: React.ElementType;
    id: ContentDestination;
    label: string;
    locked?: boolean;
  }> = [
    {
      id: "link",
      icon: Link,
      label: tr("Links", "Link"),
      description: tr("Profile, links and blocks in one destination", "Profilo, link e blocchi in un'unica destinazione"),
      enabled: contentDestinationEnabled.link,
    },
    {
      id: "menu",
      icon: UtensilsCrossed,
      label: tr("Menu", "Menu"),
      description: tr("A dedicated food and drinks destination", "Una destinazione dedicata a piatti e bevande"),
      enabled: contentDestinationEnabled.menu,
    },
    {
      id: "shop",
      icon: ShoppingBag,
      label: tr("Shop", "Shop"),
      description: tr("Digital products and services with Stripe checkout", "Prodotti digitali e servizi con checkout Stripe"),
      enabled: contentDestinationEnabled.shop,
      locked: !hostedShop,
    },
    {
      id: "pages",
      icon: Files,
      label: tr("Additional pages", "Pagine aggiuntive"),
      description: tr("Separate URLs for events, services or campaigns", "URL separati per eventi, servizi o campagne"),
      enabled: contentDestinationEnabled.pages,
    },
  ];

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
    if (isProspectReadOnly && !isHostedAdmin) return tab.value === "plan";
    switch (tab.value) {
      case 'profile':   return canEditProfile;
      case 'content':   return canEditLinks || canEditMenu;
      case 'ai':        return !isHostedAdmin && (canEditProfile || canEditLinks || canEditTheme);
      case 'theme':     return canEditTheme;
      case 'publish':   return canEditProfile || canEditCompliance;
      case 'team':      return !isHostedAdmin && canManageUsers;
      case 'newsletter': return !isHostedAdmin;
      case 'account':   return !isHostedAdmin;
      case 'plan':      return !isHostedAdmin;
      case 'access':    return false;
      case 'backup':    return canManageUsers;
      case 'analytics': return canViewAnalytics;
      case 'privacy':   return canEditCompliance;
      default:          return false;
    }
  });
  const visiblePageTabs = visibleTabs.filter((tab) => pageTabs.some((pageTab) => pageTab.value === tab.value));
  const visibleWorkspaceTabs = visibleTabs.filter((tab) => workspaceTabs.some((workspaceTab) => workspaceTab.value === tab.value));

  const selectTab = (tab: AdminTab) => {
    const requestedContentSection = contentSectionForTab(tab);
    if (requestedContentSection) setContentSection(requestedContentSection);
    const canonicalTab = canonicalViewTab(tab);
    if (canonicalTab === "content") setContentNavOpen(true);
    setActiveTab(canonicalTab);
    setMobileNavOpen(false);
    onTabChange?.(canonicalTab);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.querySelector<HTMLElement>(".admin-dashboard-main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SELF_HOSTED_SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  // Keep activeTab in sync when permission set changes (e.g. after login)
  useEffect(() => {
    if (visibleTabs.length === 0) return;

    if (currentUser && !didPickInitialTab) {
      const legacyContentSection = contentSectionForTab(requestedTab);
      if (canonicalViewTab(requestedTab) === "content") setContentSection(requestedContentSection || legacyContentSection || "link");
      const canonicalRequestedTab = canonicalViewTab(requestedTab);
      const preferred = visibleTabs.find(tab => tab.value === canonicalRequestedTab)
        || visibleTabs.find(tab => tab.value === "profile")
        || visibleTabs[0];
      setActiveTab(preferred.value);
      if (preferred.value !== canonicalRequestedTab) onTabChange?.(preferred.value);
      setDidPickInitialTab(true);
      return;
    }

    if (!visibleTabs.some(t => t.value === activeTab)) {
      selectTab(visibleTabs[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, didPickInitialTab, requestedTab, requestedContentSection]);

  useEffect(() => {
    const legacyContentSection = contentSectionForTab(requestedTab);
    if (canonicalViewTab(requestedTab) === "content") setContentSection(requestedContentSection || legacyContentSection || "link");
    const canonicalRequestedTab = canonicalViewTab(requestedTab);
    if (!didPickInitialTab || !visibleTabs.some((tab) => tab.value === canonicalRequestedTab)) return;
    setActiveTab((current) => current === canonicalRequestedTab ? current : canonicalRequestedTab);
  // Permission booleans are included so a deep link is applied as soon as its tab becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab, requestedContentSection, didPickInitialTab, canEditProfile, canEditLinks, canEditTheme, canEditMenu, canManageUsers, canViewAnalytics, canEditCompliance]);

  useEffect(() => {
    if (isHostedAdmin || !mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isHostedAdmin, mobileNavOpen]);

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

  const pageChecklistItems = [
    { checked: Boolean(profile.name?.trim()), label: tr("Name or brand is set", "Nome o brand impostato") },
    { checked: Boolean(profile.bio?.trim()), label: tr("Description is set", "Descrizione impostata") },
    { checked: metrics.socialCount > 0, label: tr("At least one social link", "Almeno un link social") },
    { checked: Boolean(profile.tabTitle?.trim()), label: tr("Browser title customized", "Titolo del browser personalizzato") },
  ];
  const completedChecklistItems = pageChecklistItems.filter((item) => item.checked).length;

  const handleLogout = () => {
    if (checklistIdentity) endOnboardingChecklistSession(checklistIdentity, window.sessionStorage);
    logout();
    onLogout();
  };

  const dismissPageChecklist = () => {
    if (checklistIdentity) dismissOnboardingChecklist(checklistIdentity, window.localStorage, window.sessionStorage);
    setChecklistSession((current) => ({ ...current, visible: false }));
  };

  const gaDirty = gaId.trim() !== (profile.googleAnalyticsId || "");

  const handleSaveIntegrations = async () => {
    if (!gaDirty || gaSaving) return;
    setGaSaving(true);
    try {
      await onProfileUpdate({ ...profile, googleAnalyticsId: gaId.trim() || undefined });
      setGaSaved(true);
      setTimeout(() => setGaSaved(false), 2500);
    } finally {
      setGaSaving(false);
    }
  };

  const handleThemeSave = async (nextTheme: ThemeConfig) => {
    await onThemeChange(nextTheme);
    setOnboardingThemeSaved(true);
  };

  const googleAnalyticsPanel = (!saasPlan || entitlements?.analytics === "advanced-ga4") ? (
    <details className="managed-analytics-integration" data-testid="google-analytics-settings">
      <summary>
        <span className="managed-analytics-integration-title">
          <Globe2 aria-hidden="true" size={17} />
          <span>
            <strong>Google Analytics 4</strong>
          </span>
        </span>
        <span className={profile.googleAnalyticsId ? "is-active" : ""}>
          {profile.googleAnalyticsId ? tr("Active", "Attivo") : tr("Manage", "Gestisci")}
        </span>
      </summary>
      <div className="managed-analytics-integration-body">
        <p>
          {tr("Tracking runs on the public page only. Admin activity stays out of analytics.", "Il monitoraggio viene eseguito solo sulla pagina pubblica. L'attività nell'Admin resta esclusa dalle analytics.")}
        </p>

        <div className="managed-analytics-integration-field">
          <Label htmlFor="ga-id">
            {tr("Measurement ID", "ID di misurazione")}
          </Label>
          <Input
            id="ga-id"
            value={gaId}
            onChange={(event) => setGaId(event.target.value)}
            placeholder="G-XXXXXXXXXX"
            className="admin-input font-mono text-sm"
            spellCheck={false}
          />
          <small>
            {tr("Find it in Google Analytics, Admin, Data streams, Measurement ID.", "Lo trovi in Google Analytics, Amministrazione, Stream di dati, ID misurazione.")}
          </small>
        </div>

        {gaId && !gaId.match(/^G-[A-Z0-9]+$/i) && (
          <p className="managed-analytics-integration-error">
            {tr("The ID must start with G- and use only letters and numbers.", "L'ID deve iniziare con G- e contenere solo lettere e numeri.")}
          </p>
        )}

        <div className="managed-analytics-integration-actions">
          <Button
            onClick={() => void handleSaveIntegrations()}
            className="admin-action admin-action-primary"
            size="sm"
            disabled={!canEditProfile || !gaDirty || gaSaving || (!!gaId && !gaId.match(/^G-[A-Z0-9]+$/i))}
          >
            {gaSaving && <OrbitLoader size={16} state="connecting" />}
            {gaSaving ? tr("Saving", "Salvataggio") : gaSaved ? tr("Saved", "Salvato") : tr("Save", "Salva")}
          </Button>
          {profile.googleAnalyticsId && (
            <p>
              {tr("Active", "Attivo")}: <span>{profile.googleAnalyticsId}</span>
            </p>
          )}
        </div>
      </div>
    </details>
  ) : (
    <PlanLockedFeature
      title="Google Analytics 4"
      description={tr("Connect a GA4 Measurement ID with the Pro plan.", "Collega un ID di misurazione GA4 con il piano Pro.")}
      managePlanHref={managePlanHref}
    />
  );

  return (
    <div
      className={`orbitpage-admin min-h-screen${!isHostedAdmin ? ` admin-dashboard-shell${sidebarCollapsed ? " admin-dashboard-collapsed" : ""}` : isIntegratedHostedAdmin ? " admin-integrated-surface" : ""}`}
      data-orbitpage-workspace-ready={isIntegratedHostedAdmin ? "true" : undefined}
    >
      {!isHostedAdmin && (
        <aside className="admin-dashboard-sidebar">
          <div className="admin-dashboard-logo-row">
            <div className="admin-dashboard-logo">
              <OrbitPageBrand className="orbitpage-dashboard-brand" showName={false} size="md" />
              <div className="admin-dashboard-logo-copy orbitpage-dashboard-brand-copy">
                <strong>OrbitPage</strong>
                <small>/{currentUser?.username || "admin"}</small>
              </div>
            </div>
            <button
              aria-label={sidebarCollapsed ? tr("Expand navigation", "Espandi navigazione") : tr("Collapse navigation", "Comprimi navigazione")}
              aria-pressed={sidebarCollapsed}
              className="admin-dashboard-collapse"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? tr("Expand navigation", "Espandi navigazione") : tr("Collapse navigation", "Comprimi navigazione")}
              type="button"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              aria-controls="admin-dashboard-primary-navigation"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? tr("Close navigation", "Chiudi navigazione") : tr("Open navigation", "Apri navigazione")}
              className={`admin-dashboard-mobile-nav-button${mobileNavOpen ? " open" : ""}`}
              onClick={() => setMobileNavOpen((current) => !current)}
              type="button"
            >
              {mobileNavOpen ? <X aria-hidden="true" className="h-[19px] w-[19px]" /> : <MenuIcon aria-hidden="true" className="h-[19px] w-[19px]" />}
              <span className="admin-dashboard-mobile-nav-copy">
                <span>{tr("Menu", "Menu")}</span>
                <strong>{tabLabel(activeTab)}</strong>
              </span>
              <ChevronDown className="admin-dashboard-mobile-nav-chevron h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            aria-hidden={!mobileNavOpen}
            aria-label={tr("Close navigation", "Chiudi navigazione")}
            className={`admin-dashboard-mobile-nav-backdrop${mobileNavOpen ? " open" : ""}`}
            onClick={() => setMobileNavOpen(false)}
            tabIndex={mobileNavOpen ? 0 : -1}
            type="button"
          />

          <div className={`admin-dashboard-nav-stack${mobileNavOpen ? " open" : ""}`} id="admin-dashboard-primary-navigation">
            <div className="admin-dashboard-nav-heading">{tr("Page tools", "Strumenti pagina")}</div>
            <nav className="admin-dashboard-nav admin-dashboard-nav-page" aria-label={tr("Page tools", "Strumenti pagina")}>
              {visiblePageTabs.map(({ value, icon: Icon, iconName }) => value === "content" ? (
                <div className="admin-dashboard-content-nav" key={value}>
                  <div className="admin-dashboard-content-nav-row">
                    <button
                      aria-current={activeTab === value ? "page" : undefined}
                      className={activeTab === value ? "admin-dashboard-nav-item active" : "admin-dashboard-nav-item"}
                      data-onboarding={`${value}-tab`}
                      onClick={() => selectTab(value)}
                      title={tabLabel(value)}
                      type="button"
                    >
                      <Icon className="admin-dashboard-nav-icon h-[18px] w-[18px]" data-dashboard-icon={iconName} aria-hidden="true" />
                      <span>{tabLabel(value)}</span>
                    </button>
                    <button
                      aria-expanded={contentNavOpen}
                      aria-label={contentNavOpen ? tr("Collapse Content destinations", "Comprimi le destinazioni Content") : tr("Expand Content destinations", "Espandi le destinazioni Content")}
                      className="admin-dashboard-content-nav-toggle"
                      onClick={() => setContentNavOpen((current) => !current)}
                      type="button"
                    >
                      <ChevronDown aria-hidden="true" />
                    </button>
                  </div>
                  <div className={contentNavOpen ? "admin-dashboard-content-subnav open" : "admin-dashboard-content-subnav"}>
                    {contentDestinationCards.map(({ icon: DestinationIcon, id, label, locked }) => (
                      <button
                        aria-current={activeTab === "content" && contentSection === id ? "page" : undefined}
                        className={activeTab === "content" && contentSection === id ? "active" : ""}
                        disabled={locked}
                        key={id}
                        onClick={() => {
                          setActiveTab("content");
                          selectContentSection(id);
                          setMobileNavOpen(false);
                        }}
                        type="button"
                      >
                        <DestinationIcon aria-hidden="true" />
                        <span>{label}</span>
                        {locked && <small>SaaS</small>}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  aria-current={activeTab === value ? "page" : undefined}
                  className={activeTab === value ? "admin-dashboard-nav-item active" : "admin-dashboard-nav-item"}
                  data-onboarding={`${value}-tab`}
                  key={value}
                  onClick={() => selectTab(value)}
                  title={tabLabel(value)}
                  type="button"
                >
                  <Icon className="admin-dashboard-nav-icon h-[18px] w-[18px]" data-dashboard-icon={iconName} aria-hidden="true" />
                  <span>{tabLabel(value)}</span>
                </button>
              ))}
            </nav>

            {visibleWorkspaceTabs.length > 0 && (
              <nav className="admin-dashboard-nav admin-dashboard-nav-workspace" aria-label={tr("Workspace tools", "Strumenti workspace")}>
                <span className="admin-dashboard-nav-heading admin-dashboard-nav-heading-workspace">{tr("Workspace Open Source", "Workspace Open Source")}</span>
                {visibleWorkspaceTabs.map(({ value, icon: Icon, iconName }) => (
                  <button
                    aria-current={activeTab === value ? "page" : undefined}
                    className={activeTab === value ? "admin-dashboard-nav-item active" : "admin-dashboard-nav-item"}
                    data-onboarding={`${value}-tab`}
                    key={value}
                    onClick={() => selectTab(value)}
                    title={tabLabel(value)}
                    type="button"
                  >
                    <Icon className="admin-dashboard-nav-icon h-[18px] w-[18px]" data-dashboard-icon={iconName} aria-hidden="true" />
                    <span>{tabLabel(value)}</span>
                  </button>
                ))}
              </nav>
            )}

            <div className="admin-dashboard-sidebar-footer">
              <label className="admin-dashboard-language" title={tr("Language", "Lingua")}>
                <Languages className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{tr("Language", "Lingua")}</span>
                <select aria-label={tr("Language", "Lingua")} value={locale} onChange={(event) => setLocale(event.target.value as AppLocale)}>
                  {APP_LOCALES.map((supportedLocale) => <option key={supportedLocale} value={supportedLocale}>{APP_LOCALE_LABELS[supportedLocale]}</option>)}
                </select>
              </label>
              <button className="admin-dashboard-footer-action" onClick={handleLogout} title={tr("Sign out", "Esci")} type="button">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{tr("Sign out", "Esci")}</span>
              </button>
              <a aria-label={tr("Back to site", "Torna al sito")} className="admin-dashboard-footer-action" href={publicPageHref} title={tr("Back to site", "Torna al sito")}>
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                <span>{tr("Back to site", "Torna al sito")}</span>
              </a>
            </div>
          </div>
        </aside>
      )}

      <div className={isHostedAdmin ? "admin-app-shell" : "admin-dashboard-main"}>
        {isHostedAdmin && !isIntegratedHostedAdmin ? <header className="admin-topbar">
          <div className="admin-heading min-w-0">
            <OrbitPageBrand showName={false} size="md" />
            <div className="min-w-0">
              <div className="admin-title-row">
                <h1 className="admin-title">OrbitPage <span>Admin</span></h1>
                {appVersion && <span className="admin-version" title={tr("Embedded OrbitPage OSS runtime version", "Versione del runtime OrbitPage OSS incorporato")}>OSS v{appVersion}</span>}
                {saasPlan && (isProspectReadOnly
                  ? <span className="admin-plan-badge" title={tr("Demo plan", "Piano demo")}>{saasPlan.name}</span>
                  : <a className="admin-plan-badge" href={managePlanHref} target="_top" title={tr("Manage plan", "Gestisci piano")}>{saasPlan.name}</a>
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
            {!isProspectReadOnly && (
              <Button
                className="admin-action"
                variant="outline"
                size="sm"
                onClick={() => setOnboardingReplayKey(key => key + 1)}
              >
                <HelpCircle className="h-4 w-4" />
                {tr("Guide", "Guida")}
              </Button>
            )}
          </div>
        </header> : !isHostedAdmin ? <header className="admin-dashboard-header">
          <div className="admin-dashboard-header-copy">
            <p className="admin-dashboard-kicker">{tr("Open Source plan", "Piano Open Source")}</p>
            <div className="admin-dashboard-heading-row"><h1>{tabLabel(activeTab)}</h1></div>
            <p className="admin-dashboard-section-description">{tabDescription(activeTab)}</p>
            <div className="admin-dashboard-context-row" aria-label={tr("Workspace context", "Contesto workspace")}>
              <span className="admin-dashboard-context-slug">/{currentUser?.username || "admin"}</span>
              <span>{tr("Owner", "Proprietario")}</span>
              <span className="admin-dashboard-page-state"><i aria-hidden="true" />{tr("Self-hosted", "Self-hosted")}</span>
            </div>
          </div>
          <div className="admin-dashboard-header-actions">
            <a className="admin-dashboard-public-page" href={publicPageHref} target="_blank" rel="noopener noreferrer" data-onboarding="public-page">
              <ExternalLink aria-hidden="true" size={17} />
              {tr("Public page", "Pagina pubblica")}
            </a>
            {!isProspectReadOnly && <SelfHostedAiAgent onApplied={onAiApplied} />}
          </div>
        </header> : null}

        {isProspectReadOnly && (
          <section className="admin-readonly-banner" role="status">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            <div>
              <strong>{tr("Prospect demo account", "Account demo prospect")}</strong>
              <span>{tr("Read-only access. Explore the workspace and its public page; changes, uploads, restores and publishing are disabled.", "Accesso in sola lettura. Puoi esplorare il workspace e la pagina pubblica; modifiche, upload, ripristini e pubblicazione sono disabilitati.")}</span>
            </div>
          </section>
        )}

        <section className="admin-metrics admin-metrics-saas" aria-label={tr("Workspace status", "Stato del workspace")}>
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
        </section>

        <Tabs value={activeTab} onValueChange={(value) => selectTab(value as AdminTab)} className={isHostedAdmin && !isIntegratedHostedAdmin ? "mt-5 flex-1" : isIntegratedHostedAdmin ? "admin-integrated-tabs flex-1" : "admin-dashboard-tabs flex-1"}>
          {isHostedAdmin && !isIntegratedHostedAdmin && <div className="admin-nav-shell">
            <TabsList className="admin-tabs">
              {visibleTabs.map(({ value, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="admin-tab" data-onboarding={`${value}-tab`}>
                  <Icon className="h-4 w-4" />
                  <span>{tabLabel(value)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>}

          <div
            className={isProspectReadOnly && activeTab !== "analytics" ? "admin-tab-stage admin-readonly-stage" : "admin-tab-stage"}
            inert={isProspectReadOnly && activeTab !== "analytics" ? "" : undefined}
          >
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
                  orbitPageBadgeEditable={orbitPageBadgeEditable}
                  onStartOnboarding={() => setOnboardingReplayKey(key => key + 1)}
                  onAdminOnboardingEnabledChange={(enabled) => {
                    void onProfileUpdate({ ...profile, adminOnboardingEnabled: enabled });
                  }}
                />
              </div>
              {(showEmbeddedPreview || (checklistSession.visible && !isProspectReadOnly)) && <aside className="admin-workbench-rail">
                {showEmbeddedPreview && <PreviewPanel
                    title={tr("Profile and identity", "Profilo e identità")}
                    profile={previewProfile}
                    links={links}
                    theme={theme}
                    publicPageHref={publicPageHref}
                    showOrbitPageBadge={resolveOrbitPageBadgeVisibility(previewProfile.showOrbitPageBadge)}
                  />}
                {checklistSession.visible && !isProspectReadOnly && (
                  <section className="admin-side-panel admin-checklist-panel" aria-label={tr("Page checklist", "Verifica pagina")}>
                    <div className="admin-checklist-heading">
                      <span className="admin-panel-icon"><User className="h-4 w-4" /></span>
                      <div>
                        <h2>{tr("Page checklist", "Verifica pagina")}</h2>
                        <p>{tr(
                          `Getting started · login ${checklistSession.sessionNumber} of ${checklistSession.sessionLimit}`,
                          `Primi passi · accesso ${checklistSession.sessionNumber} di ${checklistSession.sessionLimit}`,
                        )}</p>
                      </div>
                      <button type="button" onClick={dismissPageChecklist} aria-label={tr("Hide onboarding checklist", "Nascondi checklist iniziale")} title={tr("Do not show again", "Non mostrare più")}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="admin-checklist-progress-copy">
                      <span>{tr("Setup progress", "Avanzamento configurazione")}</span>
                      <strong>{completedChecklistItems}/{pageChecklistItems.length}</strong>
                    </div>
                    <div className="admin-checklist-progress" role="progressbar" aria-valuemin={0} aria-valuemax={pageChecklistItems.length} aria-valuenow={completedChecklistItems}>
                      <span style={{ width: `${(completedChecklistItems / pageChecklistItems.length) * 100}%` }} />
                    </div>
                    <div className="admin-checklist-items">
                      {pageChecklistItems.map((item) => <ChecklistItem key={item.label} {...item} />)}
                    </div>
                    <p className="admin-checklist-expiry">{tr("This panel disappears automatically after your first three login sessions.", "Questo pannello scompare automaticamente dopo le prime tre sessioni di accesso.")}</p>
                  </section>
                )}
              </aside>}
            </div>
          </TabsContent>

          <TabsContent value="content" className="admin-tab-content">
            <section className="content-workspace" aria-labelledby="content-workspace-title">
              <header className="content-workspace-header">
                <div>
                  <p className="admin-dashboard-kicker">{tr("Page structure", "Struttura pagina")}</p>
                  <h2 id="content-workspace-title">{tr("Choose what your OrbitPage contains", "Scegli cosa contiene la tua OrbitPage")}</h2>
                  <p>{tr("Choose one active destination as the homepage. Keep the others available only when they are useful.", "Scegli una destinazione attiva come homepage. Mantieni disponibili le altre solo quando servono.")}</p>
                </div>
              </header>

              <div className="content-workspace-switcher with-shop" role="list" aria-label={tr("Content destinations", "Destinazioni contenuto")}>
                {contentDestinationCards.map(({ description, enabled, icon: Icon, id, label, locked }) => {
                  const isHomepage = contentRouting.homepage === id;
                  const isBusy = contentAction?.endsWith(`:${id}`) === true;
                  const canToggle = !locked
                    && !isHomepage
                    && (id === "pages" ? linkEditMode !== "view" : id === "shop" ? !isProspectReadOnly : canEditMenu);
                  return (
                    <article
                      className={`content-workspace-option${contentSection === id ? " active" : ""}${locked ? " content-workspace-option-locked" : ""}`}
                      key={id}
                      role="listitem"
                    >
                      <button
                        aria-current={contentSection === id ? "page" : undefined}
                        className="content-workspace-option-main"
                        data-onboarding={id === "link" ? "links-tab" : undefined}
                        disabled={locked}
                        onClick={() => selectContentSection(id)}
                        type="button"
                      >
                        <span className="content-workspace-option-icon"><Icon aria-hidden="true" /></span>
                        <span className="content-workspace-option-copy"><strong>{label}</strong><small>{description}</small></span>
                        <em className={enabled ? "content-status content-status-live" : "content-status content-status-offline"}>
                          <i aria-hidden="true" />
                          {locked ? "SaaS" : enabled ? tr("Active", "Attiva") : tr("Inactive", "Disattivata")}
                        </em>
                      </button>
                      <div className="content-workspace-option-actions">
                        <button
                          aria-pressed={isHomepage}
                          className={isHomepage ? "content-homepage-action is-homepage" : "content-homepage-action"}
                          disabled={locked || !enabled || Boolean(contentAction) || !canEditMenu}
                          onClick={() => void makeContentHomepage(id)}
                          title={!enabled ? tr("Activate the destination before making it the homepage.", "Attiva la destinazione prima di renderla la homepage.") : undefined}
                          type="button"
                        >
                          <Home aria-hidden="true" />
                          {isHomepage ? tr("Homepage", "Homepage") : tr("Make homepage", "Rendi homepage")}
                        </button>
                        <button
                          aria-pressed={enabled}
                          className="content-toggle-action"
                          disabled={!canToggle || Boolean(contentAction)}
                          onClick={() => void toggleContentDestination(id)}
                          title={isHomepage ? tr("Choose another homepage before deactivating this destination.", "Scegli un'altra homepage prima di disattivare questa destinazione.") : undefined}
                          type="button"
                        >
                          {isBusy ? <OrbitLoader size={14} state="connecting" /> : <Power aria-hidden="true" />}
                          {enabled ? tr("Deactivate", "Disattiva") : tr("Activate", "Attiva")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {contentWorkspaceError && <p className="content-workspace-error" role="alert">{contentWorkspaceError}</p>}

              {contentSection === "link" && (
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
                      availablePages={subpages.filter((page) => page.enabled).map((page) => ({
                        title: page.title || page.slug,
                        url: `${publicPageHref.replace(/\/$/, "")}/${page.slug}`,
                      }))}
                    />
                  </div>
                  {showEmbeddedPreview && <aside className="admin-workbench-rail">
                    <PreviewPanel
                      title={tr("Home blocks and composition", "Blocchi e composizione della home")}
                      profile={profile}
                      links={previewLinks}
                      theme={theme}
                      publicPageHref={publicPageHref}
                      showOrbitPageBadge={resolveOrbitPageBadgeVisibility(profile.showOrbitPageBadge)}
                    />
                  </aside>}
                </div>
              )}

              {contentSection === "menu" && (
                <div className="admin-menu-content-layout">
                  <div className="admin-main-column content-workspace-section">
                    <MenuEditor
                      menu={menu}
                      publicPageHref={publicPageHref}
                      enabled={!saasPlan || entitlements?.nativeMenu === true}
                      maxItems={entitlements?.maxMenuItems ?? null}
                      planName={saasPlan?.name}
                      advancedTheme={!saasPlan || entitlements?.themes === "advanced"}
                      onSave={onMenuUpdate}
                      onAddMenuLink={async () => {
                        const menuLink = createNativeMenuLink(publicPageHref, {
                          title: tr('View menu', 'Vedi il menu'),
                          description: tr('Browse food and drinks', 'Scopri piatti e bevande'),
                        });
                        const exists = links.some(isNativeMenuLink);
                        await onLinksUpdate(upsertNativeMenuLink(links, menuLink, exists ? 'append' : 'prepend'));
                      }}
                    />
                  </div>
                </div>
              )}

              {contentSection === "pages" && (
                <SubpageManager
                  pages={subpages}
                  theme={theme}
                  publicPageHref={publicPageHref}
                  onPagesUpdate={onSubpagesUpdate}
                  editMode={linkEditMode}
                  maxPages={entitlements?.pages}
                  maxBlocks={entitlements?.maxBlocks}
                  planName={saasPlan?.name}
                  schedulingEnabled={entitlements?.scheduling ?? true}
                  videoUploadsEnabled={entitlements?.videoUploads ?? true}
                  maxVideoUploadBytes={entitlements?.maxVideoUploadBytes}
                  managePlanHref={managePlanHref}
                  renderPreview={showEmbeddedPreview ? ((page, pageLinks) => (
                    <PreviewPanel
                      title={tr("Subpage preview", "Anteprima sottopagina")}
                      profile={{ ...profile, name: page.title, bio: page.description }}
                      links={pageLinks}
                      theme={theme}
                      publicPageHref={`${publicPageHref.replace(/\/$/, "")}/${page.slug}`}
                      showOrbitPageBadge={resolveOrbitPageBadgeVisibility(profile.showOrbitPageBadge)}
                    />
                  )) : undefined}
                />
              )}

              {contentSection === "shop" && (
                <div className="hosted-shop-slot" data-orbitpage-hosted-shop-slot />
              )}
            </section>
          </TabsContent>

          {!isHostedAdmin && (
            <TabsContent value="ai" className="admin-tab-content">
              <SelfHostedAiPanel
                canManageSettings={canManageUsers}
                onApplied={onAiApplied}
              />
            </TabsContent>
          )}

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
                  showOrbitPageBadge={resolveOrbitPageBadgeVisibility(profile.showOrbitPageBadge)}
                />
              )}
              accessLevel={entitlements?.themes}
              videoUploadsEnabled={entitlements?.videoUploads ?? true}
              maxUploadBytes={entitlements?.maxUploadBytes}
              maxVideoUploadBytes={entitlements?.maxVideoUploadBytes}
              managePlanHref={managePlanHref}
              showEmbeddedPreview
            />
          </TabsContent>

          <TabsContent value="publish" className="admin-tab-content">
            <PublishTools
              menuEnabled={menu.enabled}
              readOnly={DEMO_MODE}
              canUseQr={canEditProfile}
              canUseDiscovery={canEditCompliance}
            />
          </TabsContent>

          {!isHostedAdmin && canManageUsers && (
            <TabsContent value="team" className="admin-tab-content">
              <div className="admin-single-column space-y-6" data-onboarding="team-section">
                <UserManager />
              </div>
            </TabsContent>
          )}

          {!isHostedAdmin && (
            <TabsContent value="newsletter" className="admin-tab-content">
              <section className="oss-hosted-feature" aria-labelledby="oss-newsletter-title">
                <span className="oss-hosted-feature-mark"><Mail aria-hidden="true" /></span>
                <div>
                  <p className="admin-dashboard-kicker">Newsletter</p>
                  <h2 id="oss-newsletter-title">{tr("Managed campaigns in OrbitPage SaaS", "Campagne gestite in OrbitPage SaaS")}</h2>
                  <p>{tr("The navigation stays identical across editions. Managed delivery, subscribers and scheduling are available in the hosted service.", "La navigazione resta identica tra le edizioni. Invio gestito, iscritti e programmazione sono disponibili nel servizio hosted.")}</p>
                </div>
                <a href="https://orbitpage.com/pricing" target="_blank" rel="noopener noreferrer">{tr("View SaaS plans", "Vedi i piani SaaS")}<ExternalLink aria-hidden="true" /></a>
              </section>
            </TabsContent>
          )}

          {!isHostedAdmin && (
            <TabsContent value="account" className="admin-tab-content">
              <div className="oss-account-layout" data-onboarding="account-section">
                <PasswordManager />
                <TwoFactorManager username={currentUser?.username} />
              </div>
            </TabsContent>
          )}

          {canManageUsers && (
            <TabsContent value="backup" className="admin-tab-content">
              <div className={`admin-backup-workspace${isHostedAdmin ? " admin-backup-workspace--managed" : ""}`} data-onboarding="backup-section">
                {isHostedAdmin && <VersionHistory />}
                <BackupManager hosted={isHostedAdmin} />
              </div>
            </TabsContent>
          )}

          {!isHostedAdmin && (
            <TabsContent value="plan" className="admin-tab-content">
              <OpenSourcePlan />
            </TabsContent>
          )}

          <TabsContent value="analytics" className="admin-tab-content">
            <div className="admin-analytics-grid">
              {isHostedAdmin ? <ManagedAnalyticsDashboard /> : (
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
              )}
              {googleAnalyticsPanel}
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="admin-tab-content">
            <div data-onboarding="privacy-section">
              <PrivacySettings
                pageName={profile.name}
                cmpSiteUrl={publicPageHref}
                privacyPolicyUrl={profile.privacyPolicyUrl}
                cookiePolicyUrl={profile.cookiePolicyUrl}
                readOnly={DEMO_MODE}
                onLegalPolicyUpdate={({ privacyPolicyUrl, cookiePolicyUrl }) =>
                  onProfileUpdate({ ...profile, privacyPolicyUrl, cookiePolicyUrl })
                }
              />
            </div>
          </TabsContent>

          </div>
        </Tabs>

        {!isProspectReadOnly && <AdminOnboarding
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
        />}

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
  publicPageHref,
  showOrbitPageBadge,
}: {
  title: string;
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
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
    <div className={checked ? "admin-checklist-item admin-checklist-item-complete" : "admin-checklist-item"}>
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



