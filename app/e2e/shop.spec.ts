import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

test('the self-hosted Shop saves private digital products and offers owner Stripe settings', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Shop');
  const shop = page.locator('.orbitpage-selfhosted-shop');
  await expect(shop.locator('.shop-workspace')).toBeVisible();
  await expect(shop.getByRole('button', { name: 'Connect Stripe', exact: true })).toHaveCount(0);
  await shop.getByRole('button', { name: 'Add product', exact: true }).first().click();
  const editor = shop.locator('#shop-catalog');
  const title = `Synthetic OSS download ${Date.now()}`;
  await editor.getByLabel('Name', { exact: true }).fill(title);
  await editor.getByLabel('Full description', { exact: true }).fill('Synthetic digital delivery for the OSS browser test.');
  await editor.getByLabel('Price', { exact: true }).fill('10');
  await editor.getByRole('switch', { name: 'Available for purchase' }).click();
  await editor.getByRole('button', { name: 'Manage files' }).click();
  const files = page.getByRole('dialog', { name: 'Product files' });
  await files.getByLabel('Add files').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic OSS browser fixture') });
  await files.getByRole('button', { name: 'Done', exact: true }).click();
  const saved = page.waitForResponse(response => response.url().endsWith('/api/shop/uploads/finalize'));
  await page.getByRole('group', { name: 'Unsaved Shop changes' }).getByRole('button', { name: 'Save', exact: true }).click();
  const dashboard = await (await saved).json();
  const product = dashboard.products.find((item: { title: string }) => item.title === title);
  expect(product.priceCents).toBe(1000);
  expect(product.files).toHaveLength(1);
  expect(product.files[0].id).toMatch(/^[a-f0-9]{64}$/);
  expect((await page.request.get(`/uploads/${product.files[0].id}`)).status()).toBe(404);
  await expect(page.getByRole('group', { name: 'Unsaved Shop changes' })).toBeHidden();
  await page.reload();
  await expect(shop.getByText(title, { exact: true }).first()).toBeVisible();
  await shop.getByRole('button', { name: 'Shop settings', exact: true }).click();
  await shop.getByRole('button', { name: 'Stripe', exact: true }).click();
  await expect(shop.getByLabel('Stripe secret API key')).toHaveAttribute('type', 'password');
  await expect(shop.getByLabel('Stripe webhook endpoint')).toHaveValue(/\/api\/shop\/webhook$/);
  await expect(shop.getByText(/no OrbitPage fee/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await shop.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.goto('/shop/success');
  await expect(page.getByText(/Order|order/).first()).toBeVisible();
});

test('a confirmed purchase opens downloads and appointments without registration and survives refresh', async ({ page }) => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const expiresAt = new Date(Date.now() + 86400_000).toISOString();
  const receipt = { orderId, productTitle: 'Photography toolkit', productType: 'digital', amountTotal: 1000, currency: 'eur', downloadable: true,
    files: [{ filename: 'guide.pdf', sizeBytes: 1024 }], downloadCount: 0, maxDownloads: 10, expiresAt, deliveryToken: 'browser-fixture',
    customerPortalUrl: '/shop/customer?access=browser-fixture', intakeQuestions: [], sessionsIncluded: 0, sessionsRemaining: 0 };
  const portal = { customer: { shopName: 'Studio Store', shopUrl: '/shop', supportEmail: 'studio@example.invalid', email: 'buyer@example.invalid' }, bookings: [], orders: [
    { ...receipt, paidAt: new Date().toISOString(), files: [{ filename: 'guide.pdf', sizeBytes: 1024, url: '/api/shop/download/browser-fixture?file=0' }], downloadsRemaining: 10, deliveryUrl: '/shop/download?token=browser-fixture' },
    { orderId: '22222222-2222-4222-8222-222222222222', productTitle: 'Studio consultation', productType: 'service', paidAt: new Date().toISOString(), bookingUrl: 'https://cal.com/studio/consultation', bookingStatus: 'awaiting_booking', sessionsRemaining: 2, sessionsIncluded: 2, intakeQuestions: [], intakeAnswers: [] }
  ] };
  await page.route('**/api/shop/order?*', route => route.fulfill({ json: receipt }));
  await page.route('**/api/shop/delivery/browser-fixture', route => route.fulfill({ json: receipt }));
  await page.route('**/api/shop/customer?*', route => route.fulfill({ json: portal }));
  await page.route('**/api/shop/download/browser-fixture?*', route => route.fulfill({ contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="guide.pdf"' }, body: '%PDF-1.7\nbrowser fixture' }));
  await page.goto(`/shop/success?order=${orderId}&session_id=cs_test_browser_fixture`);
  await expect(page.getByRole('heading', { name: 'Your order is ready' })).toBeVisible();
  await expect(page.getByText('Preparing your order', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toBeVisible();
  await page.getByRole('link', { name: 'View your purchases' }).click();
  await expect(page.getByRole('heading', { name: 'Your purchases', exact: true })).toBeVisible();
  await expect(page.getByText('Purchase-verified access', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Book an appointment' })).toHaveAttribute('href', 'https://cal.com/studio/consultation');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download guide.pdf' }).click();
  expect((await downloaded).suggestedFilename()).toBe('guide.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.shop-customer-shell').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toBeVisible();
  portal.orders[0].downloadsRemaining = 0;
  await page.reload();
  await expect(page.getByText(/Download limit reached/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download guide.pdf' })).toHaveCount(0);
});
