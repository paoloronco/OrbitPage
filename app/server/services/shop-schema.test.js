import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createShopSchemas } from '../../packages/shop/schema.js';
import { renderShopDescription } from '../../packages/shop/description.js';
import { shopPurchasePresentation } from '../../packages/shop/render.js';

const { shopAppearanceInputSchema: appearance, shopProductInputSchema: product, normalizeShopAppearance } =
  createShopSchemas(z, value => /^\/uploads\/[a-zA-Z0-9._-]+$/.test(value));

describe('self-hosted shared Shop contracts', () => {
  it('shares the merchant theme with buyer pages without exposing private configuration', () => {
    const settings = normalizeShopAppearance({ title: 'Studio', logoUrl: '/uploads/logo.png', sellerEmail: 'studio@example.test' });
    const result = shopPurchasePresentation({ appearance: settings, shopUrl: 'https://studio.example.test/shop', theme: { background: '#101a2c', fontFamily: 'Georgia, serif', privateField: 'must-not-leak' } });
    expect(result).toMatchObject({ name: 'Studio', url: 'https://studio.example.test/shop', logoUrl: 'https://studio.example.test/uploads/logo.png', supportEmail: 'studio@example.test' });
    expect(result.design).toMatchObject({ pageBackground: '#101a2c', fontFamily: 'Georgia, serif' });
    expect(Object.keys(result).sort()).toEqual(['cardEffect', 'cardOpacity', 'design', 'logoUrl', 'name', 'supportEmail', 'url']);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });
  it('preserves complete defaults and legacy appearance normalization', () => {
    const defaults = normalizeShopAppearance(null);
    expect(defaults.checkout).toEqual({ phone: false, billingAddress: 'auto', businessName: 'off', taxId: 'off', customFields: [] });
    expect(defaults.logoUrl).toBe(''); expect(defaults.sellerSelfCertified).toBe(false);
    expect(normalizeShopAppearance({ description: 'Prodotti digitali e servizi, acquistabili in modo sicuro.' })).toMatchObject({ locale: 'it', description: '' });
    expect(appearance.parse({ backLinkDescription: 'Old text' }).backLinkDescription).toBe('');
  });
  it('accepts only self-hosted uploaded logos and rejects unsafe text and unknown fields', () => {
    expect(appearance.parse({ logoUrl: '/uploads/logo.png' }).logoUrl).toBe('/uploads/logo.png');
    for (const input of [{ logoUrl: 'https://example.test/logo.png' }, { logoUrl: '/uploads/../secret' },
      { logoUrl: '/media/tenants/t/pages/p/upload/logo.png' }, { titleFontFamily: '</style><script>' },
      { stripeSecretKey: 'never-public' }, { termsUrl: 'javascript:alert(1)' }]) {
      expect(appearance.safeParse(input).success).toBe(false);
    }
    expect(renderShopDescription('<img src=x onerror=alert(1)>\n**Bold**')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p><p><strong>Bold</strong></p>');
  });
  it('keeps server-side bounds for products, services and Checkout fields', () => {
    const fixture = { type: 'digital', title: 'Fictional file', description: 'Safe text', priceCents: 2000 };
    expect(product.parse(fixture)).toMatchObject({ active: false, removedFileIds: [], intakeQuestions: [], cardStyle: { alignment: 'inherit' } });
    for (const input of [{ ...fixture, priceCents: 99 }, { ...fixture, priceCents: 1.5 },
      { ...fixture, type: 'service' }, { ...fixture, removedFileIds: ['../../file'] },
      { ...fixture, bookingUrl: 'https://user:password@example.test' }]) {
      expect(product.safeParse(input).success).toBe(false);
    }
    const field = { key: 'project', label: 'Project', type: 'text', required: true };
    expect(appearance.safeParse({ checkout: { customFields: [field, field] } }).success).toBe(false);
  });
});
