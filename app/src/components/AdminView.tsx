import { useEffect, useMemo, useState } from "react";
import { ProfileSection } from "./ProfileSection";
import { LinkManager } from "./LinkManager";
import { ThemeCustomizer } from "./ThemeCustomizer";
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
  FileText,
  Globe2,
  HelpCircle,
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
import { BackupManager } from "./BackupManager";
import { TextFileManager } from "./TextFileManager";
import { AdminOnboarding } from "./AdminOnboarding";
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
  adminOnboardingEnabled?: boolean;
}

interface AdminViewProps {
  profile: ProfileData;
  links: LinkData[];
  theme: ThemeConfig;
  currentUser: CurrentUser | null;
  onProfileUpdate: (profile: ProfileData) => void | Promise<void>;
  onLinksUpdate: (links: LinkData[]) => void | Promise<void>;
  onThemeChange: (theme: ThemeConfig) => void | Promise<void>;
  onLogout: () => void;
}

export type AdminTab = "profile" | "links" | "theme" | "access" | "analytics" | "privacy" | "txt";

const tabs: Array<{ value: AdminTab; label: string; icon: React.ElementType }> = [
  { value: "profile", label: "Page", icon: User },
  { value: "links", label: "Links", icon: Link },
  { value: "theme", label: "Theme", icon: Palette },
  { value: "access", label: "Access", icon: Key },
  { value: "analytics", label: "Analytics", icon: BarChart2 },
  { value: "privacy", label: "Privacy", icon: Cookie },
  { value: "txt", label: "TXT", icon: FileText },
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
  currentUser,
  onProfileUpdate,
  onLinksUpdate,
  onThemeChange,
  onLogout
}: AdminViewProps) => {
  const [appVersion, setAppVersion] = useState<string>(__APP_VERSION__ || "4.3.28");
  const [gaId, setGaId] = useState<string>(profile.googleAnalyticsId || "");
  const [gaSaved, setGaSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("profile");
  const [onboardingReplayKey, setOnboardingReplayKey] = useState(0);
  const [didPickInitialTab, setDidPickInitialTab] = useState(false);
  const [onboardingThemeSaved, setOnboardingThemeSaved] = useState(false);

  const userPerms = (currentUser?.permissions || []) as Permission[];
  const canManageUsers = hasPermission(userPerms, 'users:manage');
  const canEditProfile = hasPermission(userPerms, 'profile:write');
  const canEditLinks = hasAnyPermission(userPerms, 'links:write', 'links:style', 'links:images');
  const canEditTheme = hasPermission(userPerms, 'theme:write');
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
      case 'access':    return true;
      case 'analytics': return canViewAnalytics;
      case 'privacy':   return canEditCompliance;
      case 'txt':       return canEditCompliance;
      default:          return false;
    }
  });

  // Keep activeTab in sync when permission set changes (e.g. after login)
  useEffect(() => {
    if (visibleTabs.length === 0) return;

    if (currentUser && !didPickInitialTab) {
      const preferred = visibleTabs.find(tab => tab.value === "profile") || visibleTabs[0];
      setActiveTab(preferred.value);
      setDidPickInitialTab(true);
      return;
    }

    if (!visibleTabs.some(t => t.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, didPickInitialTab]);

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
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="admin-topbar">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="admin-status-dot" />
              <span className="admin-kicker">Self-hosted dashboard</span>
              {appVersion && <span className="admin-version">v{appVersion}</span>}
            </div>
            <h1 className="admin-title">OrbitPage Admin</h1>
            <p className="admin-subtitle">
              Manage page content, theme, security, and analytics from one workspace.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              className="admin-action w-full sm:w-auto"
              variant="outline"
              size="sm"
              onClick={() => setOnboardingReplayKey(key => key + 1)}
            >
              <HelpCircle className="h-4 w-4" />
              Guide
            </Button>
            <a href={withBasePath('/')} target="_blank" rel="noopener noreferrer" data-onboarding="public-page">
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
            detail={metrics.ctaClicks > 0 ? `${metrics.ctaClicks} CTA clicks` : "Built-in tracking"}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Page"
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
                <TabsTrigger key={value} value={value} className="admin-tab" data-onboarding={`${value}-tab`}>
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
                  onStartOnboarding={() => setOnboardingReplayKey(key => key + 1)}
                  onAdminOnboardingEnabledChange={(enabled) => {
                    void onProfileUpdate({ ...profile, adminOnboardingEnabled: enabled });
                  }}
                />
              </div>
              <aside className="admin-side-panel admin-checklist-panel">
                <PanelHeader icon={User} title="Page checklist" />
                <ChecklistItem checked={Boolean(profile.name?.trim())} label="Name or brand is set" />
                <ChecklistItem checked={Boolean(profile.bio?.trim())} label="Description is set" />
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
              onThemeChange={handleThemeSave}
              onThemePreview={(nextTheme) => applyTheme(nextTheme)}
            />
          </TabsContent>

          <TabsContent value="access" className="admin-tab-content">
            <div className="admin-single-column space-y-6" data-onboarding="access-section">
              {canManageUsers && <UserManager />}
              {canManageUsers && <BackupManager />}
              <PasswordManager />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="admin-tab-content">
            <div className="admin-analytics-grid">
              <section className="admin-panel" data-onboarding="analytics-section">
                <PanelHeader icon={BarChart2} title="Click analytics" />
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <StatusTile label="Total clicks" value={String(metrics.totalClicks)} />
                  <StatusTile label="Tracked items" value={String(metrics.totalLinks)} />
                  <StatusTile label="CTA clicks" value={String(metrics.ctaClicks)} />
                  <StatusTile label="Smart CTAs" value={String(metrics.ctaLinks)} />
                </div>
                <ClickAnalyticsChart links={links} />
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <PanelHeader icon={MousePointerClick} title="CTA performance" />
                  {metrics.ctaPerformance.length > 0 ? (
                    <div className="space-y-2">
                      {metrics.ctaPerformance.map((link) => (
                        <div key={link.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{link.title || 'Untitled CTA'}</p>
                            <p className="text-xs text-slate-500">{ctaActionLabels[link.ctaAction || 'book']}</p>
                          </div>
                          <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            {link.ctaClicks ?? 0} clicks
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-600">
                      Smart CTA clicks will appear here separately from normal link clicks.
                    </p>
                  )}
                </div>
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
        </Tabs>

        <AdminOnboarding
          key={onboardingReplayKey}
          activeTab={activeTab}
          visibleTabs={visibleTabs.map(tab => tab.value)}
          onSelectTab={setActiveTab}
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
                <span>Demo Mode</span>
              </div>
              <p>
                This instance is automatically reset every 5 minutes. Any changes made during the demo will be lost after the reset. Any users created during the demo will be removed. Changing the admin password is disabled. Editing privacy settings and TXT files, including Privacy Policy, Cookie Policy, Consent Management, crawler files, and related compliance configuration, is disabled.
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
            <a href="https://github.com/paoloronco/OrbitPage" target="_blank" rel="noopener noreferrer">
              OrbitPage
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



