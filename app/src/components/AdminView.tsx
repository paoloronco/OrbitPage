import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileSection } from "./ProfileSection";
import { LinkManager } from "./LinkManager";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { MenuEditor } from "./MenuEditor";
import { LinkData } from "./LinkCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrbitLoader } from "@/components/ui/orbit-loader";
import { CurrentUser } from "@/pages/Admin";
import { Permission, hasPermission, hasAnyPermission, getLinkEditMode } from "@/lib/permissions";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  CircleUserRound,
  Cookie,
  CreditCard,
  Database,
  ExternalLink,
  Globe2,
  HelpCircle,
  Languages,
  LockKeyhole,
  LogOut,
  Mail,
  Menu as MenuIcon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  Sparkles,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "@/components/ui/material-icons";
import { logout } from "@/lib/auth";
import { ThemeConfig, applyTheme } from "@/lib/theme";
import { PasswordManager } from "./PasswordManager";
import { UserManager } from "./UserManager";
import { PersonalApiTokens } from "./PersonalApiTokens";
import { OrbitPageBrand } from "./OrbitPageBrand";
import { PrivacySettings } from "./PrivacySettings";
import { BackupManager } from "./BackupManager";
import { TwoFactorManager } from "./TwoFactorManager";
import { LivePreview, PreviewDeviceFrame } from "./LivePreview";
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
import type { ProfileLayout, ProfileLayoutViewport } from "@/lib/profile-layout";
import type { CardLayout } from "@/lib/card-layout";
import type { HostedEditorBilling, HostedEditorPlan, HostedEditorUsage } from "@/lib/hosted-editor-contract";
import { canonicalAdminTab, type AdminContentSection, type AdminEditorSection, type AdminTab } from "@/lib/admin-navigation";
import { DEFAULT_CONTENT_ROUTING, createDefaultMenu, type ContentDestination, type ContentRouting, type MenuCatalog } from "@/lib/menu";
import type { InternalDestinationOption } from "@/lib/link-blocks";
import { APP_LOCALES, APP_LOCALE_LABELS, useAppI18n, type AppLocale } from "@/lib/i18n";
import { ManagedAnalyticsDashboard } from "./ManagedAnalyticsDashboard";
import NewsletterWorkspace from "./NewsletterWorkspace";
import { VersionHistory } from "./VersionHistory";
import { SubpageManager, type EditorSubpage } from "./SubpageManager";
import { PublishTools } from "./PublishTools";
import { SelfHostedAiPanel } from "./SelfHostedAiPanel";
import { SelfHostedAiAgent } from "./SelfHostedAiAgent";
import { SelfHostedAccountActions } from "./SelfHostedAccountActions";
import { OpenSourcePlan } from "./OpenSourcePlan";
import { VisualSiteEditor, type VisualSiteEditorSection } from "./VisualSiteEditor";
import { MenuView } from "./MenuView";

function GoogleAnalyticsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 24 24" width={size}>
      <circle cx="4.75" cy="20.25" fill="#e37400" r="2.75" />
      <rect fill="#e37400" height="13.75" rx="2.75" width="5.5" x="9.25" y="9.25" />
      <rect fill="#f9ab00" height="22" rx="2.75" width="5.5" x="16.5" y="1" />
    </svg>
  );
}

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
  machineReadableEnabled?: boolean;
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
  requestedEditorSection?: AdminEditorSection | null;
  onTabChange?: (tab: AdminTab) => void;
  onContentSectionChange?: (section: AdminContentSection) => void;
  onEditorSectionChange?: (section: AdminEditorSection) => void;
}

const pageTabs: Array<{ value: AdminTab; icon: React.ElementType; iconName: string }> = [
  { value: "profile", icon: UserRound, iconName: "person-outline" },
  { value: "ai", icon: Sparkles, iconName: "auto-awesome-outlined" },
  { value: "theme", icon: Palette, iconName: "palette-outlined" },
  { value: "publish", icon: Share2, iconName: "share-outlined" },
  { value: "backup", icon: Database, iconName: "storage-outlined" },
  { value: "analytics", icon: BarChart3, iconName: "bar-chart-outlined" },
  { value: "privacy", icon: Cookie, iconName: "cookie-outlined" },
];

const workspaceTabs: Array<{ value: AdminTab; icon: React.ElementType; iconName: string }> = [
  { value: "newsletter", icon: Mail, iconName: "mail-outline" },
  { value: "team", icon: UsersRound, iconName: "group-outlined" },
  { value: "account", icon: CircleUserRound, iconName: "account-circle-outlined" },
  { value: "plan", icon: CreditCard, iconName: "credit-card-outlined" },
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

function visualSectionForContent(section: ContentDestination): VisualSiteEditorSection {
  if (section === "link") return "links";
  return section;
}

const SELF_HOSTED_SIDEBAR_STORAGE_KEY = "orbitpage.admin.sidebar-collapsed";
const EMBEDDED_PREVIEW_MEDIA_QUERY = "(min-width: 1121px)";
const DOCKER_MIGRATION_GUIDE = "https://github.com/paoloronco/OrbitPage/blob/main/docs/wiki/Docker-Hub-migration.md";
type AccountView = "general" | "security";

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
  requestedEditorSection = null,
  onTabChange,
  onContentSectionChange,
  onEditorSectionChange,
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
    theme: tr("Adjust colors, type, background and card styles.", "Regola colori, caratteri, sfondo e stile delle card."),
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
    analytics: tr("Read the signals behind visits and interactions.", "Controlla visite, clic e sorgenti di traffico."),
    privacy: tr("Manage consent, policies and visitor choices.", "Gestisci consenso, informative e scelte dei visitatori."),
  })[tab];
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__);
  const [distributionImage, setDistributionImage] = useState("");
  const [gaId, setGaId] = useState<string>(profile.googleAnalyticsId || "");
  const [gaSaved, setGaSaved] = useState(false);
  const [gaSaving, setGaSaving] = useState(false);
  const [gaSetupOpen, setGaSetupOpen] = useState(false);
  const [accountView, setAccountView] = useState<AccountView>("general");
  const [activeTab, setActiveTab] = useState<AdminTab>("profile");
  const [contentSection, setContentSection] = useState<ContentDestination>(() => (
    getHostedSurfaceConfig()?.contentSection
      || (getHostedSurfaceConfig()?.extensions?.shop?.selected ? "shop" : null)
      || requestedContentSection
      || contentSectionForTab(requestedTab)
      || "link"
  ));
  const [hostedSurfaceConfig, setHostedSurfaceConfig] = useState<HostedSurfaceConfig | null>(() => getHostedSurfaceConfig());
  const [didPickInitialTab, setDidPickInitialTab] = useState(false);
  const [previewProfile, setPreviewProfile] = useState(profile);
  const [previewLinks, setPreviewLinks] = useState(links);
  const [previewTheme, setPreviewTheme] = useState(theme);
  const [previewMenu, setPreviewMenu] = useState(menu);
  const [previewSubpage, setPreviewSubpage] = useState<{ page: EditorSubpage; links: LinkData[] } | null>(null);
  const onSubpagePreviewChange = useCallback((preview: { page: EditorSubpage; links: LinkData[] } | null) => setPreviewSubpage(preview), []);
  const [visualSection, setVisualSection] = useState<VisualSiteEditorSection>(() => {
    const config = getHostedSurfaceConfig();
    if (config?.extensions?.shop?.selected) return "shop";
    if (requestedEditorSection) return requestedEditorSection === "profile" ? "profile" : visualSectionForContent(requestedEditorSection);
    const requestedContent = canonicalViewTab(config?.section || requestedTab) === "content"
      ? config?.contentSection || requestedContentSection || contentSectionForTab(requestedTab) || "link"
      : null;
    return requestedContent ? visualSectionForContent(requestedContent) : "profile";
  });
  const [visualLinkId, setVisualLinkId] = useState<string | null>(null);
  const [visualEditRequest, setVisualEditRequest] = useState(0);
  const [visualProfileLayoutCommand, setVisualProfileLayoutCommand] = useState<{ id: number; layout: ProfileLayout; viewport: ProfileLayoutViewport } | null>(null);
  const [visualCardLayoutCommand, setVisualCardLayoutCommand] = useState<{ id: number; layout: CardLayout | null; viewport: ProfileLayoutViewport } | null>(null);
  const [visualLayoutEditing, setVisualLayoutEditing] = useState(false);
  const [showEmbeddedPreview, setShowEmbeddedPreview] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia(EMBEDDED_PREVIEW_MEDIA_QUERY).matches;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SELF_HOSTED_SIDEBAR_STORAGE_KEY) === "true";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const publicUrlOverride = getPublicUrlOverride();
  const [publicPageHref, setPublicPageHref] = useState(publicUrlOverride || withBasePath('/'));
  const [publicPageSlug, setPublicPageSlug] = useState<string | null>(null);
  const entitlements = saasPlan?.entitlements;
  const managePlanHref = saasBilling?.manageUrl || "/dashboard/billing";
  const isHostedAdmin = isSaasMode() || Boolean(
    saasPlan ||
    saasUsage ||
    saasBilling
  );
  const isIntegratedHostedAdmin = isHostedAdmin && isIntegratedHostedSurface();
  const hostedShop = isIntegratedHostedAdmin ? hostedSurfaceConfig?.extensions?.shop : undefined;
  const hostedPanelTabs = isIntegratedHostedAdmin ? hostedSurfaceConfig?.extensions?.panels || [] : [];
  const usesDashboardShell = !isHostedAdmin || isIntegratedHostedAdmin;
  const dashboardSlug = hostedSurfaceConfig?.publicSlug || publicPageSlug || currentUser?.username || "admin";
  const isProspectReadOnly = currentUser?.readOnly === true;
  const orbitPageBadgeEditable = isHostedAdmin && entitlements?.badgeRequired !== true && !isProspectReadOnly;
  const resolveOrbitPageBadgeVisibility = (preference: boolean | undefined) => (
    orbitPageBadgeEditable ? (preference ?? !saasPlan) : true
  );
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
      if (nextConfig?.extensions?.shop?.selected) {
        setVisualSection("shop");
      } else if (nextConfig && canonicalViewTab(nextConfig.section) === "content" && nextConfig.contentSection) {
        setVisualSection(visualSectionForContent(nextConfig.contentSection));
      } else if (nextConfig?.section === "profile") {
        setVisualSection("profile");
      }
    };
    window.addEventListener(HOSTED_CONFIG_CHANGED_EVENT, syncHostedConfig);
    syncHostedConfig();
    return () => window.removeEventListener(HOSTED_CONFIG_CHANGED_EVENT, syncHostedConfig);
  }, [isIntegratedHostedAdmin]);

  const selectContentSection = (section: ContentDestination) => {
    setContentSection(section);
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
    if (publicUrlOverride) {
      setPublicPageHref(publicUrlOverride);
      return;
    }
    if (isHostedAdmin) return;

    let cancelled = false;
    void publicUrlApi.get(locale)
      .then((response) => {
        if (!cancelled && response.publicUrl) {
          setPublicPageHref(response.publicUrl);
          setPublicPageSlug(response.slug);
        }
      })
      .catch(() => {
        if (!cancelled) setPublicPageHref(withBasePath('/'));
      });
    return () => {
      cancelled = true;
    };
  }, [isHostedAdmin, locale, publicUrlOverride]);

  useEffect(() => {
    setPreviewProfile(profile);
  }, [profile]);

  useEffect(() => {
    setPreviewLinks(links);
  }, [links]);

  useEffect(() => {
    setPreviewTheme(theme);
  }, [theme]);

  useEffect(() => {
    setPreviewMenu(menu);
  }, [menu]);

  useEffect(() => {
    if (!visualLinkId || previewLinks.some((link) => String(link.id) === String(visualLinkId))) return;
    setVisualLinkId(null);
  }, [previewLinks, visualLinkId]);

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
  useEffect(() => {
    if (!isIntegratedHostedAdmin) return;
    getHostedSurfaceConfig()?.onContentRoutingChange?.(contentRouting);
  }, [contentRouting, isIntegratedHostedAdmin]);

  const internalDestinations: InternalDestinationOption[] = [
    ...(contentRouting.linkEnabled ? [{
      id: "home",
      kind: "link" as const,
      path: "/",
      title: tr("Home", "Home"),
      description: tr("Main page", "Pagina principale"),
    }] : []),
    ...(menu.enabled ? [{
      id: "menu",
      kind: "menu" as const,
      path: "/menu",
      title: tr("Menu", "Menu"),
      description: menu.description || tr("Browse food and drinks", "Scopri piatti e bevande"),
    }] : []),
    ...(hostedShop?.enabled ? [{
      id: "shop",
      kind: "shop" as const,
      path: "/shop",
      title: tr("Shop", "Shop"),
      description: tr("Products, services and secure checkout", "Prodotti, servizi e checkout sicuro"),
    }] : []),
    ...subpages.filter((page) => page.enabled).map((page) => ({
      id: `page:${page.id}`,
      kind: "page" as const,
      path: `/${page.slug}`,
      title: page.title || page.slug,
      description: page.description || tr("Additional page", "Pagina aggiuntiva"),
    })),
  ];

  useEffect(() => {
    const loadVersion = async () => {
      try {
        const health = await utilityApi.getHealth();
        if (health.version) setAppVersion(health.version);
        if (health.distributionImage) setDistributionImage(health.distributionImage.replace(/^docker\.io\//, ""));
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
      case 'ai':        return hostedPanelTabs.includes('ai') || (!isHostedAdmin && (canEditProfile || canEditLinks || canEditTheme));
      case 'theme':     return canEditTheme;
      case 'publish':   return canEditProfile || canEditCompliance;
      case 'team':      return hostedPanelTabs.includes('team') || (!isHostedAdmin && canManageUsers);
      case 'newsletter': return hostedPanelTabs.includes('newsletter') || (!isHostedAdmin && canManageUsers);
      case 'account':   return hostedPanelTabs.includes('account') || !isHostedAdmin;
      case 'plan':      return hostedPanelTabs.includes('plan') || !isHostedAdmin;
      case 'access':    return false;
      case 'backup':    return canManageUsers;
      case 'analytics': return canViewAnalytics;
      case 'privacy':   return canEditCompliance;
      default:          return false;
    }
  });
  const visiblePageTabs = visibleTabs.filter((tab) => pageTabs.some((pageTab) => pageTab.value === tab.value));
  const visibleNavigationTabs = visibleTabs;
  const visibleWorkspaceTabs = visibleTabs.filter((tab) => workspaceTabs.some((workspaceTab) => workspaceTab.value === tab.value));
  const displayedTabLabel = (tab: AdminTab) => (
    tab === "profile"
      ? tr("Site editor", "Editor sito")
      : tabLabel(tab)
  );
  const displayedTabDescription = (tab: AdminTab) => (
    tab === "profile"
      ? tr("Edit identity and content directly on your real page.", "Modifica identità e contenuti direttamente sulla pagina reale.")
      : tabDescription(tab)
  );

  const selectTab = (tab: AdminTab) => {
    const requestedContentSection = contentSectionForTab(tab);
    if (requestedContentSection) setContentSection(requestedContentSection);
    const requestedCanonicalTab = canonicalViewTab(tab);
    const canonicalTab = requestedCanonicalTab === "content" ? "profile" : requestedCanonicalTab;
    setActiveTab(canonicalTab);
    setMobileNavOpen(false);
    if (canonicalTab === "profile" && !isIntegratedHostedAdmin) onEditorSectionChange?.("profile");
    else onTabChange?.(canonicalTab);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.querySelector<HTMLElement>(".admin-dashboard-main")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  const selectVisualSection = (section: VisualSiteEditorSection, linkId?: string) => {
    setVisualSection(section);
    if (isIntegratedHostedAdmin) {
      if (section === "profile") onTabChange?.("profile");
      else selectContentSection(section === "links" ? "link" : section);
    } else {
      onEditorSectionChange?.(section === "links" ? "link" : section);
    }
    if (section === "links") {
      setVisualLinkId(linkId || null);
      if (linkId) setVisualEditRequest((request) => request + 1);
    } else {
      setVisualLinkId(null);
    }
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
      const rawCanonicalRequestedTab = canonicalViewTab(requestedTab);
      const canonicalRequestedTab = rawCanonicalRequestedTab === "content" ? "profile" : rawCanonicalRequestedTab;
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
    const rawCanonicalRequestedTab = canonicalViewTab(requestedTab);
    const canonicalRequestedTab = rawCanonicalRequestedTab === "content" ? "profile" : rawCanonicalRequestedTab;
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

  const handleLogout = () => {
    if (isIntegratedHostedAdmin && hostedSurfaceConfig?.onSignOut) {
      hostedSurfaceConfig.onSignOut();
      return;
    }
    logout();
    onLogout();
  };

  useEffect(() => {
    if (!requestedEditorSection || isIntegratedHostedAdmin) return;
    setVisualSection(requestedEditorSection === "profile" ? "profile" : visualSectionForContent(requestedEditorSection));
    if (requestedEditorSection !== "profile") setContentSection(requestedEditorSection);
  }, [requestedEditorSection, isIntegratedHostedAdmin]);

  const updateVisualProfileLayout = (layout: ProfileLayout, viewport: ProfileLayoutViewport) => {
    setVisualProfileLayoutCommand((current) => ({ id: (current?.id || 0) + 1, layout, viewport }));
  };

  const updateVisualCardLayout = (layout: CardLayout | null, viewport: ProfileLayoutViewport) => {
    setVisualCardLayoutCommand((current) => ({ id: (current?.id || 0) + 1, layout, viewport }));
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

  const googleAnalyticsDialog = (
    <Dialog open={gaSetupOpen} onOpenChange={setGaSetupOpen}>
      <DialogContent className="managed-analytics-integration-dialog" data-testid="google-analytics-settings">
        <DialogHeader className="managed-analytics-integration-dialog-header">
          <span className="admin-panel-icon" aria-hidden="true"><GoogleAnalyticsIcon size={17} /></span>
          <div>
            <DialogTitle>Google Analytics 4</DialogTitle>
            <DialogDescription>{tr("Connect Google Analytics to your public page.", "Collega Google Analytics alla tua pagina pubblica.")}</DialogDescription>
          </div>
        </DialogHeader>
        {(!saasPlan || entitlements?.analytics === "advanced-ga4") ? (
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
        ) : (
          <PlanLockedFeature
            title="Google Analytics 4"
            description={tr("Connect a GA4 Measurement ID with the Pro plan.", "Collega un ID di misurazione GA4 con il piano Pro.")}
            managePlanHref={managePlanHref}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  const visualInspectorTitle = visualSection === "profile"
    ? tr("Profile and identity", "Profilo e identità")
    : visualSection === "links"
      ? tr("Content block", "Blocco contenuto")
      : visualSection === "menu"
        ? tr("Menu", "Menu")
        : visualSection === "shop"
          ? tr("Shop", "Shop")
          : tr("Additional pages", "Pagine aggiuntive");
  const visualInspectorDescription = visualSection === "profile"
    ? tr("Name, image, bio, social presence and page details.", "Nome, immagine, bio, presenza social e dettagli della pagina.")
    : visualSection === "links"
      ? `${links.length} ${tr("blocks", "blocchi")}`
      : visualSection === "menu"
        ? tr("Manage navigation, categories and menu items.", "Gestisci navigazione, categorie ed elementi del menu.")
        : visualSection === "shop"
          ? tr("Manage the storefront shown from your OrbitPage.", "Gestisci lo shop mostrato dalla tua OrbitPage.")
          : tr("Create and edit the other pages in your site.", "Crea e modifica le altre pagine del sito.");

  const visualInspector = visualSection === "profile" ? (
    <ProfileSection
      profile={profile}
      theme={previewTheme}
      onProfileUpdate={onProfileUpdate}
      onProfilePreview={setPreviewProfile}
      profileLayoutCommand={visualProfileLayoutCommand}
      cardLayoutCommand={visualCardLayoutCommand}
      onEditingComplete={() => setVisualLayoutEditing(false)}
      seoAccess={entitlements?.seo}
      managePlanHref={managePlanHref}
      orbitPageBadgeEditable={orbitPageBadgeEditable}
      pageTypeEditable={false}
      visualMode
    />
  ) : visualSection === "links" ? (
    <LinkManager
      links={links}
      theme={previewTheme}
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
        url: `/${page.slug}`,
      }))}
      internalDestinations={internalDestinations}
      visualMode
      visualFocusLinkId={visualLinkId}
      visualEditRequest={visualEditRequest}
      onVisualFocusChange={setVisualLinkId}
    />
  ) : visualSection === "menu" ? (
    <MenuEditor
      menu={menu}
      onPreview={setPreviewMenu}
      designPreview={<PreviewDeviceFrame device="mobile" publicPageHref={`${publicPageHref.replace(/\/$/, "")}/menu`}>
        <div className="admin-menu-live-preview">
          <MenuView menu={previewMenu} pageHref={publicPageHref} />
        </div>
      </PreviewDeviceFrame>}
      presentation="visual"
      enabled={!saasPlan || entitlements?.nativeMenu === true}
      maxItems={entitlements?.maxMenuItems ?? null}
      advancedTheme={!saasPlan || entitlements?.themes === "advanced"}
      onSave={onMenuUpdate}
    />
  ) : visualSection === "pages" ? (
    <SubpageManager
      pages={subpages}
      theme={previewTheme}
      publicPageHref={publicPageHref}
      onPagesUpdate={onSubpagesUpdate}
      onPreviewChange={onSubpagePreviewChange}
      editMode={linkEditMode}
      maxPages={entitlements?.pages}
      maxBlocks={entitlements?.maxBlocks}
      planName={saasPlan?.name}
      schedulingEnabled={entitlements?.scheduling ?? true}
      videoUploadsEnabled={entitlements?.videoUploads ?? true}
      maxVideoUploadBytes={entitlements?.maxVideoUploadBytes}
      managePlanHref={managePlanHref}
      internalDestinations={internalDestinations}
    />
  ) : (
    isIntegratedHostedAdmin && hostedShop?.entitled
      ? <div className="hosted-shop-slot" data-orbitpage-hosted-shop-slot />
      : <PlanLockedFeature
          title={isIntegratedHostedAdmin
            ? tr("Shop is included with Pro", "Lo Shop è incluso nel piano Pro")
            : tr("Shop is available on OrbitPage SaaS", "Shop è disponibile su OrbitPage SaaS")}
          description={isIntegratedHostedAdmin
            ? tr("Upgrade to Pro to connect Stripe and sell products and services from your page.", "Passa a Pro per collegare Stripe e vendere prodotti e servizi dalla tua pagina.")
            : tr("Connect Stripe and manage products from a hosted workspace.", "Collega Stripe e gestisci i prodotti da un workspace hosted.")}
          managePlanHref={managePlanHref}
        />
  );

  return (
    <div
      className={`orbitpage-admin min-h-screen${usesDashboardShell ? ` admin-dashboard-shell${sidebarCollapsed ? " admin-dashboard-collapsed" : ""}` : ""} admin-visual-editor-enabled`}
      data-orbitpage-workspace-ready={isIntegratedHostedAdmin ? "true" : undefined}
    >
      {usesDashboardShell && (
        <aside className="admin-dashboard-sidebar">
          <div className="admin-dashboard-logo-row">
            <button className="admin-dashboard-logo" onClick={() => selectTab("profile")} type="button">
              <OrbitPageBrand className="orbitpage-dashboard-brand" showName={false} size="md" />
              <div className="admin-dashboard-logo-copy orbitpage-dashboard-brand-copy">
                <strong>OrbitPage</strong>
                <small>/{dashboardSlug}</small>
              </div>
            </button>
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
            <a
              aria-label={tr("Public page", "Pagina pubblica")}
              className="admin-dashboard-mobile-public-page"
              href={publicPageHref}
              rel="noopener noreferrer"
              target="_blank"
              title={tr("Public page", "Pagina pubblica")}
            >
              <ExternalLink aria-hidden="true" size={16} />
              <span>{tr("Open", "Apri")}</span>
            </a>
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
                <strong>{displayedTabLabel(activeTab)}</strong>
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
              {visiblePageTabs.map(({ value, icon: Icon, iconName }) => (
                <button
                  aria-current={activeTab === value ? "page" : undefined}
                  className={activeTab === value ? "admin-dashboard-nav-item active" : "admin-dashboard-nav-item"}
                  data-onboarding={`${value}-tab`}
                  key={value}
                  onClick={() => selectTab(value)}
                  title={displayedTabLabel(value)}
                  type="button"
                >
                  <Icon className="admin-dashboard-nav-icon h-[18px] w-[18px]" data-dashboard-icon={iconName} aria-hidden="true" size={18} />
                  <span>{displayedTabLabel(value)}</span>
                </button>
              ))}
            </nav>

            {visibleWorkspaceTabs.length > 0 && (
              <nav className="admin-dashboard-nav admin-dashboard-nav-workspace" aria-label={tr("Workspace tools", "Strumenti workspace")}>
                {visibleWorkspaceTabs.map(({ value, icon: Icon, iconName }) => (
                  <button
                    aria-current={activeTab === value ? "page" : undefined}
                    className={activeTab === value ? "admin-dashboard-nav-item active" : "admin-dashboard-nav-item"}
                    data-onboarding={`${value}-tab`}
                    key={value}
                    onClick={() => selectTab(value)}
                    title={displayedTabLabel(value)}
                    type="button"
                  >
                    <Icon className="admin-dashboard-nav-icon h-[18px] w-[18px]" data-dashboard-icon={iconName} aria-hidden="true" size={18} />
                    <span>{displayedTabLabel(value)}</span>
                  </button>
                ))}
              </nav>
            )}

            <div className="admin-dashboard-sidebar-footer">
              <label className="admin-dashboard-language" title={tr("Language", "Lingua")}>
                <Languages aria-hidden="true" size={15} />
                <span className="sr-only">{tr("Language", "Lingua")}</span>
                <select aria-label={tr("Language", "Lingua")} value={locale} onChange={(event) => {
                  const nextLocale = event.target.value as AppLocale;
                  setLocale(nextLocale);
                  hostedSurfaceConfig?.onLocaleChange?.(nextLocale);
                }}>
                  {APP_LOCALES.map((supportedLocale) => <option key={supportedLocale} value={supportedLocale}>{APP_LOCALE_LABELS[supportedLocale]}</option>)}
                </select>
              </label>
              <button className="admin-dashboard-footer-action" onClick={handleLogout} title={tr("Sign out", "Esci")} type="button">
                <LogOut aria-hidden="true" size={16} />
                <span>{tr("Sign out", "Esci")}</span>
              </button>
              <a aria-label={tr("Back to site", "Torna al sito")} className="admin-dashboard-footer-action" href={hostedSurfaceConfig?.siteUrl || publicPageHref} title={tr("Back to site", "Torna al sito")}>
                <Globe2 aria-hidden="true" size={16} />
                <span>{tr("Back to site", "Torna al sito")}</span>
              </a>
            </div>
          </div>
        </aside>
      )}

      <div className={usesDashboardShell ? "admin-dashboard-main" : "admin-app-shell"}>
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
        </header> : usesDashboardShell ? <header className="admin-dashboard-header">
          <div className="admin-dashboard-header-copy">
            <div className="admin-dashboard-heading-row"><h1>{displayedTabLabel(activeTab)}</h1></div>
            <p className="admin-dashboard-section-description">{displayedTabDescription(activeTab)}</p>
            <div className="admin-dashboard-context-row" aria-label={tr("Workspace context", "Contesto workspace")}>
              <span className="admin-dashboard-context-slug">/{dashboardSlug}</span>
              <span>{hostedSurfaceConfig?.workspace?.roleLabel || tr("Owner", "Proprietario")}</span>
              <span className={`admin-dashboard-page-state${hostedSurfaceConfig?.workspace?.status ? ` admin-dashboard-page-state-${hostedSurfaceConfig.workspace.status}` : ""}`}><i aria-hidden="true" />{hostedSurfaceConfig?.workspace?.statusLabel || tr("Self-hosted", "Self-hosted")}</span>
            </div>
          </div>
          <div className="admin-dashboard-header-actions">
            <a className="admin-dashboard-public-page admin-dashboard-header-public-page" href={publicPageHref} target="_blank" rel="noopener noreferrer" data-onboarding="public-page">
              <ExternalLink aria-hidden="true" size={17} />
              {tr("Public page", "Pagina pubblica")}
            </a>
          </div>
        </header> : null}

        {!isHostedAdmin && distributionImage === "paueron/orbitpage" && (
          <section className="admin-docker-migration-banner" role="status">
            <AlertTriangle aria-hidden="true" size={19} />
            <div>
              <strong>{tr("Docker image moved", "Immagine Docker trasferita")}</strong>
              <span>{tr(
                "Switch to paoloronco/orbitpage before legacy updates stop on October 9, 2026.",
                "Passa a paoloronco/orbitpage prima che gli aggiornamenti legacy terminino il 9 ottobre 2026.",
              )}</span>
            </div>
            <a href={DOCKER_MIGRATION_GUIDE} rel="noopener noreferrer" target="_blank">
              {tr("Migration guide", "Guida alla migrazione")}
            </a>
          </section>
        )}

        {isProspectReadOnly && (
          <section className="admin-readonly-banner" role="status">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            <div>
              <strong>{tr("Prospect demo account", "Account demo prospect")}</strong>
              <span>{tr("Read-only access. Explore the workspace and its public page; changes, uploads, restores and publishing are disabled.", "Accesso in sola lettura. Puoi esplorare il workspace e la pagina pubblica; modifiche, upload, ripristini e pubblicazione sono disabilitati.")}</span>
            </div>
          </section>
        )}

        <Tabs value={activeTab} onValueChange={(value) => selectTab(value as AdminTab)} className={isHostedAdmin && !isIntegratedHostedAdmin ? "mt-5 flex-1" : "admin-dashboard-tabs flex-1"}>
          {isHostedAdmin && !isIntegratedHostedAdmin && <div className="admin-nav-shell">
            <TabsList className="admin-tabs">
              {visibleNavigationTabs.map(({ value, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="admin-tab" data-onboarding={`${value}-tab`}>
                  <Icon className="h-4 w-4" />
                  <span>{displayedTabLabel(value)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>}

          <div
            className={isProspectReadOnly && activeTab !== "analytics" ? "admin-tab-stage admin-readonly-stage" : "admin-tab-stage"}
            inert={isProspectReadOnly && activeTab !== "analytics" ? "" : undefined}
          >
          <TabsContent value="profile" className="admin-tab-content">
            <VisualSiteEditor
                profile={previewProfile}
                links={previewLinks}
                theme={previewTheme}
                publicPageHref={publicPageHref}
                showOrbitPageBadge={resolveOrbitPageBadgeVisibility(previewProfile.showOrbitPageBadge)}
                section={visualSection}
                selectedLinkId={visualLinkId}
                inspectorTitle={visualInspectorTitle}
                inspectorDescription={visualInspectorDescription}
                inspector={visualInspector}
                menuStatus={menu.enabled ? "active" : "inactive"}
                shopStatus={!isIntegratedHostedAdmin || !hostedShop?.entitled ? "locked" : hostedShop.enabled ? "active" : "inactive"}
                pagesStatus={firstEnabledSubpage ? "active" : "inactive"}
                onSelect={selectVisualSection}
                onProfileLayoutChange={canEditProfile ? updateVisualProfileLayout : undefined}
                onCardLayoutChange={canEditProfile ? updateVisualCardLayout : undefined}
                layoutEditing={visualLayoutEditing}
                onLayoutEditingChange={setVisualLayoutEditing}
                previewHint={visualSection === "pages" && previewSubpage
                  ? tr(`Preview: ${previewSubpage.page.title}`, `Anteprima: ${previewSubpage.page.title}`)
                  : undefined}
                renderPreview={visualSection === "pages" && previewSubpage ? ((device) => (
                  <LivePreview
                    device={device}
                    profile={{ ...previewProfile, name: previewSubpage.page.title, bio: previewSubpage.page.description }}
                    links={previewSubpage.links}
                    theme={previewTheme}
                    publicPageHref={`${publicPageHref.replace(/\/$/, "")}/${previewSubpage.page.slug}`}
                    showOrbitPageBadge={resolveOrbitPageBadgeVisibility(previewProfile.showOrbitPageBadge)}
                  />
                )) : undefined}
            />
          </TabsContent>

          {!isHostedAdmin && (
            <TabsContent value="ai" className="admin-tab-content">
              <SelfHostedAiPanel
                canManageSettings={canManageUsers}
                historyKey={currentUser?.username}
                onApplied={onAiApplied}
              />
            </TabsContent>
          )}

          <TabsContent value="theme" className="admin-tab-content">
            <ThemeCustomizer
              theme={theme}
              onThemeChange={onThemeChange}
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
              menu={menu}
              subpages={subpages}
              readOnly={DEMO_MODE}
              canUseQr={canEditProfile}
              canUseDiscovery={canEditCompliance}
            />
          </TabsContent>

          {!isHostedAdmin && canManageUsers && (
            <TabsContent value="team" className="admin-tab-content">
              <div className="team-workspace" data-onboarding="team-section">
                <UserManager currentUsername={currentUser?.username} />
                <PersonalApiTokens />
              </div>
            </TabsContent>
          )}

          {!isHostedAdmin && canManageUsers && (
            <TabsContent value="newsletter" className="admin-tab-content">
              <NewsletterWorkspace user={{ uid: currentUser?.username || 'admin' }} />
            </TabsContent>
          )}

          {!isHostedAdmin && (
            <TabsContent value="account" className="admin-tab-content">
              <div className="oss-account-layout account-layout account-workspace" data-onboarding="account-section">
                <nav aria-label={tr("Account sections", "Sezioni account")} className="account-tabs">
                  <button aria-current={accountView === "general" ? "page" : undefined} className={accountView === "general" ? "active" : ""} onClick={() => setAccountView("general")} type="button"><CircleUserRound aria-hidden="true" />{tr("General", "Generale")}</button>
                  <button aria-current={accountView === "security" ? "page" : undefined} className={accountView === "security" ? "active" : ""} onClick={() => setAccountView("security")} type="button"><ShieldCheck aria-hidden="true" />{tr("Security", "Sicurezza")}</button>
                </nav>
                {accountView === "general" ? (
                  <SelfHostedAccountActions
                    canDeleteInstallation={canManageUsers}
                    publicPageHref={publicPageHref}
                    role={currentUser?.role || "-"}
                    username={currentUser?.username || "admin"}
                  />
                ) : (
                  <div className="account-security-stack">
                    <PasswordManager />
                    <TwoFactorManager username={currentUser?.username} />
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {canManageUsers && (
            <TabsContent value="backup" className="admin-tab-content">
              <div className="admin-backup-workspace admin-backup-workspace--managed" data-onboarding="backup-section">
                <VersionHistory />
                <BackupManager hosted={isHostedAdmin} />
              </div>
            </TabsContent>
          )}

          {!isHostedAdmin && (
            <TabsContent value="plan" className="admin-tab-content">
              <OpenSourcePlan />
            </TabsContent>
          )}

          {isIntegratedHostedAdmin && hostedPanelTabs.map((tab) => (
            <TabsContent value={tab} className="admin-tab-content" key={tab}>
              <div data-orbitpage-hosted-panel-slot={tab} />
            </TabsContent>
          ))}

          <TabsContent value="analytics" className="admin-tab-content">
            <div className="admin-analytics-grid">
              <ManagedAnalyticsDashboard headerAction={(
                <Button
                  className="admin-action"
                  data-testid="google-analytics-settings-trigger"
                  onClick={() => setGaSetupOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <GoogleAnalyticsIcon size={16} />
                  Google Analytics
                </Button>
              )} />
              {googleAnalyticsDialog}
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
          {!isHostedAdmin && (
            <p>
              {tr("Powered by", "Realizzato con")}{" "}
              <a href="https://github.com/paoloronco/OrbitPage" target="_blank" rel="noopener noreferrer">
                OrbitPage
              </a>
              {appVersion && <span> OSS v{appVersion}</span>}
            </p>
          )}
        </footer>
      </div>
      {!isHostedAdmin && !isProspectReadOnly && activeTab !== "ai" && <SelfHostedAiAgent historyKey={currentUser?.username} onApplied={onAiApplied} />}
    </div>
  );
};

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



