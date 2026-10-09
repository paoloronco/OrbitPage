import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { createShopSchemas } from '../packages/shop/schema.js';
import { renderShopHtml } from '../packages/shop/render.js';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

test.use({ locale: 'it-IT' });

test('the shared storefront grid fills three, two or one columns according to available space', async ({ page }, testInfo) => {
  const { normalizeShopAppearance, normalizeShopProductCardStyle } = createShopSchemas(z, () => false);
  const products = Array.from({ length: 4 }, (_, index) => ({ productId: `print-${index}`, type: 'digital' as const, title: `Illustration ${index + 1}`, description: 'Printable artwork for your studio.', priceCents: 1000, cardStyle: normalizeShopProductCardStyle({}), file: { filename: 'artwork.pdf' } }));
  const cover = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="230"%3E%3Crect width="400" height="230" fill="%23215d94"/%3E%3C/svg%3E';
  await page.route('**/*', route => route.abort());
  const html = (layout: 'grid' | 'list') => renderShopHtml({ username: 'studio', title: 'Studio', canonicalUrl: 'https://example.invalid/shop', products, appearance: normalizeShopAppearance({ title: 'Studio prints', layout, sellerName: 'Studio Seller', sellerEmail: 'seller@example.invalid' }), previewOnly: true, previewCoverUrls: Object.fromEntries(products.map(product => [product.productId, cover])), apiBaseUrl: '/api/shop', newsletterEndpoint: '/newsletter', coverUrlPrefix: '/covers/' });
  await page.setContent(html('grid'));
  const seller = page.getByRole('region', { name: 'Seller information' });
  await expect(seller).toBeVisible();
  await expect(seller).toContainText('Studio Seller');
  await expect(seller.getByRole('link')).toHaveCount(1);
  await expect(seller.locator('details, summary')).toHaveCount(0);
  await expect(seller).toHaveCSS('border-top-width', '0px');
  expect(await seller.evaluate(element => element.nextElementSibling?.tagName)).toBe('FOOTER');
  const grid = page.locator('.grid');
  for (const [width, columns] of [[1440, 3], [1024, 3], [768, 2], [650, 2], [640, 1], [390, 1], [320, 1]]) {
    await page.setViewportSize({ width, height: 980 });
    await expect.poll(() => grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(columns);
    const geometry = await grid.evaluate(element => ({ width: element.clientWidth, card: element.querySelector('article')!.getBoundingClientRect().width, overflow: element.scrollWidth > element.clientWidth }));
    expect(geometry.card).toBeCloseTo((geometry.width - (columns - 1) * 12) / columns, 0);
    expect(geometry.overflow).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 390) await page.screenshot({ path: testInfo.outputPath(`storefront-grid-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.locator('.shell').evaluate(element => element.style.maxWidth = '560px');
  await expect.poll(() => grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
  await page.setContent(html('list'));
  await expect.poll(() => grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
});

test('the self-hosted Shop requires Compliance, Stripe and SMTP before catalog setup', async ({ page }) => {
  await page.route(/\/api\/shop(?:\?|$)/, async route => {
    const response = await route.fetch();
    const data = await response.json();
    Object.assign(data.shop, { stripeConnected: true, stripeReady: true, stripeLivemode: false });
    await route.fulfill({ response, json: data });
  });
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Shop');
  const shop = page.locator('.orbitpage-selfhosted-shop');
  await shop.getByRole('button', { name: 'Shop settings', exact: true }).click();
  const publish = shop.getByRole('button', { name: 'Publish shop', exact: true });
  await expect(publish).toBeVisible();
  await expect(publish).toBeDisabled();
  await expect(publish).toHaveCSS('opacity', '0.55');
  await publish.locator('..').hover();
  await expect(page.getByRole('tooltip')).toHaveText('Configure Compliance, Email before publishing your Shop.');
  await shop.getByRole('button', { name: 'Stripe', exact: true }).focus();
  await expect(shop.getByRole('region', { name: 'Required Shop setup' })).toHaveCount(0);
  await expect(shop.getByRole('navigation', { name: 'Shop settings sections' })).toBeVisible();
  await expect(shop.getByRole('button', { name: 'Add product', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Public Shop', exact: true })).toHaveAttribute('href', /\/shop$/);
  await shop.getByRole('button', { name: 'Stripe', exact: true }).click();
  await expect(shop.getByLabel('Stripe secret API key')).toHaveAttribute('type', 'password');
  await expect(shop.getByLabel('Stripe webhook endpoint')).toHaveValue(/\/api\/shop\/webhook$/);
  const heading = shop.getByRole('heading', { name: 'Stripe payments are in test mode', exact: true });
  const testMode = heading.getByText('test mode', { exact: true });
  await expect(testMode).toBeVisible();
  await expect(testMode).toHaveCSS('color', 'rgb(180, 83, 9)');
  await expect(testMode).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(testMode).toHaveCSS('border-top-width', '0px');
  await expect(testMode).toHaveCSS('text-transform', 'none');
  await expect(testMode).toHaveCSS('font-size', await heading.evaluate(element => getComputedStyle(element).fontSize));
  await expect(shop.getByRole('link', { name: 'Open shop', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(testMode).toBeVisible();
  await expect(testMode).toHaveCSS('border-top-width', '0px');
  await expect(shop.getByRole('region', { name: 'Required Shop setup' })).toHaveCount(0);
  expect(await shop.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 980 });
    for (const section of ['Shop settings', 'Orders and customers', 'Customers']) {
      if (section === 'Customers') await shop.getByRole('button', { name: 'Orders and customers', exact: true }).click();
      await shop.getByRole('button', { name: section, exact: true }).click();
      const back = shop.getByRole('button', { name: 'Back to shop', exact: true });
      await back.focus();
      await back.press('Enter');
      await expect(shop.getByRole('region', { name: 'Shop preview', exact: true })).toBeVisible();
      await expect(page).toHaveURL(/\/shop\/products$/);
      await expect(shop.getByRole('button', { name: 'Personalize', exact: true })).toBeDisabled();
      await expect(shop.getByRole('button', { name: 'Edit shop logo', exact: true })).toBeDisabled();
      await expect(shop.locator('.shop-view-toolbar').getByRole('button', { name: 'Add product', exact: true })).toBeDisabled();
      await expect(publish).toBeDisabled();
    }
  }
  await page.reload();
  await expect(shop.getByRole('region', { name: 'Shop preview', exact: true })).toBeVisible();
});

test('a confirmed purchase opens themed downloads and appointments without registration and survives refresh', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  const orderId = '11111111-1111-4111-8111-111111111111';
  const expiresAt = '2100-10-08T12:00:00.000Z';
  const paidAt = '2026-10-08T12:00:00.000Z';
  const shop = { name: 'Studio Store', url: '/shop', logoUrl: '/brand/orbitpage-mark.svg', supportEmail: 'studio@example.invalid', cardEffect: 'solid', cardOpacity: 1,
    design: { pageBackground: '#101a2c', pageBackgroundSecondary: '#152442', textColor: '#edf2ff', mutedColor: '#a4b4d1', accentColor: '#86aaff', buttonTextColor: '#101a2c', cardBackground: '#1b2b47', cardTextColor: '#edf2ff', borderColor: '#35486a', cardRadius: 20, fontFamily: 'Inter, sans-serif' } };
  const receipt = { shop, paidAt, orderId, orderNumber: 1, productTitle: 'Photography toolkit', productType: 'digital', amountTotal: 1000, currency: 'eur', downloadable: true,
    files: [{ filename: 'guide.pdf', sizeBytes: 1024 }], downloadCount: 0, maxDownloads: 10, expiresAt, deliveryToken: 'browser-fixture',
    customerPortalUrl: '/shop/customer?access=browser-fixture', intakeQuestions: [], sessionsIncluded: 0, sessionsRemaining: 0 };
  const portal = { shop, customer: { shopName: 'Studio Store', shopUrl: '/shop', supportEmail: 'studio@example.invalid', email: 'buyer@example.invalid' }, bookings: [{ bookingId: 'booking-fixture', orderId, productTitle: 'Studio consultation', status: 'scheduled', startAt: paidAt, endAt: null, meetingUrl: 'https://meeting.example.invalid/studio' }], orders: [
    { ...receipt, paidAt, files: [{ filename: 'guide.pdf', sizeBytes: 1024, url: '/api/shop/download/browser-fixture?file=0' }], downloadsRemaining: 10, deliveryUrl: '/shop/download?token=browser-fixture' },
    { orderId: '22222222-2222-4222-8222-222222222222', productTitle: 'Studio consultation', productType: 'service', paidAt, bookingUrl: 'https://cal.com/studio/consultation', bookingStatus: 'awaiting_booking', sessionsRemaining: 2, sessionsIncluded: 2, intakeQuestions: [{ id: 'goal', prompt: 'What would you like to work on?', required: true }], intakeAnswers: [] as Array<{ questionId: string; answer: string }>, intakeSubmittedAt: null as string | null, fulfillmentText: 'Choose a time for your first session. We will discuss your next photography project.' }
  ] };
  await page.route('**/api/shop/order?*', route => route.fulfill({ json: receipt }));
  await page.route('**/api/shop/delivery/browser-fixture', route => route.fulfill({ json: receipt }));
  await page.route('**/api/shop/customer', async route => {
    expect(route.request().headers()['x-shop-customer-access']).toBe('browser-fixture');
    if (route.request().method() === 'POST') {
      const service = portal.orders[1];
      service.intakeAnswers = route.request().postDataJSON().answers;
      service.intakeSubmittedAt = paidAt;
    }
    await route.fulfill({ json: portal });
  });
  await page.route('**/api/shop/download/browser-fixture?*', route => route.fulfill({ contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="guide.pdf"' }, body: '%PDF-1.7\nbrowser fixture' }));
  await page.goto(`/shop/success?order=${orderId}&session_id=cs_test_browser_fixture`);
  await expect(page.getByRole('heading', { name: 'Your order is ready' })).toBeVisible();
  await expect(page.locator('.shop-success-shell')).toHaveAttribute('lang', 'en-US');
  await expect(page.locator('.shop-success-product')).toContainText('€10.00');
  await expect(page.locator('.shop-success-product')).toContainText('#000001');
  await expect(page.locator('.shop-success-card')).toContainText('Oct 8, 2100');
  await expect(page.getByText('Preparing your order', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contact the seller' })).toHaveAttribute('href', 'mailto:studio@example.invalid');
  await expect(page.locator('.shop-purchase-shell')).toHaveCSS('--purchase-card', '#1b2b47');
  await expect(page.locator('.shop-purchase-shell')).toHaveCSS('--purchase-opacity', '100%');
  await page.getByRole('link', { name: 'Download guide.pdf' }).focus();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toHaveCSS('outline-width', '3px');
  await page.screenshot({ path: testInfo.outputPath('delivery-dark-desktop.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toBeVisible();
  await page.getByRole('link', { name: 'View your purchases' }).click();
  await expect(page.getByRole('heading', { name: 'Your purchases', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/shop\/customer$/);
  await expect(page.locator('.shop-customer-shell')).toHaveAttribute('lang', 'en-US');
  await expect(page.locator('.shop-customer-card-heading').first()).toContainText('Oct 8, 2026');
  await expect(page.locator('.shop-customer-bookings')).toContainText('Oct 8, 2026');
  await expect(page.getByText('Purchase-verified access', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Book an appointment' })).toHaveAttribute('href', 'https://cal.com/studio/consultation');
  await expect(page.getByRole('link', { name: 'Join meeting' })).toHaveAttribute('href', 'https://meeting.example.invalid/studio');
  await expect(page.locator('.shop-purchase-nav')).toContainText('Studio Store');
  await expect(page.locator('.shop-customer-card').first()).toHaveCSS('border-radius', '20px');
  await page.screenshot({ path: testInfo.outputPath('customer-dark-desktop.png'), fullPage: true });
  await page.getByLabel('What would you like to work on?').fill('Lighting for portraits');
  await page.getByRole('button', { name: 'Send answers' }).click();
  await expect(page.getByRole('status')).toContainText('Your answers have been saved.');
  await page.getByText('Before your appointment', { exact: true }).click();
  await expect(page.getByLabel('What would you like to work on?')).toHaveValue('Lighting for portraits');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download guide.pdf' }).press('Enter');
  expect((await downloaded).suggestedFilename()).toBe('guide.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.shop-customer-shell').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('customer-dark-mobile.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toBeVisible();
  portal.orders[0].downloadsRemaining = 0;
  await page.reload();
  await expect(page.getByText(/Download limit reached/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toHaveCount(0);
  portal.orders[0].downloadsRemaining = 10;
  portal.orders[0].expiresAt = '2000-01-01T00:00:00.000Z';
  await page.reload();
  await expect(page.getByText('Your download link has expired.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toHaveCount(0);
  Object.assign(shop.design, { pageBackground: '#f8f6f2', pageBackgroundSecondary: '#f8f6f2', textColor: '#26221e', mutedColor: '#625c54', accentColor: '#8d482b', buttonTextColor: '#ffffff', cardBackground: '#ffffff', cardTextColor: '#26221e', borderColor: '#e5ded3', cardRadius: 0, fontFamily: 'Georgia, serif' });
  await page.reload();
  await expect(page.locator('.shop-customer-card').first()).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.shop-customer-shell')).toHaveCSS('font-family', 'Georgia, serif');
  await expect(page.getByRole('link', { name: 'Book an appointment' })).toHaveCSS('background-color', 'rgb(141, 72, 43)');
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.screenshot({ path: testInfo.outputPath('customer-light-desktop.png'), fullPage: true });
  await page.route('**/api/shop/customer', route => route.fulfill({ status: 401, json: { error: 'Customer access link expired' } }));
  await page.reload();
  await expect(page.getByText(/This link has expired/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Download/ })).toHaveCount(0);
  Object.assign(receipt, { productType: 'service', productTitle: 'Studio consultation', downloadable: false, bookingUrl: 'https://cal.com/studio/consultation', fulfillmentText: 'Choose a time for your first session.', sessionsIncluded: 2, sessionsRemaining: 2 });
  await page.goto('/shop/download?token=browser-fixture');
  await expect(page.getByRole('heading', { name: 'Your order is ready' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose date and time' })).toHaveAttribute('href', 'https://cal.com/studio/consultation');
  await expect(page.getByText('2 of 2 sessions available.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('delivery-light-service.png'), fullPage: true });
});
