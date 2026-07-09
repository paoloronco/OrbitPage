import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  privacyProps: [] as Array<Record<string, unknown>>,
  textFileProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/config', () => ({
  DEMO_MODE: true,
}));

vi.mock('@/lib/api-client', () => ({
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
vi.mock('./LivePreview', () => ({ LivePreview: () => <div>LivePreview</div> }));
vi.mock('./ClickAnalyticsChart', () => ({ ClickAnalyticsChart: () => <div>ClickAnalyticsChart</div> }));
vi.mock('./PasswordManager', () => ({ PasswordManager: () => <div>PasswordManager</div> }));
vi.mock('./UserManager', () => ({ UserManager: () => <div>UserManager</div> }));
vi.mock('./PrivacySettings', () => ({
  PrivacySettings: (props: Record<string, unknown>) => {
    mockState.privacyProps.push(props);
    return <div>PrivacySettings</div>;
  },
}));
vi.mock('./TextFileManager', () => ({
  TextFileManager: (props: Record<string, unknown>) => {
    mockState.textFileProps.push(props);
    return <div>TextFileManager</div>;
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
    vi.stubGlobal('__APP_VERSION__', '4.3.28');

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
    expect(mockState.textFileProps[0]).toMatchObject({ readOnly: true });
  });
});



