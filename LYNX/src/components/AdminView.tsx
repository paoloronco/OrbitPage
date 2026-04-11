import { ProfileSection } from "./ProfileSection";
import { LinkManager } from "./LinkManager";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { LivePreview } from "./LivePreview";
import { LinkData } from "./LinkCard";
import { ClickAnalyticsChart } from "./ClickAnalyticsChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Link, Palette, User, Key, ExternalLink, Eye, BarChart2 } from "lucide-react";
import { logout } from "@/lib/auth";
import { ThemeConfig, applyTheme } from "@/lib/theme";
import { PasswordManager } from "./PasswordManager";

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
  const handleLogout = () => {
    logout();
    onLogout();
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
              <div className="glass-card p-4 text-center">
                <p className="text-sm text-muted-foreground">Total clicks</p>
                <p className="text-3xl font-bold text-primary">
                  {links.reduce((sum, l) => sum + (l.clickCount ?? 0), 0)}
                </p>
              </div>
              <div className="glass-card p-4">
                <ClickAnalyticsChart links={links} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Footer */}
        <div className="text-center pt-8 pb-2 space-y-1">
          <p className="text-xs text-muted-foreground opacity-60">
            <a
              href="https://github.com/paoloronco/Lynx"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Lynx
            </a>
            {" "}
            <span className="opacity-70">v{__APP_VERSION__}</span>
            {" · "}Your personal links hub
          </p>
        </div>
      </div>
    </div>
  );
};