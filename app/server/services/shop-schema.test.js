import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createShopSchemas, SHOP_CURRENCIES } from '../../packages/shop/schema.js';
import { renderShopDescription } from '../../packages/shop/description.js';
import { shopPurchasePresentation, renderShopHtml, renderShopMarkdown } from '../../packages/shop/render.js';
import { buildShopBuyerEmail } from '../../packages/shop/email.js';

const { shopAppearanceInputSchema: appearance, shopProductInputSchema: product, normalizeShopAppearance } =
  createShopSchemas(z, value => /^\/uploads\/[a-zA-Z0-9._-]+$/.test(value));

describe('self-hosted shared Shop contracts', () => {
  it('validates supported currencies and renders prices, metadata and receipts consistently', () => {
    const fixture = { productId: 'guide', type: 'digital', title: 'Guide', description: 'Download details', priceCents: 1250 };
    expect(appearance.parse({}).currency).toBe('eur');
    expect(product.parse(fixture).currency).toBe('eur');
    for (const currency of SHOP_CURRENCIES) {
      expect(new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits).toBe(2);
      const settings = appearance.parse({ currency });
      const input = { username: 'studio', apiBaseUrl: '/api/shop', newsletterEndpoint: '/newsletter', coverUrlPrefix: '/covers/', title: 'Studio', canonicalUrl: 'https://example.test/shop', appearance: settings, products: [product.parse({ ...fixture, currency })] };
      const html = renderShopHtml(input);
      expect(html).toContain(`"priceCurrency":"${currency.toUpperCase()}"`);
      const price = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(12.5);
      expect(html).toContain(price);
      expect(renderShopMarkdown(input)).toContain(price);
      expect(buildShopBuyerEmail({ order: { orderId: 'order', productType: 'digital', productTitle: 'Guide', amountTotal: 1250, currency }, deliveryUrl: 'https://example.test/download' }).text).toContain(price);
    }
    for (const currency of ['jpy', 'usd<script>', 'xyz', 'USD']) {
      expect(appearance.safeParse({ currency }).success).toBe(false);
      expect(product.safeParse({ ...fixture, currency }).success).toBe(false);
    }
  });
  it('shows only configured policies in a live Shop and omits them from fictional previews', () => {
    const input = { username: 'studio', title: 'Studio', canonicalUrl: 'https://studio.example.test/shop', appearance: normalizeShopAppearance({}), products: [], apiBaseUrl: '', newsletterEndpoint: '', coverUrlPrefix: '' };
    expect(renderShopHtml(input)).not.toContain('/shop/legal/');
    const configured = { ...input, appearance: normalizeShopAppearance({ termsText: 'Seller terms', privacyUrl: 'https://studio.example.test/privacy' }) };
    expect(renderShopHtml(configured)).toContain('href="https://studio.example.test/shop/legal#terms"');
    expect(renderShopHtml(configured)).toContain('href="https://studio.example.test/privacy"');
    expect(renderShopHtml(configured)).not.toContain('/shop/legal/privacy');
    expect(renderShopHtml({ ...input, previewOnly: true })).not.toMatch(/href="[^"]*\/shop\/legal/);
    expect(renderShopHtml({ ...input, scriptNonce: 'fixture-nonce' })).toContain('<script type="module" nonce="fixture-nonce">');
    expect(renderShopHtml({ ...input, scriptNonce: '\"<test>' })).toContain('nonce="&quot;&lt;test&gt;"');
  });

  it('uses the displayed product covers as absolute structured-data images', () => {
    const fixture = { productId: 'guide', title: 'Guide', description: 'Download details', type: 'digital', priceCents: 1250, coverKey: 'guide.webp', cardStyle: {} };
    const input = { title: 'Studio', canonicalUrl: 'https://studio.example.test/shop', appearance: normalizeShopAppearance({}), products: [fixture], coverUrlPrefix: '/covers/', apiBaseUrl: '', newsletterEndpoint: '' };
    for (const [overrides, image] of [
      [{}, 'https://studio.example.test/covers/guide.webp'],
      [{ previewOnly: true, previewCoverUrls: { guide: '/showcase/guide.webp' } }, 'https://studio.example.test/showcase/guide.webp'],
      [{ products: [{ ...fixture, coverKey: null }] }, undefined],
    ]) {
      const html = renderShopHtml({ ...input, ...overrides });
      const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
      expect(data.itemListElement[0].item.image).toBe(image);
      if (image) expect(html).toContain(`src="${new URL(image).pathname}"`);
    }
  });

  it.each(['', '+39 011 1234567'])('shows only the explicitly configured seller phone in Shop and order emails (%s)', phone => {
    const settings = normalizeShopAppearance({ sellerName: 'Fictional Studio', sellerPhone: phone });
    const html = renderShopHtml({ username: 'studio', title: 'Studio', canonicalUrl: 'https://studio.example.test/shop', appearance: settings, products: [], apiBaseUrl: '/api/shop', newsletterEndpoint: '/api/newsletter', coverUrlPrefix: '/shop/covers/' });
    const email = buildShopBuyerEmail({ order: { orderId: 'order-fixture', productTitle: 'Guide', productType: 'digital', amountTotal: 1000, currency: 'eur', buyerEmail: 'buyer@example.test', sellerName: settings.sellerName, sellerPhone: settings.sellerPhone }, deliveryUrl: 'https://studio.example.test/download' });
    expect(html.includes('<dt>Phone</dt>')).toBe(Boolean(phone));
    expect(email.text.includes('Seller phone:')).toBe(Boolean(phone));
    if (phone) {
      expect(html).toContain(phone);
      expect(email.text).toContain(phone);
      expect(email.html).toContain(phone);
    } else {
      expect(email.html).not.toContain('Seller phone');
    }
  });
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
    expect(defaults.productCardSize).toBe('medium');
    expect(defaults.sellerNoticeAddon).toBe('');
    expect(defaults.digitalContentConsentAddon).toBe('');
    expect(defaults.logoUrl).toBe(''); expect(defaults.sellerSelfCertified).toBe(false);
    expect(normalizeShopAppearance({ description: 'Prodotti digitali e servizi, acquistabili in modo sicuro.' })).toMatchObject({ locale: 'it', description: '' });
    expect(appearance.parse({ backLinkDescription: 'Old text' }).backLinkDescription).toBe('');
  });
  it('accepts only self-hosted uploaded logos and rejects unsafe text and unknown fields', () => {
    expect(appearance.parse({ logoUrl: '/uploads/logo.png' }).logoUrl).toBe('/uploads/logo.png');
    for (const input of [{ logoUrl: 'https://example.test/logo.png' }, { logoUrl: '/uploads/../secret' },
      { logoUrl: '/media/tenants/t/pages/p/upload/logo.png' }, { titleFontFamily: '</style><script>' },
      { stripeSecretKey: 'never-public' }, { termsUrl: 'javascript:alert(1)' },
      { productCardSize: 'huge' }, { sellerNoticeAddon: 'x'.repeat(501) }]) {
      expect(appearance.safeParse(input).success).toBe(false);
    }
    expect(renderShopDescription('<img src=x onerror=alert(1)>\n**Bold**')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p><p><strong>Bold</strong></p>');
  });
  it('keeps server-side bounds for products, services and Checkout fields', () => {
    const fixture = { type: 'digital', title: 'Fictional file', description: 'Safe text', priceCents: 2000 };
    expect(product.parse(fixture)).toMatchObject({ active: false, removedFileIds: [], intakeQuestions: [], cardStyle: { alignment: 'inherit' } });
    for (const input of [{ ...fixture, priceCents: 99 }, { ...fixture, priceCents: 1.5 },
      { ...fixture, type: 'service', active: true }, { ...fixture, removedFileIds: ['../../file'] },
      { ...fixture, bookingUrl: 'https://user:password@example.test' }]) {
      expect(product.safeParse(input).success).toBe(false);
    }
    const field = { key: 'project', label: 'Project', type: 'text', required: true };
    expect(appearance.safeParse({ checkout: { customFields: [field, field] } }).success).toBe(false);
  });
});
