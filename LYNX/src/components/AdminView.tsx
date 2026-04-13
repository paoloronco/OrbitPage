import { ProfileSection } from "./ProfileSection";
import { LinkManager } from "./LinkManager";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { LivePreview } from "./LivePreview";
import { LinkData } from "./LinkCard";
import { ClickAnalyticsChart } from "./ClickAnalyticsChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { LogOut, Link, Palette, User, Key, ExternalLink, Eye, BarChart2 } from "lucide-react";
import { logout } from "@/lib/auth";
import { ThemeConfig, applyTheme } from "@/lib/theme";
import { PasswordManager } from "./PasswordManager";
import { utilityApi } from "@/lib/api-client";
import { useState, useEffect } from "react";

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
}

interface AdminViewProps {
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  onProfileUpdate: (profile: ProfileData) => void;
  onLinksUpdate: (links: LinkData[]) => void;
  onThemeChange: (theme: ThemeConfig) => void;
  onLogout: () => void;
}

export const AdminView = ({
  profile,
  links,
  theme,
  onProfileUpdate,
  onLinksUpdate,
  onThemeChange,
  onLogout
}: AdminViewProps) => {
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__ || '3.8.0');
  const [gaId, setGaId] = useState<string>(profile.googleAnalyticsId || '');
  const [gaSaved, setGaSaved] = useState(false);

  // Load app version from server
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const health = await utilityApi.getHealth();
        setAppVersion(health.version);
      } catch (error) {
        console.warn('Failed to load app version from server, using build version:', error);
        // Keep the build version as fallback
      }
    };
    loadVersion();
  }, []);

  // Sync gaId when profile is loaded from server
  useEffect(() => {
    setGaId(profile.googleAnalyticsId || '');
  }, [profile.googleAnalyticsId]);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleSaveIntegrations = () => {
    onProfileUpdate({ ...profile, googleAnalyticsId: gaId.trim() || undefined });
    setGaSaved(true);
    setTimeout(() => setGaSaved(false), 2500);
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Admin Header */}
        <div className="glass-card p-4 border border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h1 className="text-lg font-semibold text-primary">
                Lynx - Your personal links hub
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <a href="/" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">View Public Page</span>
                  <span className="sm:hidden">Preview</span>
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-6 w-full max-w-2xl mx-auto">
            <TabsTrigger value="profile" className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="links" className="flex items-center gap-1">
              <Link className="w-4 h-4" />
              <span className="hidden sm:inline">Links</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-1">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Theme</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1">
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Preview</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1">
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <div className="max-w-md mx-auto">
              <ProfileSection 
                profile={profile}
                onProfileUpdate={onProfileUpdate}
              />
            </div>
          </TabsContent>

          <TabsContent value="links" className="space-y-6">
            <div className="max-w-md mx-auto">
              <LinkManager
                links={links}
                onLinksUpdate={onLinksUpdate}
              />
            </div>
          </TabsContent>

          <TabsContent value="theme" className="space-y-6">
            <ThemeCustomizer
              theme={theme}
              onThemeChange={onThemeChange}
              onThemePreview={(t) => applyTheme(t)}
            />
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <div className="max-w-md mx-auto">
              <PasswordManager />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div className="max-w-md mx-auto">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Showing saved state — click Save in each tab to see your latest changes.
              </p>
              <LivePreview profile={profile} links={links} theme={theme} />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="max-w-xl mx-auto space-y-4">

              {/* --- Built-in click analytics --- */}
              <div className="glass-card p-4 text-center">
                <p className="text-sm text-muted-foreground">Total clicks</p>
                <p className="text-3xl font-bold text-primary">
                  {links.reduce((sum, l) => sum + (l.clickCount ?? 0), 0)}
                </p>
              </div>
              <div className="glass-card p-4">
                <ClickAnalyticsChart links={links} />
              </div>

              {/* --- Google Analytics 4 --- */}
              <Card className="glass-card p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-primary shrink-0 mt-0.5" aria-hidden="true">
                    <path d="M22.84 11.04C21.73 5.3 16.8 1 11 1 5.48 1 1 5.48 1 11c0 5.52 4.48 10 10 10 5.3 0 9.73-4.11 10.84-9.96zM11 19c-4.42 0-8-3.58-8-8s3.58-8 8-8c4.07 0 7.44 2.99 7.93 6.93l-3.44-2.13a4.5 4.5 0 0 0-4.49 0L8.57 9.93A4.48 4.48 0 0 0 6.5 13.5c0 2.49 2.01 4.5 4.5 4.5s4.5-2.01 4.5-4.5c0-.84-.23-1.63-.63-2.31l3.44 2.13C17.5 16.67 14.47 19 11 19z"/>
                  </svg>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Google Analytics 4</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The tracking script is injected on the public page only — the admin panel is never tracked.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ga-id" className="text-xs font-medium">Measurement ID</Label>
                  <Input
                    id="ga-id"
                    value={gaId}
                    onChange={(e) => setGaId(e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="glass-card border-primary/20 font-mono text-sm"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground opacity-70">
                    Google Analytics → Admin → Data Streams → your stream → Measurement ID (starts with <span className="font-mono">G-</span>).
                  </p>
                </div>

                {gaId && !gaId.match(/^G-[A-Z0-9]+$/i) && (
                  <p className="text-xs text-destructive">
                    Format incorrect — must start with <span className="font-mono">G-</span> followed by alphanumeric characters.
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveIntegrations}
                    variant="gradient"
                    size="sm"
                    disabled={!!gaId && !gaId.match(/^G-[A-Z0-9]+$/i)}
                  >
                    {gaSaved ? 'Saved!' : 'Save'}
                  </Button>
                  {profile.googleAnalyticsId && (
                    <p className="text-xs text-muted-foreground">
                      Active: <span className="font-mono text-primary">{profile.googleAnalyticsId}</span>
                    </p>
                  )}
                </div>
              </Card>

            </div>
          </TabsContent>
        </Tabs>
        
        {/* Footer — "Powered by Lynx" is always shown and cannot be removed */}
        <div className="text-center pt-8 pb-2 space-y-1">
          {profile.footerText && (
            <p className="text-xs text-muted-foreground opacity-70 whitespace-pre-line">
              {profile.footerText}
            </p>
          )}
          <p className="text-xs text-muted-foreground opacity-60">
            Powered by{" "}
            <a
              href="https://github.com/paoloronco/Lynx"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Lynx
            </a>
            {appVersion && <span> v{appVersion}</span>}
          </p>
          <p className="text-xs text-muted-foreground opacity-60">
            Your personal links hub
          </p>
        </div>
      </div>
    </div>
  );
};