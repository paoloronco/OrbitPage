import { useState, useEffect } from "react";
import { AdminView } from "@/components/AdminView";
import { LoginForm } from "@/components/LoginForm";
import { InitialSetup } from "@/components/InitialSetup";
import { LinkData } from "@/components/LinkCard";
import { ThemeConfig, defaultTheme, applyTheme, normalizeTheme } from "@/lib/theme";
import { hasStoredAuthToken, isFirstTimeSetup } from "@/lib/auth";
import { profileApi, linksApi, themeApi, authApi } from "@/lib/api-client";
import { normalizeLinkDtos } from "@/lib/link-normalization";
import { useToast } from "@/hooks/use-toast";
import profileAvatar from "@/assets/profile-avatar.jpg";
import { Permission } from "@/lib/permissions";

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
  tabTitle?: string;
  metaDescription?: string;
  footerText?: string;
  favicon?: string;
  googleAnalyticsId?: string;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
}

export interface CurrentUser {
  username: string;
  role: string;
  permissions: Permission[];
}

const Admin = () => {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  
  // Use empty/neutral profile while real data is loading
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    bio: "",
    avatar: profileAvatar,
    showAvatar: true,
  });

  // Start with no links shown until we fetch them from the server
  const [links, setLinks] = useState<LinkData[]>([]);

  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);

  // Check authentication status and setup status on mount.
  // Use async token verify so a page refresh doesn't clear the session:
  // the synchronous isAuthenticated() only checks the in-memory cache
  // (which is wiped on refresh), while authApi.verify() decrypts the token
  // from localStorage and confirms it with the server.
  useEffect(() => {
    const checkAuth = async () => {
      const firstTime = await isFirstTimeSetup();
      setShowSetup(firstTime);
      if (hasStoredAuthToken()) {
        try {
          const result = await authApi.verify();
          setIsLoggedIn(result.valid);
          if (result.valid && result.user) {
            setCurrentUser({
              username: result.user.username,
              role: result.user.role || 'admin',
              permissions: (result.user.permissions || []) as Permission[],
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
  }, []);

  // Load data from database and apply theme
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load profile data
        const profileData = await profileApi.get();
        
        if (profileData) {
          setProfile({
            name: profileData.name,
            bio: profileData.bio,
            avatar: profileData.avatar || (profileAvatar as string),
            showAvatar: (profileData as any).showAvatar ?? true,
            socialLinks: profileData.social_links || {},
            nameFontSize: (profileData as any).name_font_size || (profileData as any).nameFontSize || undefined,
            bioFontSize: (profileData as any).bio_font_size || (profileData as any).bioFontSize || undefined,
            tabTitle: (profileData as any).tab_title || (profileData as any).tabTitle || undefined,
            metaDescription: (profileData as any).meta_description || (profileData as any).metaDescription || undefined,
            footerText: (profileData as any).footer_text || (profileData as any).footerText || undefined,
            favicon: (profileData as any).favicon || undefined,
            googleAnalyticsId: (profileData as any).google_analytics_id || (profileData as any).googleAnalyticsId || undefined,
            privacyPolicyUrl: (profileData as any).privacy_policy_url || (profileData as any).privacyPolicyUrl || undefined,
            cookiePolicyUrl: (profileData as any).cookie_policy_url || (profileData as any).cookiePolicyUrl || undefined,
          });
        }

        // Load links data
        const linksData = await linksApi.get();
        
        if (linksData && linksData.length > 0) {
          setLinks(normalizeLinkDtos(linksData));
        }

        // Load theme data (for editing purposes) and apply it to admin too
        const themeData = await themeApi.get();
        
        if (themeData) {
          const loadedTheme = normalizeTheme(themeData);
          setTheme(loadedTheme);
          applyTheme(loadedTheme);
        } else {
          setTheme(defaultTheme);
          applyTheme(defaultTheme);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        applyTheme(defaultTheme);
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
        avatar: newProfile.avatar,
        socialLinks: newProfile.socialLinks || {},
        showAvatar: typeof newProfile.showAvatar === 'boolean' ? newProfile.showAvatar : true,
        nameFontSize: newProfile.nameFontSize,
        bioFontSize: newProfile.bioFontSize,
        tabTitle: newProfile.tabTitle,
        metaDescription: newProfile.metaDescription,
        footerText: newProfile.footerText,
        favicon: newProfile.favicon,
        googleAnalyticsId: newProfile.googleAnalyticsId,
        privacyPolicyUrl: newProfile.privacyPolicyUrl,
        cookiePolicyUrl: newProfile.cookiePolicyUrl,
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
      setLinks(normalizeLinkDtos(reloaded));
    } catch (error: any) {
      if (error?.message === 'AUTH_EXPIRED') {
        setIsLoggedIn(false);
        return;
      }
      console.error('Error saving links:', error);
      toast({
        title: 'Error saving links',
        description: error?.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const saveTheme = async (newTheme: ThemeConfig) => {
    try {
      // Pass the full theme configuration to the API
      await themeApi.update(newTheme);
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

  const handleLogin = async () => {
    setIsLoggedIn(true);
    try {
      const result = await authApi.verify();
      if (result.valid && result.user) {
        setCurrentUser({
          username: result.user.username,
          role: result.user.role || 'admin',
          permissions: (result.user.permissions || []) as Permission[],
        });
      }
    } catch { /* ignore — user is still logged in */ }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  const handleThemeChange = (newTheme: ThemeConfig) => {
    setTheme(newTheme);
    // Apply live changes to admin UI
    applyTheme(newTheme);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (showSetup) {
      return <InitialSetup onSetupComplete={handleLogin} />;
    }
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <AdminView
      profile={profile}
      links={links}
      theme={theme}
      currentUser={currentUser}
      onProfileUpdate={saveProfile}
      onLinksUpdate={saveLinks}
      onThemeChange={saveTheme}
      onLogout={handleLogout}
    />
  );
};

export default Admin;
