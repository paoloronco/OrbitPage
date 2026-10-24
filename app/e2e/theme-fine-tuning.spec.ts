import { expect, test, type Page, type Locator } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin, openAdminSection, preservePageData } from './helpers';

const backgroundPixels = (locator: Locator) => locator.evaluate(element => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  context.fillStyle = getComputedStyle(element).backgroundColor; context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
});

async function setColor(page: Page, label: string, color: string) {
  const dialog = page.locator('.theme-fine-dialog');
  await dialog.getByRole('button', { name: new RegExp(`^${label}: #`) }).click();
  await page.getByRole('textbox', { name: `${label} HEX value`, exact: true }).fill(color);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog', { name: `${label} color picker`, exact: true })).toBeHidden();
}

test('fine tuning edits one card, shared styles and profile with recoverable saves', async ({ page }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAuthenticatedAdmin(page);
  const restore = await preservePageData(page, ['/api/profile', '/api/links', '/api/theme']);
  try {
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile')).json();
    const theme = await (await page.request.get('/api/theme')).json();
    await page.request.put('/api/theme', { headers, data: { ...theme, profileCardEffect: 'solid', profileCardOpacity: 1, contentCardEffect: 'solid', contentCardOpacity: 1 } });
    await page.request.put('/api/profile', { headers, data: { ...profile, name: 'Theme Studio', appearance: {} } });
    const links = ['Alpha', 'Beta'].map(title => ({ id: title.toLowerCase(), title, description: 'Keep this content', url: 'https://example.invalid', type: 'link', isActive: true }));
    await page.request.put('/api/links', { headers, data: links });
    await page.reload();
    await openAdminSection(page, 'Theme');
    await page.getByRole('tab', { name: 'Fine tuning', exact: true }).click();
    await expect(page).toHaveURL(/\/theme\/fine-tuning$/);
    await page.locator('.theme-fine-page-preview [data-public-editor-link-id="alpha"]').click();
    const dialog = page.locator('.theme-fine-dialog');
    await setColor(page, 'Card background', '#123456');
    await dialog.getByRole('button', { name: 'Shared style', exact: true }).click();
    await setColor(page, 'Card background', '#cbd5e1');
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('tab', { name: 'Page themes', exact: true }).click();
    await expect(page.locator('[data-theme-comparison]')).toBeVisible();
    await expect.poll(() => backgroundPixels(page.locator('[data-comparison-item="right"] .glass-card').filter({ hasText: 'Alpha' }))).toEqual([18, 52, 86, 255]);
    await page.getByRole('tab', { name: 'Fine tuning', exact: true }).click();
    await page.locator('.theme-fine-page-preview [data-public-editor-target="profile"]').click();
    await setColor(page, 'Profile background', '#fedcba');
    await dialog.getByRole('combobox', { name: 'Surface', exact: true }).click();
    await page.getByRole('option', { name: 'Solid', exact: true }).click();
    await expect.poll(() => backgroundPixels(dialog.locator('.profile-card'))).toEqual([254, 220, 186, 255]);
    await page.screenshot({ path: 'test-results/theme-fine-tuning-desktop.png' });
    let failLinks = true;
    let linksPending = false;
    let releaseFailure!: () => void;
    const failureGate = new Promise<void>(resolve => { releaseFailure = resolve; });
    await page.route('**/api/links', async route => {
      if (route.request().method() !== 'PUT' || !failLinks) return route.continue();
      linksPending = true;
      await failureGate;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary save failure' }) });
    });
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect.poll(() => linksPending).toBe(true);
    await expect(dialog.getByRole('combobox', { name: 'Surface', exact: true })).toBeDisabled();
    releaseFailure();
    await expect(dialog.getByRole('alert')).toContainText('Retry to save the remaining changes');
    failLinks = false;
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toBeHidden();
    const savedLinks = await (await page.request.get('/api/links')).json();
    expect(savedLinks[0].backgroundColor).toBe('#123456');
    expect(savedLinks[1].backgroundColor).toBeUndefined();
    expect(savedLinks[0].description).toBe('Keep this content');
    expect((await (await page.request.get('/api/theme')).json()).contentCard.background).toBe('#cbd5e1');
    expect((await (await page.request.get('/api/profile')).json()).appearance.cardBackgroundColor).toBe('#fedcba');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Fine tuning', exact: true })).toHaveAttribute('data-state', 'active');
    await page.locator('.theme-fine-page-preview [data-public-editor-link-id="alpha"]').click();
    await dialog.getByRole('button', { name: 'Reset to shared style', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await (await page.request.get('/api/links')).json())[0].backgroundColor).toBeUndefined();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('.theme-fine-targets').getByRole('button', { name: /^Profile/ }).click();
      await setColor(page, 'Profile text', '#654321');
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/theme-fine-tuning-${width}.png` });
      await dialog.getByRole('button', { name: 'Done', exact: true }).click();
      await page.locator('.admin-profile-save-float').getByRole('button', { name: 'Revert', exact: true }).click();
      await expect(page.locator('.admin-profile-save-float')).toBeHidden();
    }
  } finally { await restore(); }
});
