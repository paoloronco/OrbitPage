import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConsentScope, withTenantBasePath } from './base-path';

afterEach(() => vi.unstubAllGlobals());

describe('tenant public paths', () => {
  it('keeps policies at orbitpage.net/slug when rendered from a subpage', () => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: '/studio/services',
      __ORBITPAGE_CONSENT_SCOPE__: 'studio',
      location: { pathname: '/studio/services' },
    });
    expect(getConsentScope()).toBe('studio');
    expect(withTenantBasePath('/privacy')).toBe('/studio/privacy');
  });

  it('uses root paths on a custom domain while retaining the consent scope', () => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: '',
      __ORBITPAGE_CONSENT_SCOPE__: 'studio',
      location: { pathname: '/services' },
    });
    expect(getConsentScope()).toBe('studio');
    expect(withTenantBasePath('/cookies')).toBe('/cookies');
  });
});
