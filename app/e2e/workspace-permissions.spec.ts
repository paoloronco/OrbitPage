import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('shows backup history and export without exposing restore to a read-only backup member', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.route('**/api/auth/verify', async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, user: { ...data.user, permissions: ['backup:read'] } } });
  });
  await page.route('**/api/versions?*', route => route.fulfill({ json: { retention: 25, currentRevision: 2, publishedRevision: 2, versions: [{ revision: 2, current: true, published: true, lastModified: '2026-01-01T00:00:00Z', sizeBytes: 100 }, { revision: 1, current: false, published: false, lastModified: '2025-12-31T00:00:00Z', sizeBytes: 100 }] } }));
  await page.goto('/en-US/dashboard/backup');
  await expect(page.getByRole('heading', { name: 'Version history' })).toBeVisible();
  const restore = page.getByRole('button', { name: 'Restore', exact: true });
  await expect(restore).toHaveCount(2);
  await expect(restore.last()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open backup file' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download selected' })).toBeEnabled();
});

test('opens saved newsletters from Overview and keeps the composer focused on editing', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  const content = { eyebrow: '', headline: 'Fictional update', body: 'A local test message.', ctaLabel: '', ctaUrl: '', imageUrl: '', imageAlt: '', logoUrl: '', accentColor: '#2563eb', backgroundColor: '#eef2ff', contentBackgroundColor: '#ffffff', contentColor: '#111827', buttonTextColor: '#ffffff', fontFamily: 'system', textAlign: 'left', containerWidth: 640, cornerRadius: 20, buttonRadius: 12, footerNote: '' };
  await page.route('**/api/newsletter?*', route => route.fulfill({ json: { available: true, canManage: true, planId: 'oss', limits: { maxSubscribers: null, maxSendsPerMonth: null, sendsThisMonth: 0, reservedThisMonth: 0 }, settings: { configured: true, passwordConfigured: true, host: 'smtp.example.invalid', port: 587, username: 'fictional', fromName: 'Fictional studio', fromEmail: 'sender@example.invalid', senderType: 'business', senderAddress: '', privacyPolicyUrl: '', termsUrl: '', footerText: '', complianceReady: true, verifiedAt: '2026-01-01T00:00:00Z' }, subscriberCounts: { total: 0, active: 0, pending: 0, unsubscribed: 0 }, subscribers: [], campaigns: [{ campaignId: 'draft', name: 'Fictional draft', subject: 'Fictional subject', preheader: '', content, status: 'draft', targetCount: 0, stats: { attempted: 0, accepted: 0, rejected: 0, openedUnique: 0, clickedUnique: 0, unsubscribed: 0 }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }, { campaignId: 'sent', name: 'Fictional campaign with a long name for the responsive performance report', subject: 'Fictional subject', preheader: '', content, status: 'sent', targetCount: 10000, stats: { attempted: 10000, accepted: 9876, rejected: 124, openedUnique: 2469, clickedUnique: 987, unsubscribed: 0 }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }] } }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/en-US/dashboard/newsletter/overview');
    await expect(page.getByRole('heading', { name: 'Campaign performance' })).toBeVisible();
    const report = page.locator('.newsletter-report').last();
    await expect(report.locator('.newsletter-report-main strong')).toHaveText('Fictional campaign with a long name for the responsive performance report');
    await expect(report.locator('.newsletter-report-metrics strong')).toHaveText(['9876', '25%', '10%', '1.2%']);
    expect(await report.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await report.locator('.newsletter-report-metrics > span').evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth))).toBe(true);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit campaign' })).toBeVisible();
    await expect(page.locator('.newsletter-campaign-list')).toHaveCount(0);
    await expect(page.getByText('Composer', { exact: true })).toHaveCount(0);
    const send = await page.getByRole('button', { name: 'Send now', exact: true }).boundingBox();
    const schedule = await page.getByRole('button', { name: 'Schedule', exact: true }).boundingBox();
    expect(send).not.toBeNull();
    expect(schedule).not.toBeNull();
    expect(Math.abs(send!.y - schedule!.y)).toBeLessThanOrEqual(1);
    expect(schedule!.x).toBeGreaterThanOrEqual(send!.x + send!.width);
    const date = page.getByLabel('Schedule date and time');
    await expect(page.getByRole('button', { name: 'Schedule', exact: true })).toBeDisabled();
    const minimum = await date.getAttribute('min');
    await date.fill(minimum!);
    await expect(page.getByRole('button', { name: 'Schedule', exact: true })).toBeEnabled();
    const currentSend = (await page.getByRole('button', { name: 'Send now', exact: true }).boundingBox())!;
    expect((await date.boundingBox())!.y).toBeGreaterThan(currentSend.y + currentSend.height);
  }
  await page.goto('/en-US/dashboard/newsletter/settings');
  await expect(page.getByRole('status', { name: 'Connection working' })).toBeVisible();
  await expect(page.getByText('Verified', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Newsletter settings', { exact: true })).toHaveCount(0);
});
