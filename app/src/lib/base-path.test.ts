import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConsentScope, withPageRootPath, withRuntimeAssetPath, withTenantBasePath } from './base-path';

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

  it('keeps internal navigation at the tenant root from hosted subpages', () => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: '/studio/services',
      __ORBITPAGE_CONSENT_SCOPE__: 'studio',
      location: { pathname: '/studio/services' },
    });
    expect(withPageRootPath('/menu')).toBe('/studio/menu');
    expect(withPageRootPath('/shop')).toBe('/studio/shop');
  });

  it('keeps internal navigation inside a self-hosted mount path', () => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: '/orbitpage',
      location: { pathname: '/orbitpage/services' },
    });
    expect(withPageRootPath('/links')).toBe('/orbitpage/links');
  });

  it.each([false, true])('keeps public navigation independent of dashboard language with hosted snapshot=%s', (hosted) => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: '/orbitpage',
      ...(hosted ? { __ORBITPAGE_STATIC_SNAPSHOT__: {} } : {}),
      location: { pathname: '/orbitpage/it-IT/dashboard/account/general' },
    });
    expect(withPageRootPath('/')).toBe('/orbitpage/');
    expect(withPageRootPath('/menu')).toBe('/orbitpage/menu');
    expect(withTenantBasePath('/privacy')).toBe('/orbitpage/privacy');
  });

  it.each(['', '/studio', '/studio/services'])('loads shared brand files from the hosted runtime at %s', (basePath) => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: basePath,
      __ORBITPAGE_STATIC_SNAPSHOT__: {},
      __ORBITPAGE_API_BASE__: 'https://orbitpage.com/api/orbitpage',
      location: { pathname: basePath || '/' },
    });
    expect(withRuntimeAssetPath('/brand/orbitpage-mark-192.png'))
      .toBe('/orbitpage-runtime/brand/orbitpage-mark-192.png');
  });

  it.each(['', '/orbitpage'])('keeps self-hosted snapshot assets inside the mount path %s', (basePath) => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: basePath,
      __ORBITPAGE_STATIC_SNAPSHOT__: { page: {} },
      location: { pathname: `${basePath}/services` },
    });
    for (const asset of ['/brand/orbitpage-mark-192.png', '/brand/orbitpage-favicon-48.png', '/block-icons/star.svg']) {
      expect(withRuntimeAssetPath(asset)).toBe(`${basePath}${asset}`);
    }
  });

  it('retains the configured mount path for self-hosted brand files', () => {
    vi.stubGlobal('window', {
      __ORBITPAGE_BASE_PATH__: '/orbitpage',
      location: { pathname: '/orbitpage/admin' },
    });
    expect(withRuntimeAssetPath('/brand/orbitpage-mark-192.png'))
      .toBe('/orbitpage/brand/orbitpage-mark-192.png');
  });
});
