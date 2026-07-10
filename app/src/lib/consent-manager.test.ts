import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('consentManager Google Consent Mode v2', () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    const win = { dataLayer: [] };

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
});
