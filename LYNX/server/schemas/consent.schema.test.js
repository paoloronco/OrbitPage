import { describe, expect, it } from 'vitest';

import { ConsentConfigBodySchema } from './consent.schema.js';

describe('consent schemas', () => {
  it('normalizes a minimal disabled consent config', () => {
    const result = ConsentConfigBodySchema.parse({
      mode: 'disabled',
      enabled: false,
    });

    expect(result).toMatchObject({
      mode: 'disabled',
      enabled: false,
      legalPolicies: {
        showFooterLinks: false,
        privacyPolicy: { mode: 'external' },
        cookiePolicy: { mode: 'external' },
      },
      hardcoded: {
        policyVersion: '1.0',
        layout: 'bottom-bar',
      },
      builder: {
        provider: 'custom',
      },
    });
  });

  it('rejects unsupported external consent providers', () => {
    expect(() => ConsentConfigBodySchema.parse({
      mode: 'builder',
      enabled: true,
      builder: {
        provider: 'unknown',
      },
    })).toThrow();
  });
});
