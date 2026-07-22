import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminView } from "@/components/AdminView";
import { LoginForm } from "@/components/LoginForm";
import { InitialSetup } from "@/components/InitialSetup";
import { OrbitPageBrand } from "@/components/OrbitPageBrand";
import { LinkData } from "@/components/LinkCard";
import { ThemeConfig, defaultTheme, applyTheme, normalizeTheme } from "@/lib/theme";
import { hasStoredAuthToken, isFirstTimeSetup } from "@/lib/auth";
import { profileApi, linksApi, subpagesApi, themeApi, menuApi, authApi, isHostedRuntime, isSaasMode, isIntegratedHostedSurface, workspaceBootstrapApi, type SubpageItem } from "@/lib/api-client";
import { normalizeLinkDtos } from "@/lib/link-normalization";
import { useToast } from "@/hooks/use-toast";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { Permission } from "@/lib/permissions";
import type { ProfileAppearance } from "@/lib/profile-appearance";
import type { SaasBillingContext, SaasPlanDefinition, SaasWorkspaceUsage } from "@/lib/saas-plan";
import { isBundledProfileAvatar, persistedProfileAvatar } from "@/lib/profile-avatar";
import { createDefaultMenu, normalizeMenuCatalog, type MenuCatalog } from "@/lib/menu";
import {
  ADMIN_SECTION_CHANGED_MESSAGE,
  ADMIN_SECTION_NAVIGATE_MESSAGE,
  adminDashboardPath,
  adminTabFromLocation,
  isAdminSectionMessage,
  type AdminTab,
} from "@/lib/admin-navigation";
import type { EditorSubpage } from "@/components/SubpageManager";
import { HOSTED_SECTION_CHANGED_EVENT, HOSTED_SECTION_NAVIGATE_EVENT } from "@/lib/hosted-surface";

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

export interface CurrentUser {
  username: string;
  role: string;
  permissions: Permission[];
  readOnly?: boolean;
}

const Admin = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const integratedHostedSurface = isIntegratedHostedSurface();
  const hostedSurface = typeof window !== "undefined" && isSaasMode() && (window.self !== window.top || integratedHostedSurface);
  const locationTab = adminTabFromLocation(location.pathname, location.search);
  const [hostedTab, setHostedTab] = useState<AdminTab>(locationTab);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [hostedAccessDenied, setHostedAccessDenied] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  
  // Use empty/neutral profile while real data is loading
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    bio: "",
    avatar: profileAvatar,
    showAvatar: true,
    adminOnboardingEnabled: false,
  });

  // Start with no links shown until we fetch them from the server
  const [links, setLinks] = useState<LinkData[]>([]);
  const [subpages, setSubpages] = useState<EditorSubpage[]>([]);

  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [menu, setMenu] = useState<MenuCatalog>(() => createDefaultMenu());
  const [saasPlan, setSaasPlan] = useState<SaasPlanDefinition | null>(null);
  const [saasUsage, setSaasUsage] = useState<SaasWorkspaceUsage | null>(null);
  const [saasBilling, setSaasBilling] = useState<SaasBillingContext | null>(null);

  const requestedTab = hostedSurface ? hostedTab : locationTab;

  useEffect(() => {
    if (hostedSurface) return;
    const expectedPath = adminDashboardPath(locationTab);
    if (location.pathname !== expectedPath) navigate(expectedPath, { replace: true });
  }, [hostedSurface, location.pathname, locationTab, navigate]);

  useEffect(() => {
    if (!hostedSurface) return;
    if (integratedHostedSurface) {
      const receiveNavigation = (event: Event) => {
        const detail = (event as CustomEvent<{ section?: unknown }>).detail;
        if (isAdminSectionMessage({ type: ADMIN_SECTION_NAVIGATE_MESSAGE, section: detail?.section }, ADMIN_SECTION_NAVIGATE_MESSAGE)) {
          setHostedTab(detail.section as AdminTab);
        }
      };
      window.addEventListener(HOSTED_SECTION_NAVIGATE_EVENT, receiveNavigation);
      return () => window.removeEventListener(HOSTED_SECTION_NAVIGATE_EVENT, receiveNavigation);
    }
    const receiveNavigation = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (isAdminSectionMessage(event.data, ADMIN_SECTION_NAVIGATE_MESSAGE)) {
        setHostedTab(event.data.section);
      }
    };
    window.addEventListener("message", receiveNavigation);
    return () => window.removeEventListener("message", receiveNavigation);
  }, [hostedSurface, integratedHostedSurface]);

  const handleTabChange = (tab: AdminTab) => {
    if (hostedSurface) {
      setHostedTab(tab);
      if (integratedHostedSurface) {
        window.dispatchEvent(new CustomEvent(HOSTED_SECTION_CHANGED_EVENT, { detail: { section: tab } }));
        return;
      }
      window.parent.postMessage(
        { type: ADMIN_SECTION_CHANGED_MESSAGE, section: tab },
        window.location.origin,
      );
      return;
    }
    navigate(adminDashboardPath(tab));
  };

  // Check authentication status and setup status on mount.
  // Use async token verify so a page refresh doesn't clear the session:
  // the synchronous isAuthenticated() only checks the in-memory cache
  // (which is wiped on refresh), while authApi.verify() decrypts the token
  // from localStorage and confirms it with the server.
  useEffect(() => {
    const checkAuth = async () => {
      const hosted = isSaasMode();

      // The SaaS editor is an authenticated dashboard surface, never a second
      // login destination. Standalone visits return to the Firebase dashboard.
      if (isHostedRuntime() && window.self === window.top && !integratedHostedSurface) {
        window.location.replace('/dashboard/profile');
        return;
      }

      const firstTime = hosted ? false : await isFirstTimeSetup();
      setShowSetup(firstTime);

      if (hosted) {
        if (!authApi.hasStoredToken()) {
          setHostedAccessDenied(true);
          setIsLoading(false);
          return;
        }

        try {
          const result = await authApi.verify();
          setIsLoggedIn(result.valid);
          setHostedAccessDenied(!result.valid);
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
          setHostedAccessDenied(true);
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
  }, [integratedHostedSurface]);

  // Load data from database and apply theme
  useEffect(() => {
    const loadData = async () => {
      try {
        const bootstrap = isSaasMode() ? await workspaceBootstrapApi.get() : null;
        const [profileData, linksData, subpagesData, themeData, menuData] = bootstrap
          ? [bootstrap.profile, bootstrap.links, bootstrap.subpages || [], bootstrap.theme, bootstrap.menu]
          : await Promise.all([profileApi.get(), linksApi.get(), subpagesApi.get(), themeApi.get(), menuApi.get()]);

        if (bootstrap) {
          setSaasPlan(bootstrap.plan || null);
          setSaasUsage(bootstrap.usage || null);
          setSaasBilling(bootstrap.billing || null);
        }
        
        if (profileData) {
          setProfile({
            name: profileData.name,
            bio: profileData.bio,
            avatar: profileData.avatar && !isBundledProfileAvatar(profileData.avatar)
              ? profileData.avatar
              : (profileAvatar as string),
            showAvatar: typeof (profileData as any).show_avatar !== 'undefined'
              ? (profileData as any).show_avatar !== 0
              : ((profileData as any).showAvatar ?? true),
            socialLinks: profileData.social_links || (profileData as any).socialLinks || {},
            nameFontSize: (profileData as any).name_font_size || (profileData as any).nameFontSize || undefined,
            bioFontSize: (profileData as any).bio_font_size || (profileData as any).bioFontSize || undefined,
            appearance: profileData.appearance || {},
            tabTitle: (profileData as any).tab_title || (profileData as any).tabTitle || undefined,
            metaDescription: (profileData as any).meta_description || (profileData as any).metaDescription || undefined,
            footerText: (profileData as any).footer_text || (profileData as any).footerText || undefined,
            favicon: isBundledProfileAvatar((profileData as any).favicon) ? undefined : ((profileData as any).favicon || undefined),
            googleAnalyticsId: (profileData as any).google_analytics_id || (profileData as any).googleAnalyticsId || undefined,
            privacyPolicyUrl: (profileData as any).privacy_policy_url || (profileData as any).privacyPolicyUrl || undefined,
            cookiePolicyUrl: (profileData as any).cookie_policy_url || (profileData as any).cookiePolicyUrl || undefined,
            adminOnboardingEnabled: typeof (profileData as any).admin_onboarding_enabled !== 'undefined'
              ? (profileData as any).admin_onboarding_enabled !== 0
              : ((profileData as any).adminOnboardingEnabled ?? true),
          });
        }

        if (linksData && linksData.length > 0) {
          setLinks(normalizeLinkDtos(linksData));
        }
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
        setWorkspaceLoaded(true);
      }
    };

    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);


  // Save data changes to database
  const saveProfile = async (newProfile: ProfileData) => {
    try {
      await profileApi.update({
        name: newProfile.name,
        bio: newProfile.bio,
        avatar: persistedProfileAvatar(newProfile.avatar),
        socialLinks: newProfile.socialLinks || {},
        showAvatar: typeof newProfile.showAvatar === 'boolean' ? newProfile.showAvatar : true,
        nameFontSize: newProfile.nameFontSize,
        bioFontSize: newProfile.bioFontSize,
        appearance: newProfile.appearance,
        tabTitle: newProfile.tabTitle,
        metaDescription: newProfile.metaDescription,
        footerText: newProfile.footerText,
        favicon: persistedProfileAvatar(newProfile.favicon) || undefined,
        googleAnalyticsId: newProfile.googleAnalyticsId,
        privacyPolicyUrl: newProfile.privacyPolicyUrl,
        cookiePolicyUrl: newProfile.cookiePolicyUrl,
        adminOnboardingEnabled: typeof newProfile.adminOnboardingEnabled === 'boolean' ? newProfile.adminOnboardingEnabled : true,
      });
      setProfile(newProfile);
    } catch (error: any) {
      if (error?.message === 'AUTH_EXPIRED') {
        throw error;
      }
      console.error('Error saving page:', error);
      toast({
        title: 'Error saving page',
        description: error?.message || 'An unexpected error occurred. Please try again.',
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
        const formattedLinks = newLinks.map(link => ({
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
        }));
        await linksApi.update(formattedLinks);
      } else if (canStyle || canImages) {
        // Per-link PATCH for only the permitted fields
        await Promise.all(newLinks.map(async (newLink) => {
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
        }));
      }
      // Re-fetch from backend to guarantee public and admin are in sync
      const reloaded = await linksApi.get();
      const normalizedLinks = normalizeLinkDtos(reloaded);
      setLinks(normalizedLinks);
      setSaasUsage((current) => current ? { ...current, blocks: normalizedLinks.length } : current);
    } catch (error: any) {
      if (error?.message === 'AUTH_EXPIRED') {
        setIsLoggedIn(false);
        throw new Error('Your session expired. Sign in again before retrying the save.');
      }
      console.error('Error saving links:', error);
      toast({
        title: 'Error saving links',
        description: error?.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('Changes could not be saved. Try again.');
    }
  };

  const saveTheme = async (newTheme: ThemeConfig) => {
    try {
      const themedLinks = links.map((link) => ({
        ...link,
        backgroundColor: null as unknown as string,
        textColor: null as unknown as string,
        titleFontFamily: null as unknown as string,
        descriptionFontFamily: null as unknown as string,
        titleFontSize: null as unknown as string,
        descriptionFontSize: null as unknown as string,
        textItems: link.textItems?.map((item) => ({
          ...item,
          textColor: null as unknown as string,
          fontFamily: null as unknown as string,
          fontSize: null as unknown as string,
        })),
      }));
      // Pass the full theme configuration to the API
      await themeApi.update(newTheme);
      if (themedLinks.length) {
        await linksApi.update(themedLinks);
        const reloadedLinks = await linksApi.get();
        setLinks(normalizeLinkDtos(reloadedLinks));
      }
      setTheme(newTheme);
      // Apply theme to admin interface too
      applyTheme(newTheme);
    } catch (error: any) {
      if (error?.message === 'AUTH_EXPIRED') {
        setIsLoggedIn(false);
        throw error;
      }
      console.error('Error saving theme:', error);
      toast({
        title: 'Error saving theme',
        description: error?.message || 'An unexpected error occurred. Please try again.',
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
    } catch (error: any) {
      if (error?.message === 'AUTH_EXPIRED') setIsLoggedIn(false);
      toast({
        title: 'Error saving pages',
        description: error?.message || 'The page could not be saved. Please try again.',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('The page could not be saved.');
    }
  };

  const saveMenu = async (newMenu: MenuCatalog) => {
    try {
      await menuApi.update(newMenu);
      const reloaded = await menuApi.get();
      setMenu(normalizeMenuCatalog(reloaded, saasPlan?.entitlements.maxMenuItems ?? 250));
    } catch (error: any) {
      if (error?.message === 'AUTH_EXPIRED') setIsLoggedIn(false);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (isSaasMode() || hostedAccessDenied) {
      return (
        <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950">
          <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
            <OrbitPageBrand size="lg" />
            <h1 className="mt-8 text-2xl font-bold">Open the editor from your dashboard</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              This hosted editor requires an active OrbitPage session. No separate admin username or password is used.
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
      saasPlan={saasPlan}
      saasUsage={saasUsage}
      saasBilling={saasBilling}
      onProfileUpdate={saveProfile}
      onLinksUpdate={saveLinks}
      onSubpagesUpdate={saveSubpages}
      onThemeChange={saveTheme}
      onMenuUpdate={saveMenu}
      onLogout={handleLogout}
      requestedTab={requestedTab}
      onTabChange={handleTabChange}
    />
  );
};

export default Admin;
