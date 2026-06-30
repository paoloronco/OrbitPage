import { useEffect, useMemo, useState } from "react";
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
import { CurrentUser } from "@/pages/Admin";
import { Permission, hasPermission, hasAnyPermission, getLinkEditMode } from "@/lib/permissions";
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Cookie,
  ExternalLink,
  Eye,
  Globe2,
  Key,
  Layers3,
  Link,
  LogOut,
  MousePointerClick,
  Palette,
  ShieldCheck,
  User,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { ThemeConfig, applyTheme } from "@/lib/theme";
import { PasswordManager } from "./PasswordManager";
import { UserManager } from "./UserManager";
import { PrivacySettings } from "./PrivacySettings";
import { utilityApi } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import { DEMO_MODE } from "@/lib/config";

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

interface AdminViewProps {
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  currentUser: CurrentUser | null;
  onProfileUpdate: (profile: ProfileData) => void | Promise<void>;
  onLinksUpdate: (links: LinkData[]) => void;
  onThemeChange: (theme: ThemeConfig) => void;
  onLogout: () => void;
}

type AdminTab = "profile" | "links" | "theme" | "access" | "preview" | "analytics" | "privacy";

const tabs: Array<{ value: AdminTab; label: string; icon: React.ElementType }> = [
  { value: "profile", label: "Profile", icon: User },
  { value: "links", label: "Links", icon: Link },
  { value: "theme", label: "Theme", icon: Palette },
  { value: "access", label: "Access", icon: Key },
  { value: "preview", label: "Preview", icon: Eye },
  { value: "analytics", label: "Analytics", icon: BarChart2 },
  { value: "privacy", label: "Privacy", icon: Cookie },
];

export const AdminView = ({
  profile,
  links,
  theme,
  currentUser,
  onProfileUpdate,
  onLinksUpdate,
  onThemeChange,
  onLogout
}: AdminViewProps) => {
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__ || "4.3.3");
  const [gaId, setGaId] = useState<string>(profile.googleAnalyticsId || "");
  const [gaSaved, setGaSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("profile");

  const userPerms = (currentUser?.permissions || []) as Permission[];
  const canManageUsers = hasPermission(userPerms, 'users:manage');
  const canEditProfile = hasPermission(userPerms, 'profile:write');
  const canEditLinks = hasAnyPermission(userPerms, 'links:write', 'links:style', 'links:images');
  const canEditTheme = hasPermission(userPerms, 'theme:write');
  const canViewAnalytics = hasPermission(userPerms, 'analytics:read');
  const canEditCompliance = hasPermission(userPerms, 'compliance:write');
  const canPreview = canEditLinks || canEditTheme || canEditProfile;
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
      case 'access':    return true;
      case 'preview':   return canPreview;
      case 'analytics': return canViewAnalytics;
      case 'privacy':   return canEditCompliance;
      default:          return false;
    }
  });

  // Keep activeTab in sync when permission set changes (e.g. after login)
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(t => t.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    setGaId(profile.googleAnalyticsId || "");
  }, [profile.googleAnalyticsId]);

  const metrics = useMemo(() => {
    const contentLinks = links.filter(link => link.type !== "separator");
    const visibleLinks = contentLinks.filter(link => link.isActive !== false);
    const scheduledLinks = contentLinks.filter(link => link.startDate || link.endDate);
    const totalClicks = links.reduce((sum, link) => sum + (link.clickCount ?? 0), 0);
    const socialCount = Object.values(profile.socialLinks || {}).filter(Boolean).length;

    return {
      visibleLinks: visibleLinks.length,
      totalLinks: contentLinks.length,
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

  return (
    <div className="lynx-admin min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="admin-topbar">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="admin-status-dot" />
              <span className="admin-kicker">Self-hosted dashboard</span>
              {appVersion && <span className="admin-version">v{appVersion}</span>}
            </div>
            <h1 className="admin-title">Lynx Admin</h1>
            <p className="admin-subtitle">
              Manage profile, content, theme, security, and analytics from one workspace.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <a href={withBasePath('/')} target="_blank" rel="noopener noreferrer">
              <Button className="admin-action admin-action-primary w-full sm:w-auto" size="sm">
                <ExternalLink className="h-4 w-4" />
                Public page
              </Button>
            </a>
            <Button className="admin-action w-full sm:w-auto" variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        <section className="admin-metrics" aria-label="Workspace status">
          <MetricCard
            icon={Globe2}
            label="Visible links"
            value={`${metrics.visibleLinks}/${metrics.totalLinks}`}
            detail={metrics.scheduledLinks > 0 ? `${metrics.scheduledLinks} scheduled` : "Ready to publish"}
          />
          <MetricCard
            icon={MousePointerClick}
            label="Total clicks"
            value={String(metrics.totalClicks)}
            detail="Built-in tracking"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Profile"
            value={metrics.profileReady ? "Ready" : "Draft"}
            detail={`${metrics.socialCount} social links`}
          />
          <MetricCard
            icon={ShieldCheck}
            label="Admin access"
            value="Protected"
            detail="Encrypted session token"
          />
        </section>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)} className="mt-5 flex-1">
          <div className="admin-nav-shell">
            <TabsList className="admin-tabs">
              {visibleTabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="admin-tab">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="profile" className="admin-tab-content">
            <div className="admin-content-grid">
              <div className="admin-main-column">
                <ProfileSection
                  profile={profile}
                  onProfileUpdate={(nextProfile) => { void onProfileUpdate(nextProfile); }}
                />
              </div>
              <aside className="admin-side-panel admin-checklist-panel">
                <PanelHeader icon={User} title="Profile checklist" />
                <ChecklistItem checked={Boolean(profile.name?.trim())} label="Name is set" />
                <ChecklistItem checked={Boolean(profile.bio?.trim())} label="Bio is set" />
                <ChecklistItem checked={metrics.socialCount > 0} label="At least one social link" />
                <ChecklistItem checked={Boolean(profile.tabTitle?.trim())} label="Browser title customized" />
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="links" className="admin-tab-content">
            <div className="admin-content-grid admin-content-grid-wide">
              <div className="admin-main-column">
                <LinkManager
                  links={links}
                  onLinksUpdate={onLinksUpdate}
                  editMode={linkEditMode}
                />
              </div>
              <aside className="admin-side-panel">
                <PanelHeader icon={Layers3} title="Content status" />
                <div className="space-y-3">
                  <StatusRow label="Visible" value={String(metrics.visibleLinks)} />
                  <StatusRow label="Hidden" value={String(Math.max(metrics.totalLinks - metrics.visibleLinks, 0))} />
                  <StatusRow label="Scheduled" value={String(metrics.scheduledLinks)} />
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="theme" className="admin-tab-content">
            <ThemeCustomizer
              theme={theme}
              onThemeChange={onThemeChange}
              onThemePreview={(nextTheme) => applyTheme(nextTheme)}
            />
          </TabsContent>

          <TabsContent value="access" className="admin-tab-content">
            <div className="admin-single-column space-y-6">
              {canManageUsers && <UserManager />}
              <PasswordManager />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="admin-tab-content">
            <div className="admin-preview-grid">
              <section className="admin-preview-copy">
                <PanelHeader icon={Eye} title="Saved public page" />
                <p className="text-sm leading-6 text-slate-600">
                  Save changes in each editor before checking this preview. Open the public page for the full-size version.
                </p>
                <a href={withBasePath('/')} target="_blank" rel="noopener noreferrer">
                  <Button className="admin-action admin-action-primary mt-4" size="sm">
                    <ExternalLink className="h-4 w-4" />
                    Open public page
                  </Button>
                </a>
              </section>
              <LivePreview profile={profile} links={links} theme={theme} />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="admin-tab-content">
            <div className="admin-analytics-grid">
              <section className="admin-panel">
                <PanelHeader icon={BarChart2} title="Click analytics" />
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <StatusTile label="Total clicks" value={String(metrics.totalClicks)} />
                  <StatusTile label="Tracked items" value={String(metrics.totalLinks)} />
                </div>
                <ClickAnalyticsChart links={links} />
              </section>

              <Card className="admin-panel space-y-5">
                <PanelHeader icon={Globe2} title="Google Analytics 4" />
                <p className="text-sm leading-6 text-slate-600">
                  Tracking runs on the public page only. Admin activity stays out of analytics.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="ga-id" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Measurement ID
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
                    Find it in Google Analytics, Admin, Data streams, Measurement ID.
                  </p>
                </div>

                {gaId && !gaId.match(/^G-[A-Z0-9]+$/i) && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    The ID must start with G- and use only letters and numbers.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleSaveIntegrations}
                    className="admin-action admin-action-primary"
                    size="sm"
                    disabled={!canEditProfile || (!!gaId && !gaId.match(/^G-[A-Z0-9]+$/i))}
                  >
                    {gaSaved ? "Saved" : "Save"}
                  </Button>
                  {profile.googleAnalyticsId && (
                    <p className="text-xs text-slate-500">
                      Active: <span className="font-mono text-blue-700">{profile.googleAnalyticsId}</span>
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="admin-tab-content">
            <PrivacySettings
              privacyPolicyUrl={profile.privacyPolicyUrl}
              cookiePolicyUrl={profile.cookiePolicyUrl}
              readOnly={DEMO_MODE}
              onLegalPolicyUpdate={({ privacyPolicyUrl, cookiePolicyUrl }) =>
                onProfileUpdate({ ...profile, privacyPolicyUrl, cookiePolicyUrl })
              }
            />
          </TabsContent>
        </Tabs>

        <footer className="admin-footer">
          {DEMO_MODE && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs leading-5 text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                <span>Demo Mode</span>
              </div>
              <p>
                This instance is automatically reset every 5 minutes. Any changes made during the demo will be lost after the reset. Any users created during the demo will be removed. Changing the admin password is disabled. Editing privacy settings, including Privacy Policy, Cookie Policy, Consent Management, and related compliance configuration, is disabled.
              </p>
            </div>
          )}
          {profile.footerText && (
            <p className="whitespace-pre-line text-xs text-slate-500">
              {profile.footerText}
            </p>
          )}
          <p>
            Powered by{" "}
            <a href="https://github.com/paoloronco/Lynx" target="_blank" rel="noopener noreferrer">
              Lynx
            </a>
            {appVersion && <span> v{appVersion}</span>}
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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
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
