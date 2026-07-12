import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hardcodedConfig = {
  mode: 'hardcoded',
  enabled: true,
  hardcoded: {
    policyVersion: '1.0',
    consentExpiryDays: 365,
    reshowOnVersionChange: true,
  },
} as const;

const readConsentCalls = () => {
  const dataLayer = (window as any).dataLayer as unknown[];
  return dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
};

const findConsentCall = (type: 'default' | 'update') => {
  return readConsentCalls().find((entry) => entry[0] === 'consent' && entry[1] === type);
};

const builderConfig = (
  provider: 'iubenda' | 'cookiebot' | 'cookieyes' | 'onetrust' | 'custom',
  providerConfig: Record<string, string> = {},
) => ({
  mode: 'builder',
  enabled: true,
  builder: { provider, providerConfig, reopenSelector: '' },
} as const);

describe('consentManager Google Consent Mode v2', () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    const win = Object.assign(new EventTarget(), { dataLayer: [] as unknown[] });

    Object.defineProperty(globalThis, 'window', {
      value: win,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: {
        getElementById: () => null,
        createElement: () => ({ setAttribute: () => undefined }),
        head: { appendChild: () => undefined },
        body: { appendChild: () => undefined },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets denied Consent Mode v2 defaults before analytics consent exists', async () => {
    const { consentManager } = await import('./consent-manager');

    consentManager.init(hardcodedConfig as any);

    const defaultCall = findConsentCall('default');
    expect(defaultCall).toBeDefined();
    expect(defaultCall?.[2]).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 2000,
    });
  });

  it('updates Consent Mode v2 to granted when all consent is accepted', async () => {
    const { consentManager } = await import('./consent-manager');

    consentManager.init(hardcodedConfig as any);
    consentManager.acceptAll('banner');

    const updateCall = findConsentCall('update');
    expect(updateCall).toBeDefined();
    expect(updateCall?.[2]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    expect(updateCall?.[2]).not.toHaveProperty('wait_for_update');
  });

  it('updates Consent Mode v2 to denied when optional consent is rejected', async () => {
    const { consentManager } = await import('./consent-manager');

    consentManager.init(hardcodedConfig as any);
    consentManager.rejectAll('banner');

    const updateCall = findConsentCall('update');
    expect(updateCall).toBeDefined();
    expect(updateCall?.[2]).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('uses a persisted CookieYes decision immediately on returning visits', async () => {
    const win = window as any;
    win.getCkyConsent = () => ({ categories: { accepted: ['functional', 'analytics'] } });
    const { consentManager } = await import('./consent-manager');

    consentManager.init(builderConfig('cookieyes', { scriptId: 'site-id' }) as any);
    (consentManager as any)._wireCookieYesConsentEvents();

    expect(consentManager.isGranted('preferences')).toBe(true);
    expect(consentManager.isGranted('analytics')).toBe(true);
    expect(consentManager.isGranted('marketing')).toBe(false);
  });

  it('uses persisted Cookiebot consent and supports revocation', async () => {
    vi.useFakeTimers();
    const win = window as any;
    win.Cookiebot = { consent: { preferences: true, statistics: true, marketing: false } };
    const { consentManager } = await import('./consent-manager');

    consentManager.init(builderConfig('cookiebot', { scriptId: 'cbid' }) as any);
    (consentManager as any)._wireCookiebotConsentEvents();
    expect(consentManager.isGranted('analytics')).toBe(true);

    win.Cookiebot.consent.statistics = false;
    win.dispatchEvent(new Event('CookiebotOnDecline'));
    expect(consentManager.isGranted('analytics')).toBe(false);
  });

  it('preserves granular GCM v2 advertising signals from an external CMP update', async () => {
    const win = window as any;
    win.dataLayer.push(['consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      personalization_storage: 'denied',
      security_storage: 'granted',
    }]);
    const { consentManager } = await import('./consent-manager');

    consentManager.init(builderConfig('custom') as any);
    consentManager.injectBuilderScript();

    expect(consentManager.isGranted('analytics')).toBe(true);
    expect(consentManager.isGranted('preferences')).toBe(true);
    expect(consentManager.isGranted('marketing')).toBe(false);
    const updateCalls = readConsentCalls().filter((entry) => entry[0] === 'consent' && entry[1] === 'update');
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.[2]).toMatchObject({
      ad_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('installs a non-recursive OneTrust wrapper and restores persisted consent', async () => {
    const appended: Array<Record<string, unknown>> = [];
    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: () => ({
          setAttribute(name: string, value: string) { (this as Record<string, unknown>)[name] = value; },
        }),
        head: { appendChild: (node: Record<string, unknown>) => appended.push(node) },
      },
      configurable: true,
    });
    const win = window as any;
    win.OnetrustActiveGroups = ',C0001,C0002,C0003,';
    const { consentManager } = await import('./consent-manager');

    consentManager.init(builderConfig('onetrust', { siteId: 'domain-script-id' }) as any);
    (consentManager as any)._injectOneTrust({ siteId: 'domain-script-id' });

    expect(appended).toHaveLength(1);
    expect(appended[0]).not.toHaveProperty('text');
    expect(() => win.OptanonWrapper()).not.toThrow();
    expect(consentManager.isGranted('analytics')).toBe(true);
    expect(consentManager.isGranted('preferences')).toBe(true);
  });
});
