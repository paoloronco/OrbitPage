import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AdminOnboarding } from './AdminOnboarding';

describe('AdminOnboarding', () => {
  it('renders a skippable animated guide with workflow steps', () => {
    const html = renderToStaticMarkup(
      <AdminOnboarding
        activeTab="profile"
        visibleTabs={['profile', 'links', 'theme']}
        onSelectTab={() => undefined}
        forceOpen
      />,
    );

    expect(html).toContain('Start guide');
    expect(html).toContain('Skip');
    expect(html).toContain('Profile first');
    expect(html).toContain('Add your first card');
    expect(html).toContain('Shape the look');
    expect(html).toContain('aria-label="OrbitPage onboarding guide"');
  });
});
