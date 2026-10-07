import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseLocalizedPublicPath } from "@/lib/public-routing";
import { AdminView } from "@/components/AdminView";
import { LoginForm } from "@/components/LoginForm";
import { InitialSetup } from "@/components/InitialSetup";
import { OrbitPageBrand } from "@/components/OrbitPageBrand";
import { OrbitLoadingState } from "@/components/ui/orbit-loader";
import { LinkData } from "@/components/LinkCard";
import { ThemeConfig, defaultTheme, applyTheme, normalizeTheme } from "@/lib/theme";
import { hasStoredAuthToken, isFirstTimeSetup } from "@/lib/auth";
import { profileApi, linksApi, subpagesApi, themeApi, menuApi, authApi, type SubpageItem, type WorkspaceBootstrapResponse } from "@/lib/api-client";
import { normalizeLinkDtos } from "@/lib/link-normalization";
import { parseOrbitPageBlocks } from "@orbitpage/page-schema";
import { useToast } from "@/hooks/use-toast";
import { Permission } from "@/lib/permissions";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import type { EditorActions, EditorAccess, EditorUsage } from "@/lib/editor-capabilities";
import { hasCustomProfileAvatar, isBundledProfileAvatar, persistedProfileAvatar } from "@/lib/profile-avatar";
import { createDefaultMenu, normalizeMenuCatalog, type MenuCatalog } from "@/lib/menu";
import {
  adminContentSectionFromLocation,
  adminDashboardPath,
  adminDefaultSubsection,
  adminEditorPath,
  adminEditorSectionFromLocation,
  adminTabFromLocation,
  adminSubsectionFromLocation,
  adminSubsectionPath,
  isAdminTab,
  type AdminContentSection,
  type AdminEditorSection,
  type AdminTab,
  type AdminSubsectionScope,
} from "@/lib/admin-navigation";
import type { EditorSubpage } from "@/components/SubpageManager";
import { isEmbeddedEditor, getEditorIntegration, EDITOR_SECTION_CHANGED_EVENT, EDITOR_SECTION_NAVIGATE_EVENT } from "@/lib/editor-integration";
import { useAppI18n } from "@/lib/i18n";

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

export interface CurrentUser {
  username: string;
  role: string;
  permissions: Permission[];
  readOnly?: boolean;
}

const Admin = () => {
  const { toast } = useToast();
  const { locale, setLocale, tr } = useAppI18n();
  const location = useLocation();
  const previousPathname = useRef(location.pathname);
  const navigate = useNavigate();
  const embeddedEditor = isEmbeddedEditor();
  const embeddedSurface = embeddedEditor;
  const locationTab = adminTabFromLocation(location.pathname, location.search);
  const locationContentSection = adminContentSectionFromLocation(location.pathname);
  const locationEditorSection = adminEditorSectionFromLocation(location.pathname);
  const locationSubsection = adminSubsectionFromLocation(location.pathname);
  const [embeddedTab, setEmbeddedTab] = useState<AdminTab>(locationTab);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [sessionDenied, setSessionDenied] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  
  // Use empty/neutral profile while real data is loading
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    bio: "",
    avatar: "",
    showAvatar: false,
    showOrbitPageBadge: true,
  });

  // Start with no links shown until we fetch them from the server
  const [links, setLinks] = useState<LinkData[]>([]);
  const [subpages, setSubpages] = useState<EditorSubpage[]>([]);

  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [menu, setMenu] = useState<MenuCatalog>(() => createDefaultMenu());
  const [editorAccess, setEditorAccess] = useState<EditorAccess | null>(null);
  const [editorUsage, setEditorUsage] = useState<EditorUsage | null>(null);
  const [editorActions, setEditorActions] = useState<EditorActions | null>(null);
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const bootstrapRef = useRef<Promise<WorkspaceBootstrapResponse> | null>(null);

  const requestedTab = embeddedSurface ? embeddedTab : locationTab;
  const requestedContentSection = embeddedSurface
    ? getEditorIntegration()?.contentSection || "link"
    : locationContentSection;
  const requestedEditorSection: AdminEditorSection | null = embeddedSurface ? null
    : locationEditorSection || (locationTab === "profile" ? "profile" : locationTab === "content" ? locationContentSection : null);

  useEffect(() => {
    if (embeddedSurface) return;
    const pathChanged = previousPathname.current !== location.pathname;
    previousPathname.current = location.pathname;
    const pathLocale = parseLocalizedPublicPath(location.pathname)?.locale;
    if (pathChanged && pathLocale && pathLocale !== locale) {
      setLocale(pathLocale);
      return;
    }
    const subsectionScope = locationEditorSection === "menu" || locationEditorSection === "shop" ? locationEditorSection : locationTab as AdminSubsectionScope;
    const defaultSubsection = currentUser ? adminDefaultSubsection(subsectionScope, currentUser.permissions.includes("profile:write")) : null;
    const selectedSubsection = locationSubsection || defaultSubsection;
    const expectedPath = selectedSubsection ? adminSubsectionPath(subsectionScope, selectedSubsection, locale) : locationEditorSection
      ? adminEditorPath(locationEditorSection, locale)
      : adminDashboardPath(locationTab, locationContentSection, locale);
    if (location.pathname !== expectedPath) navigate({ pathname: expectedPath, search: location.search, hash: location.hash }, { replace: true });
  }, [embeddedSurface, locale, setLocale, location.pathname, location.search, location.hash, locationTab, locationContentSection, locationEditorSection, locationSubsection, currentUser, navigate]);

  useEffect(() => {
    if (!embeddedSurface) return;
    const receiveNavigation = (event: Event) => {
      const section = (event as CustomEvent<{ section?: unknown }>).detail?.section;
      if (isAdminTab(section)) setEmbeddedTab(section);
    };
    window.addEventListener(EDITOR_SECTION_NAVIGATE_EVENT, receiveNavigation);
    return () => window.removeEventListener(EDITOR_SECTION_NAVIGATE_EVENT, receiveNavigation);
  }, [embeddedSurface]);

  const handleTabChange = (tab: AdminTab) => {
    if (embeddedSurface) {
      setEmbeddedTab(tab);
      window.dispatchEvent(new CustomEvent(EDITOR_SECTION_CHANGED_EVENT, { detail: { section: tab } }));
      return;
    }
    const subsection = adminDefaultSubsection(tab, currentUser?.permissions.includes("profile:write"));
    navigate(subsection ? adminSubsectionPath(tab as AdminSubsectionScope, subsection, locale) : adminDashboardPath(tab, locationContentSection, locale));
  };

  const handleContentSectionChange = (section: AdminContentSection) => {
    if (embeddedSurface) return;
    navigate(adminDashboardPath("content", section, locale));
  };

  const handleEditorSectionChange = (section: AdminEditorSection) => {
    if (embeddedSurface) return;
    const subsection = adminDefaultSubsection(section);
    const path = subsection ? adminSubsectionPath(section as AdminSubsectionScope, subsection, locale) : adminEditorPath(section, locale);
    if (location.pathname !== path) navigate(path);
  };

  // Check authentication status and setup status on mount.
  // Use async token verify so a page refresh doesn't clear the session:
  // the synchronous isAuthenticated() only checks the in-memory cache
  // (which is wiped on refresh), while authApi.verify() decrypts the token
  // from localStorage and confirms it with the server.
  useEffect(() => {
    const checkAuth = async () => {
      const integration = getEditorIntegration();
      const embedded = Boolean(integration);

      const firstTime = embedded ? false : await isFirstTimeSetup();
      setShowSetup(firstTime);

      if (embedded) {
        const bootstrapPromise = integration.bootstrap();
        void bootstrapPromise.catch(() => undefined);
        bootstrapRef.current = bootstrapPromise;

        try {
          const result = await (integration ? integration.verify() : authApi.verify());
          setIsLoggedIn(result.valid);
          setSessionDenied(!result.valid);
          if (result.valid && result.user) {
            setCurrentUser({
              username: result.user.username,
              role: result.user.role || 'admin',
              permissions: (result.user.permissions || []) as Permission[],
              readOnly: result.user.readOnly === true,
            });
          }
          if (!result.valid) bootstrapRef.current = null;
        } catch {
          bootstrapRef.current = null;
          setIsLoggedIn(false);
          setSessionDenied(true);
        }
      } else if (hasStoredAuthToken()) {
        try {
          const result = await authApi.verify();
          setIsLoggedIn(result.valid);
          if (result.valid && result.user) {
            setCurrentUser({
              username: result.user.username,
              role: result.user.role || 'admin',
              permissions: (result.user.permissions || []) as Permission[],
              readOnly: result.user.readOnly === true,
            });
          }
        } catch {
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [embeddedEditor]);

  // Load data from database and apply theme
  useEffect(() => {
    const loadData = async () => {
      const pendingBootstrap = bootstrapRef.current;
      try {
        const bootstrap = getEditorIntegration()
          ? await (pendingBootstrap || getEditorIntegration().bootstrap())
          : null;
        const [profileData, linksData, subpagesData, themeData, menuData] = bootstrap
          ? [bootstrap.profile, bootstrap.links, bootstrap.subpages || [], bootstrap.theme, bootstrap.menu]
          : await Promise.all([profileApi.get(), linksApi.get(), subpagesApi.get(), themeApi.get(), menuApi.get()]);

        if (bootstrap) {
          setEditorAccess(bootstrap.access || null);
          setEditorUsage(bootstrap.usage || null);
          setEditorActions(bootstrap.actions || null);
        }
        
        if (profileData) {
          const hasCustomAvatar = hasCustomProfileAvatar(profileData.avatar);
          setProfile({
            name: profileData.name,
            bio: profileData.bio,
            avatar: hasCustomProfileAvatar(profileData.avatar) ? profileData.avatar : "",
            showAvatar: typeof profileData.show_avatar !== 'undefined'
              ? profileData.show_avatar !== 0
              : (hasCustomAvatar ? (profileData.showAvatar ?? true) : false),
            socialLinks: profileData.social_links || profileData.socialLinks || {},
            nameFontSize: profileData.name_font_size || profileData.nameFontSize || undefined,
            bioFontSize: profileData.bio_font_size || profileData.bioFontSize || undefined,
            appearance: profileData.appearance || {},
            tabTitle: profileData.tab_title || profileData.tabTitle || undefined,
            metaDescription: profileData.meta_description || profileData.metaDescription || undefined,
            footerText: profileData.footer_text || profileData.footerText || undefined,
            showOrbitPageBadge: !bootstrap || bootstrap.access?.entitlements.badgeRequired === true
              ? true
              : (profileData.show_orbitpage_badge ?? profileData.showOrbitPageBadge ?? false),
            favicon: isBundledProfileAvatar(profileData.favicon) ? undefined : (profileData.favicon || undefined),
            googleAnalyticsId: profileData.google_analytics_id || profileData.googleAnalyticsId || undefined,
            privacyPolicyUrl: profileData.privacy_policy_url || profileData.privacyPolicyUrl || undefined,
            cookiePolicyUrl: profileData.cookie_policy_url || profileData.cookiePolicyUrl || undefined,
            machineReadableEnabled: profileData.machine_readable_enabled === 1 || profileData.machineReadableEnabled === true,
          });
        }

        setLinks(normalizeLinkDtos(linksData || []));
        setSubpages((subpagesData || []).map((page) => ({
          ...page,
          links: normalizeLinkDtos(page.links || []),
        })));

        if (themeData) {
          const loadedTheme = normalizeTheme(themeData);
          setTheme(loadedTheme);
          applyTheme(loadedTheme);
        } else {
          setTheme(defaultTheme);
          applyTheme(defaultTheme);
        }
        if (menuData) setMenu(normalizeMenuCatalog(menuData));
      } catch (error) {
        console.error('Error loading data:', error);
        applyTheme(defaultTheme);
      } finally {
        if (bootstrapRef.current === pendingBootstrap) bootstrapRef.current = null;
        setWorkspaceLoaded(true);
      }
    };

    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn, workspaceRefreshKey]);

  useEffect(() => {
    if (!embeddedEditor || isLoading || !isLoggedIn || !workspaceLoaded) return;
    getEditorIntegration()?.onReady?.();
  }, [embeddedEditor, isLoading, isLoggedIn, workspaceLoaded]);


  // Save data changes to database
  const saveProfile = async (newProfile: ProfileData) => {
    try {
      await profileApi.update({
        name: newProfile.name,
        bio: newProfile.bio,
        avatar: persistedProfileAvatar(newProfile.avatar),
        socialLinks: newProfile.socialLinks || {},
        showAvatar: newProfile.showAvatar === true,
        nameFontSize: newProfile.nameFontSize,
        bioFontSize: newProfile.bioFontSize,
        appearance: newProfile.appearance,
        tabTitle: newProfile.tabTitle,
        metaDescription: newProfile.metaDescription,
        footerText: newProfile.footerText,
        showOrbitPageBadge: newProfile.showOrbitPageBadge,
        favicon: persistedProfileAvatar(newProfile.favicon) || undefined,
        googleAnalyticsId: newProfile.googleAnalyticsId,
        privacyPolicyUrl: newProfile.privacyPolicyUrl,
        cookiePolicyUrl: newProfile.cookiePolicyUrl,
        machineReadableEnabled: newProfile.machineReadableEnabled,
      });
      setProfile(newProfile);
    } catch (error) {
      if ((error instanceof Error ? error.message : "") === 'AUTH_EXPIRED') {
        throw error;
      }
      console.error('Error saving page:', error);
      toast({
        title: 'Error saving page',
        description: (error instanceof Error ? error.message : "") || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('The page could not be saved.');
    }
  };

  const saveLinks = async (newLinks: LinkData[]) => {
    try {
      const perms = currentUser?.permissions || [];
      const canFullWrite = perms.includes('links:write');
      const canStyle = perms.includes('links:style');
      const canImages = perms.includes('links:images');

      if (canFullWrite) {
        // Full bulk replace (existing behaviour)
        const formattedLinks = parseOrbitPageBlocks(newLinks.map(link => ({
          ...link,
          id: String(link.id),
          type: link.type || 'link',
          titleFontSize: link.titleFontSize || undefined,
          descriptionFontSize: link.descriptionFontSize || undefined,
          status: link.status || 'live',
          campaignName: link.campaignName || undefined,
          startDate: link.startDate || undefined,
          startTime: link.startTime || undefined,
          endDate: link.endDate || undefined,
          endTime: link.endTime || undefined,
          timezone: link.timezone || undefined,
        })));
        await linksApi.update(formattedLinks);
      } else if (canStyle || canImages) {
        // Per-link PATCH for only the permitted fields
        for (const newLink of newLinks) {
          const id = String(newLink.id);
          if (canStyle) {
            await linksApi.patchStyle(id, {
              backgroundColor: newLink.backgroundColor,
              textColor: newLink.textColor,
              surfaceEffect: newLink.surfaceEffect,
              titleFontFamily: newLink.titleFontFamily,
              descriptionFontFamily: newLink.descriptionFontFamily,
              alignment: newLink.alignment,
              titleFontSize: newLink.titleFontSize,
              descriptionFontSize: newLink.descriptionFontSize,
              size: newLink.size,
            });
          }
          if (canImages) {
            await linksApi.patchIcon(id, {
              icon: newLink.icon ?? null,
              iconType: newLink.iconType ?? null,
              coverImage: newLink.coverImage ?? null,
              coverImageAlt: newLink.coverImageAlt ?? null,
            });
          }
        }
      }
      // Re-fetch from backend to guarantee public and admin are in sync
      const reloaded = await linksApi.get();
      const normalizedLinks = normalizeLinkDtos(reloaded);
      setLinks(normalizedLinks);
      setEditorUsage((current) => current ? { ...current, blocks: normalizedLinks.length } : current);
    } catch (error) {
      if ((error instanceof Error ? error.message : "") === 'AUTH_EXPIRED') {
        setIsLoggedIn(false);
        throw new Error('Your session expired. Sign in again before retrying the save.');
      }
      console.error('Error saving links:', error);
      toast({
        title: 'Error saving links',
        description: (error instanceof Error ? error.message : "") || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('Changes could not be saved. Try again.');
    }
  };

  const saveTheme = async (newTheme: ThemeConfig) => {
    try {
      await themeApi.update(newTheme);
      setTheme(newTheme);
      // Apply theme to admin interface too
      applyTheme(newTheme);
    } catch (error) {
      if ((error instanceof Error ? error.message : "") === 'AUTH_EXPIRED') {
        setIsLoggedIn(false);
        throw error;
      }
      console.error('Error saving theme:', error);
      toast({
        title: 'Error saving theme',
        description: (error instanceof Error ? error.message : "") || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const saveSubpages = async (nextSubpages: EditorSubpage[]) => {
    try {
      const response = await subpagesApi.update(nextSubpages as SubpageItem[]);
      const saved = response.data || await subpagesApi.get();
      setSubpages(saved.map((page) => ({ ...page, links: normalizeLinkDtos(page.links || []) })));
    } catch (error) {
      if ((error instanceof Error ? error.message : "") === 'AUTH_EXPIRED') setIsLoggedIn(false);
      toast({
        title: 'Error saving pages',
        description: (error instanceof Error ? error.message : "") || 'The page could not be saved. Please try again.',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('The page could not be saved.');
    }
  };

  const saveMenu = async (newMenu: MenuCatalog) => {
    try {
      await menuApi.update(newMenu);
      const reloaded = await menuApi.get();
      setMenu(normalizeMenuCatalog(reloaded, editorAccess?.entitlements.maxMenuItems ?? 250));
    } catch (error) {
      if ((error instanceof Error ? error.message : "") === 'AUTH_EXPIRED') setIsLoggedIn(false);
      throw error instanceof Error ? error : new Error('Menu changes could not be saved.');
    }
  };

  const handleLogin = async () => {
    setWorkspaceLoaded(false);
    try {
      const result = await authApi.verify();
      if (result.valid && result.user) {
        setCurrentUser({
          username: result.user.username,
          role: result.user.role || 'admin',
          permissions: (result.user.permissions || []) as Permission[],
          readOnly: result.user.readOnly === true,
        });
        setIsLoggedIn(true);
        setShowSetup(false);
        return;
      }
      setIsLoggedIn(false);
    } catch {
      setIsLoggedIn(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setWorkspaceLoaded(false);
  };

  const handleThemeChange = (newTheme: ThemeConfig) => {
    setTheme(newTheme);
    // Apply live changes to admin UI
    applyTheme(newTheme);
  };

  if (isLoading || (isLoggedIn && !workspaceLoaded)) {
    return (
      <main className="orbit-loading-screen">
        <OrbitLoadingState
          description={tr("Loading profile, content and theme.", "Caricamento di profilo, contenuti e tema.")}
          state={embeddedEditor ? "connecting" : "weaving"}
          title={tr("Preparing your workspace", "Preparazione del workspace")}
        />
      </main>
    );
  }

  if (!isLoggedIn) {
    if (isEmbeddedEditor() || sessionDenied) {
      return (
        <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950">
          <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
            <OrbitPageBrand size="lg" />
            <h1 className="mt-8 text-2xl font-bold">Open the editor from your dashboard</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Your session has expired. Open the editor again from the application dashboard.
            </p>
            <a
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
               href="/dashboard/profile"
              target="_top"
            >
              Return to dashboard
            </a>
          </section>
        </main>
      );
    }
    if (showSetup) {
      return <InitialSetup onSetupComplete={handleLogin} />;
    }
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <AdminView
      profile={profile}
      links={links}
      subpages={subpages}
      theme={theme}
      menu={menu}
      currentUser={currentUser}
      editorAccess={editorAccess}
      editorUsage={editorUsage}
      editorActions={editorActions}
      onProfileUpdate={saveProfile}
      onLinksUpdate={saveLinks}
      onSubpagesUpdate={saveSubpages}
      onThemeChange={saveTheme}
      onMenuUpdate={saveMenu}
      onAiApplied={() => setWorkspaceRefreshKey((current) => current + 1)}
      onLogout={handleLogout}
      requestedTab={requestedTab}
      requestedContentSection={requestedContentSection}
      requestedEditorSection={requestedEditorSection}
      requestedSubsection={locationSubsection}
      onSubsectionChange={(scope, subsection) => navigate(adminSubsectionPath(scope, subsection, locale))}
      onTabChange={handleTabChange}
      onContentSectionChange={handleContentSectionChange}
      onEditorSectionChange={handleEditorSectionChange}
    />
  );
};

export default Admin;
