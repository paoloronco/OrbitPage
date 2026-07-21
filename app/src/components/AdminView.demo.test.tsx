import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  backupProps: [] as Array<Record<string, unknown>>,
  privacyProps: [] as Array<Record<string, unknown>>,
  publishProps: [] as Array<Record<string, unknown>>,
  previewProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/config', () => ({
  DEMO_MODE: true,
}));

vi.mock('@/lib/api-client', () => ({
  isIntegratedHostedSurface: () => false,
  isSaasMode: () => false,
  utilityApi: {
    getHealth: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  logout: vi.fn(),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ProfileSection', () => ({ ProfileSection: () => <div>ProfileSection</div> }));
vi.mock('./LinkManager', () => ({ LinkManager: () => <div>LinkManager</div> }));
vi.mock('./ThemeCustomizer', () => ({ ThemeCustomizer: () => <div>ThemeCustomizer</div> }));
vi.mock('./LivePreview', () => ({
  PreviewDeviceToggle: () => <div>PreviewDeviceToggle</div>,
  LivePreview: (props: Record<string, unknown>) => {
    mockState.previewProps.push(props);
    return <div>LivePreview</div>;
  },
}));
vi.mock('./ClickAnalyticsChart', () => ({ ClickAnalyticsChart: () => <div>ClickAnalyticsChart</div> }));
vi.mock('./PasswordManager', () => ({ PasswordManager: () => <div>PasswordManager</div> }));
vi.mock('./UserManager', () => ({ UserManager: () => <div>UserManager</div> }));
vi.mock('./BackupManager', () => ({
  BackupManager: (props: Record<string, unknown>) => {
    mockState.backupProps.push(props);
    return <div>BackupManager</div>;
  },
}));
vi.mock('./PrivacySettings', () => ({
  PrivacySettings: (props: Record<string, unknown>) => {
    mockState.privacyProps.push(props);
    return <div>PrivacySettings</div>;
  },
}));
vi.mock('./PublishTools', () => ({
  PublishTools: (props: Record<string, unknown>) => {
    mockState.publishProps.push(props);
    return <div>Publish tools: QR, Sitemap and TXT files</div>;
  },
}));

import { AdminView } from './AdminView';
import { defaultTheme } from '@/lib/theme';

const allPermissions = [
  'links:write',
  'links:style',
  'links:images',
  'theme:write',
  'profile:write',
  'analytics:read',
  'compliance:write',
  'users:manage',
] as const;

describe('AdminView demo mode', () => {
  it('shows a persistent footer notice and makes compliance tools read-only', () => {
    vi.stubGlobal('__APP_VERSION__', '4.6.0');

    const html = renderToStaticMarkup(
      <AdminView
        profile={{
          name: 'Demo',
          bio: 'Demo profile',
          avatar: '',
          privacyPolicyUrl: '/privacy',
          cookiePolicyUrl: '/cookies',
        }}
        links={[]}
        theme={defaultTheme}
        currentUser={{ username: 'admin', role: 'admin', permissions: [...allPermissions] }}
        onProfileUpdate={vi.fn()}
        onLinksUpdate={vi.fn()}
        onThemeChange={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(html).toContain('Demo Mode');
    expect(html).toContain('automatically reset every 5 minutes');
    expect(html).toContain('Any users created during the demo will be removed');
    expect(html).toContain('Changing the admin password is disabled');
    expect(html).toContain('Editing privacy settings');
    expect(html).toContain('TXT files');
    expect(mockState.privacyProps[0]).toMatchObject({ readOnly: true });
    expect(mockState.publishProps[0]).toMatchObject({ readOnly: true, canUseQr: true, canUseDiscovery: true });
    expect(mockState.previewProps).toHaveLength(2);
    expect(mockState.previewProps[0]).toMatchObject({ publicPageHref: '/' });
    expect(html).toContain('Admin access');
    expect(html).toContain('admin-dashboard-shell');
    expect(html).toContain('admin-dashboard-sidebar');
    expect(html).toContain('Self-hosted workspace');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Page checklist');
    expect(html).toContain('Getting started · login 1 of 3');
    expect(html).toContain('role="progressbar"');
  });

  it('hides standalone session details in the hosted SaaS admin', () => {
    vi.stubGlobal('__APP_VERSION__', '4.7.0');

    const html = renderToStaticMarkup(
      <AdminView
        profile={{ name: 'Hosted', bio: '', avatar: '' }}
        links={[]}
        theme={defaultTheme}
        currentUser={{ username: 'admin', role: 'admin', permissions: [...allPermissions] }}
        saasUsage={{ blocks: 0, storageBytes: 0 }}
        onProfileUpdate={vi.fn()}
        onLinksUpdate={vi.fn()}
        onThemeChange={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(html).not.toContain('Admin access');
    expect(html).not.toContain('Encrypted session token');
    expect(html).not.toContain('PasswordManager');
    expect(html).not.toContain('Logout');
    expect(html).toContain('Backup');
    expect(mockState.backupProps.at(-1)).toMatchObject({ hosted: true });
    expect(html).toContain('admin-metrics-saas');
    expect(html).not.toContain('admin-dashboard-sidebar');
    expect(html).not.toContain('data-onboarding="public-page"');
    expect(html).toContain('data-testid="managed-analytics"');
    expect(html).toContain('data-testid="google-analytics-settings"');
    expect(html).toContain('id="ga-id"');
  });

  it('marks prospect sessions as read-only while keeping the hosted sections visible', () => {
    vi.stubGlobal('__APP_VERSION__', '4.7.0');

    const html = renderToStaticMarkup(
      <AdminView
        profile={{ name: 'Prospect demo', bio: 'Preview', avatar: '' }}
        links={[]}
        theme={defaultTheme}
        currentUser={{ username: 'demo', role: 'admin', permissions: [...allPermissions], readOnly: true }}
        saasUsage={{ blocks: 0, storageBytes: 0 }}
        onProfileUpdate={vi.fn()}
        onLinksUpdate={vi.fn()}
        onThemeChange={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(html).toContain('Prospect demo account');
    expect(html).toContain('Read-only access');
    expect(html).toContain('admin-readonly-stage');
    expect(html).toContain('inert=""');
    expect(html).toContain('ProfileSection');
    expect(html).toContain('LinkManager');
    expect(html).not.toContain('>Guide<');
    expect(html).not.toContain('Page checklist');
  });
});



