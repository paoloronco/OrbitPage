import { describe, expect, it } from 'vitest';
import { normalizePrivacyController } from './privacy-controller';

describe('normalizePrivacyController', () => {
  it('allows the optional controller fields to remain empty', () => {
    expect(normalizePrivacyController({
      name: '  ',
      email: '',
      country: 'Italy',
      address: '',
    })).toEqual({ controller: undefined, error: null });
  });

  it('requires name and email as a pair', () => {
    expect(normalizePrivacyController({
      name: 'Studio Rossi',
      email: '',
    })).toEqual({ controller: undefined, error: 'incomplete' });
    expect(normalizePrivacyController({
      name: '',
      email: 'privacy@example.com',
    })).toEqual({ controller: undefined, error: 'incomplete' });
  });

  it('normalizes a complete controller', () => {
    expect(normalizePrivacyController({
      name: '  Studio Rossi ',
      email: ' privacy@example.com ',
      country: ' Italy ',
      address: ' Via Roma 1 ',
    })).toEqual({
      controller: {
        name: 'Studio Rossi',
        email: 'privacy@example.com',
        country: 'Italy',
        address: 'Via Roma 1',
      },
      error: null,
    });
  });

  it('rejects malformed email addresses', () => {
    expect(normalizePrivacyController({
      name: 'Studio Rossi',
      email: 'privacy@localhost',
    })).toEqual({ controller: undefined, error: 'invalid-email' });
  });
});
