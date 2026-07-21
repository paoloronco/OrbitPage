import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AdminOnboarding } from './AdminOnboarding';

describe('AdminOnboarding', () => {
  it('renders a skippable guided setup with the full admin route', () => {
    const html = renderToStaticMarkup(
      <AdminOnboarding
        activeTab="profile"
        visibleTabs={['profile', 'content', 'theme', 'analytics', 'access', 'privacy', 'txt']}
        onSelectTab={() => undefined}
        forceOpen
        repeatEnabled
        profile={{ name: '', bio: '' }}
        savedLinkCount={0}
        themeSaved={false}
      />,
    );

    expect(html).toContain('Start setup');
    expect(html).toContain('Skip for now');
    expect(html).toContain('Page profile');
    expect(html).toContain('First card');
    expect(html).toContain('Theme save');
    expect(html).toContain('Analytics');
    expect(html).toContain('Access');
    expect(html).toContain('Privacy');
    expect(html).toContain('TXT');
    expect(html).toContain('Public check');
    expect(html).toContain('enabled at every login');
    expect(html).toContain('aria-label="OrbitPage onboarding guide"');
  });
});
