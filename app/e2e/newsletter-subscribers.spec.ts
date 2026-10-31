import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';
import { NEWSLETTER_TRACKING_CONSENT_VERSION, type NewsletterSubscriber } from '../src/lib/newsletter-types';

test('searches, filters, sorts and paginates subscribers without changing removal targets', async ({ page }, testInfo) => {
  await openAuthenticatedAdmin(page);
  let subscribers: NewsletterSubscriber[] = Array.from({ length: 31 }, (_, index) => ({
    subscriberId: `contact-${index}`,
    email: `person${String(index).padStart(2, '0')}@example.invalid`,
    name: index === 0 ? null : `Contact ${String(index).padStart(2, '0')}`,
    status: (['active', 'pending', 'unsubscribed'] as const)[index % 3],
    source: (['manual', 'public', 'import'] as const)[Math.floor(index / 3) % 3],
    consentAt: '2026-10-01T10:00:00.000Z',
    confirmedAt: '2026-10-01T10:00:00.000Z',
    trackingConsentAt: index % 2 === 0 ? '2026-10-01T10:00:00.000Z' : null,
    trackingConsentId: index % 2 === 0 ? `consent-${index}` : null,
    trackingConsentVersion: index === 0 ? 'expired-version' : NEWSLETTER_TRACKING_CONSENT_VERSION,
    unsubscribedAt: null,
    createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    updatedAt: '2026-10-31T10:00:00.000Z',
  }));
  const removed: string[] = [];
  await page.route(/\/api\/newsletter(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), subscribers, subscriberCounts: { total: 135, active: 11, pending: 10, unsubscribed: 10 } } });
  });
  await page.route('**/api/newsletter/subscribers/*', async route => {
    expect(route.request().method()).toBe('DELETE');
    const id = route.request().url().split('/').at(-1)!;
    removed.push(id);
    subscribers = subscribers.filter(item => item.subscriberId !== id);
    await route.fulfill({ json: { removed: true } });
  });
  await page.goto('/en-US/dashboard/newsletter/subscribers');
  const panel = page.locator('.newsletter-subscriber-list');
  const rows = panel.locator('tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('person30@example.invalid');
  await expect(panel.getByRole('note')).toContainText('31 / 135');
  await expect(panel.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  await panel.getByRole('button', { name: 'Next page' }).click();
  await expect(panel.getByRole('status')).toHaveText('11–20 of 31 subscribers');
  await panel.getByRole('button', { name: 'Subscriber', exact: true }).click();
  await expect(panel.getByRole('columnheader', { name: 'Subscriber', exact: true })).toHaveAttribute('aria-sort', 'ascending');
  await expect(rows.first()).toContainText('person01@example.invalid');
  await expect(panel.getByRole('status')).toHaveText('1–10 of 31 subscribers');
  await panel.getByRole('button', { name: 'Subscriber', exact: true }).click();
  await expect(rows.first()).toContainText('person00@example.invalid');
  await panel.getByLabel('Search subscribers', { exact: true }).fill('  CONTACT 03  ');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('person03@example.invalid');
  await panel.getByLabel('Search subscribers', { exact: true }).fill('PERSON00@');
  await expect(rows.first()).toContainText('person00@example.invalid');
  await panel.getByRole('combobox', { name: 'Email tracking', exact: true }).selectOption('consented');
  await expect(panel.getByText('No matching subscribers', { exact: true })).toBeVisible();
  await expect(panel.getByRole('status')).toHaveText('0–0 of 0 subscribers');
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await panel.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
  await panel.getByRole('combobox', { name: 'Source', exact: true }).selectOption('manual');
  await panel.getByRole('combobox', { name: 'Email tracking', exact: true }).selectOption('consented');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('person18@example.invalid');
  await expect(rows.first()).toContainText('Consented');
  await panel.getByRole('button', { name: 'Clear filters' }).click();
  await panel.getByRole('combobox', { name: 'Rows per page', exact: true }).selectOption('25');
  await expect(rows).toHaveCount(25);
  await panel.getByRole('button', { name: 'Next page' }).click();
  await expect(rows).toHaveCount(6);
  await expect(panel.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await panel.getByRole('combobox', { name: 'Rows per page', exact: true }).selectOption('10');
  await panel.getByRole('button', { name: 'Added', exact: true }).click();
  for (let index = 0; index < 3; index++) await panel.getByRole('button', { name: 'Next page' }).click();
  await expect(rows).toHaveCount(1);
  const remove = panel.getByRole('button', { name: 'Remove person00@example.invalid', exact: true });
  page.once('dialog', dialog => dialog.dismiss());
  await remove.click();
  expect(removed).toEqual([]);
  page.once('dialog', dialog => dialog.accept());
  await remove.click();
  await expect(rows).toHaveCount(10);
  await expect(panel.getByRole('status')).toHaveText('21–30 of 30 subscribers');
  expect(removed).toEqual(['contact-0']);
  await expect(panel.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('newsletter-subscribers-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.admin-dashboard-nav-stack')).toBeHidden();
  await panel.getByLabel('Search subscribers', { exact: true }).fill('Contact 18');
  await expect(rows).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await panel.getByLabel('Search subscribers', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('combobox', { name: 'Status', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('newsletter-subscribers-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Language', { exact: true }).selectOption('it');
  await expect(panel.getByLabel('Cerca iscritti', { exact: true })).toBeVisible();
  await expect(panel.getByRole('status')).toHaveText('1–1 di 1 iscritti');
});
