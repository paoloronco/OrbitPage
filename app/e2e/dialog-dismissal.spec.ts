import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin, openAdminSection } from './helpers';

test('closes clean Analytics popups outside and protects unsaved changes', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Analytics');
  const open = page.getByRole('button', { name: 'Google Analytics', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Google Analytics 4' });
  await open.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await open.click();
  const measurement = dialog.getByLabel('Measurement ID');
  const original = await measurement.inputValue();
  await measurement.fill('G-DISMISS1234');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await expect(measurement).toHaveValue('G-DISMISS1234');
  await measurement.fill(original);
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
});

test('protects a selected favicon while allowing clean popup dismissal', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Page');
  const open = page.getByRole('button', { name: /^Favicon/ });
  const dialog = page.getByRole('dialog', { name: 'Browser favicon' });
  await open.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await open.click();
  const buffer = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#3456ab';
    context.fillRect(0, 0, 32, 32);
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'favicon.png', mimeType: 'image/png', buffer });
  await expect(dialog.getByAltText('Selected favicon')).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(dialog).toBeHidden();
});

test('closes the AI popup outside only when its composer has no draft', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  const open = page.getByRole('button', { name: 'Edit with AI', exact: true });
  const dialog = page.getByRole('dialog', { name: 'OrbitPage AI', exact: true });
  await open.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await open.click();
  const composer = dialog.getByRole('textbox');
  await composer.fill('Unsaved instruction');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await expect(composer).toHaveValue('Unsaved instruction');
  await composer.fill('');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
});

test('protects changed cookie preferences without granting consent on dismissal', async ({ page }) => {
  await page.route('**/api/consent-config/public*', route => route.fulfill({ json: { success: true, data: {
    mode: 'hardcoded', enabled: true, hardcoded: {
      policyVersion: 'test', layout: 'centered-modal', theme: 'light', buttonPriority: 'equal', geoMode: 'always', consentExpiryDays: 180, reshowOnVersionChange: true, legalFooterText: '',
      texts: { title: 'Cookie consent', description: 'Choose your preferences.', acceptAll: 'Accept all', rejectAll: 'Reject all', managePreferences: 'Manage preferences', savePreferences: 'Save preferences', reopenLabel: 'Cookie preferences', privacyPolicyLinkText: 'Privacy', cookiePolicyLinkText: 'Cookies' },
      urls: { privacyPolicy: '', cookiePolicy: '' },
      categories: { preferences: { enabled: false, title: 'Preferences', description: '' }, analytics: { enabled: true, title: 'Analytics', description: 'Usage statistics' }, marketing: { enabled: false, title: 'Marketing', description: '' } },
    },
  } } }));
  await page.goto('/');
  const banner = page.getByRole('dialog', { name: 'Cookie consent', exact: true });
  await expect(banner).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(banner).toBeHidden();
  const open = page.getByRole('button', { name: 'Cookie preferences', exact: true });
  await open.click();
  const preferences = page.getByRole('dialog', { name: 'Cookie preferences', exact: true });
  await expect(preferences).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(preferences).toBeHidden();
  await open.click();
  const analytics = preferences.getByRole('switch', { name: 'Analytics', exact: true });
  await analytics.click();
  await page.mouse.click(2, 2);
  await expect(preferences).toBeVisible();
  await analytics.click();
  await page.mouse.click(2, 2);
  await expect(preferences).toBeHidden();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('orbitpage_consent_v2:')))).toBe(false);
});
