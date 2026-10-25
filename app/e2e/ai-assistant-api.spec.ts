import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAdminSection, openAuthenticatedAdmin } from './helpers';

const E2E_BIO = 'OrbitPage AI E2E verified this page update.';

test.describe('OrbitPage AI API end-to-end', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 });

  test('keeps long history inside the chat and clears its saved copy', async ({ page }) => {
    await openAuthenticatedAdmin(page);
    const storageKey = 'orbitpage:ai-conversation:v1:admin';
    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify(Array.from({ length: 80 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        content: `Saved message ${index + 1}`,
      }))));
    }, storageKey);
    await page.reload();
    await openAdminSection(page, 'AI Assistant');

    const conversation = page.locator('.oss-ai-conversation');
    await expect(conversation.getByText('Saved message 80')).toBeVisible();
    expect(await conversation.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    expect(await conversation.evaluate((element) => element.closest('.oss-ai-workspace')!.getBoundingClientRect().height)).toBeLessThanOrEqual(760);

    await page.getByRole('button', { name: 'Clear conversation' }).click();
    await expect(conversation.getByText('Saved message 80')).toHaveCount(0);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
    await page.reload();
    await expect(page.locator('.oss-ai-conversation').getByText('Saved message 80')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Clear conversation' })).toBeVisible();
    const mobileTabs = page.locator('.ai-assistant-mobile-tabs');
    await expect(mobileTabs).toBeVisible();
    await expect(page.locator('.oss-ai-aside-stack')).toBeHidden();
    await page.locator('#oss-ai-prompt').fill('Keep my draft');
    await mobileTabs.getByRole('button', { name: 'Tools', exact: true }).click();
    await expect(page.locator('.oss-ai-workspace')).toBeHidden();
    await expect(page.locator('.oss-ai-settings')).toBeVisible();
    await expect(page.locator('.oss-ai-launch-kit')).toBeVisible();
    await mobileTabs.getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(page.locator('#oss-ai-prompt')).toHaveValue('Keep my draft');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('keeps AI APIs private and does not grant arbitrary CORS access', async ({ request }) => {
    for (const endpoint of ['/api/ai/settings', '/api/ai/page/plan', '/api/ai/page/commit']) {
      const response = endpoint.endsWith('/settings')
        ? await request.get(endpoint, { headers: { Origin: 'https://attacker.example' } })
        : await request.post(endpoint, {
            headers: { Origin: 'https://attacker.example' },
            data: endpoint.endsWith('/plan')
              ? { message: 'Change the page', history: [] }
              : { previewToken: 'A'.repeat(43) },
          });

      expect(response.status(), endpoint).toBe(401);
      expect(response.headers()['access-control-allow-origin'], endpoint).toBeUndefined();
      expect(response.headers()['access-control-allow-credentials'], endpoint).toBeUndefined();
    }
  });

  test('plans, reviews and commits a real page change only after confirmation', async ({ page, context }) => {
    await openAuthenticatedAdmin(page);
    const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const profile = await (await page.request.get('/api/profile', { headers })).json();
    expect((await page.request.put('/api/profile', { headers, data: { ...profile, bio: 'Before the AI proposal' } })).ok()).toBeTruthy();
    await page.reload();
    await openAdminSection(page, 'AI Assistant');

    await expect(page.getByRole('heading', { name: 'Edit by asking' })).toBeVisible();
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();

    const publicPage = await context.newPage();
    await publicPage.goto('/');
    await expect(publicPage.getByText(E2E_BIO, { exact: true })).toHaveCount(0);

    await page.locator('#oss-ai-prompt').fill('Set the E2E biography marker now.');
    await page.getByRole('button', { name: 'Send request' }).click();

    const proposal = page.getByRole('region', { name: 'Page preview', exact: true });
    await expect(proposal).toBeVisible();
    await expect(proposal.locator('.ai-page-comparison__viewport')).toBeVisible({ timeout: 15_000 });
    await expect(proposal.getByRole('slider', { name: 'Move to compare before and after' })).toBeVisible();

    await publicPage.reload();
    await expect(publicPage.getByText(E2E_BIO, { exact: true })).toHaveCount(0);

    await page.reload();
    await expect(proposal.getByRole('button', { name: 'Apply changes' })).toBeVisible();
    await expect(proposal.getByRole('button', { name: 'Mobile preview' })).toHaveAttribute('aria-pressed', 'true');
    for (const [device, ratio] of [['Mobile', 390 / 844], ['Desktop', 16 / 9]] as const) {
      await proposal.getByRole('button', { name: `${device} preview` }).click();
      const viewport = proposal.locator('.ai-page-comparison__viewport');
      const screen = await viewport.locator('.admin-preview-device__screen').first().boundingBox();
      expect(screen!.width / screen!.height).toBeCloseTo(ratio, 1);
      const hardware = (await viewport.locator('.admin-preview-device__hardware').boundingBox())!;
      expect(screen!.x).toBeGreaterThan(hardware.x);
      expect(screen!.y).toBeGreaterThan(hardware.y);
      await expect(viewport.locator(device === 'Mobile' ? '.admin-preview-device__island' : '.admin-preview-device__browser-bar')).toBeVisible();
      const slider = proposal.getByRole('slider');
      await slider.focus();
      await slider.press('Home');
      await slider.press('ArrowRight');
      await expect(slider).toHaveValue('1');
      await expect(viewport.locator('.ai-page-comparison__handle svg')).toHaveCount(2);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.ai-assistant-mobile-tabs').getByRole('button', { name: 'Tools', exact: true }).click();
    await expect(proposal).toBeHidden();
    await page.locator('.ai-assistant-mobile-tabs').getByRole('button', { name: 'Chat', exact: true }).click();
    await expect(proposal.getByRole('button', { name: 'Apply changes' })).toBeVisible();
    await proposal.getByRole('button', { name: 'Mobile preview' }).click();
    const phone = (await proposal.locator('.admin-preview-device__hardware').boundingBox())!;
    const camera = (await proposal.locator('.admin-preview-device__island').boundingBox())!;
    const sideButton = (await proposal.locator('.admin-preview-device__side-button').first().boundingBox())!;
    expect(camera.width / phone.width).toBeLessThanOrEqual(.24);
    expect(camera.height / phone.width).toBeLessThanOrEqual(.07);
    expect(sideButton.height / phone.width).toBeLessThanOrEqual(.15);
    await page.locator('#oss-ai-prompt').focus();
    expect(await page.locator('#oss-ai-prompt').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
    await proposal.getByRole('button', { name: 'Apply changes' }).click();
    await expect(page.getByText('Editor data refreshed.')).toBeVisible();
    await expect(page.getByText('Done. The approved changes are now live in your editor.')).toBeVisible();

    await publicPage.reload();
    await expect(publicPage.getByText(E2E_BIO, { exact: true })).toBeVisible();

    await openAdminSection(page, 'Page');
    await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(E2E_BIO);
    await publicPage.close();
  });

  test('rejects an unsafe provider-supplied URL before creating a proposal', async ({ page }) => {
    await openAuthenticatedAdmin(page);
    await openAdminSection(page, 'AI Assistant');

    await page.locator('#oss-ai-prompt').fill('E2E_UNSAFE_URL');
    await page.getByRole('button', { name: 'Send request' }).click();

    await expect(page.getByText('The new block URL is not safe.', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Page preview', exact: true })).toHaveCount(0);
  });
});

test('creates a draft product and a private menu dish only after approval, and sends generated suggestions', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  const { token } = await (await page.request.post('/api/auth/login', { data: { password: E2E_ADMIN_PASSWORD } })).json();
  const headers = { Authorization: `Bearer ${token}` };
  const menu = await (await page.request.get('/api/menu', { headers })).json();
  await page.request.put('/api/menu', { headers, data: { ...menu, enabled: false } });
  await openAdminSection(page, 'AI Assistant');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [prompt, name] of [['E2E_DRAFT_PRODUCT', 'Fictional AI consultation'], ['E2E_PRIVATE_MENU', 'Fictional AI pasta']]) {
    await page.locator('#oss-ai-prompt').fill(prompt);
    await page.getByRole('button', { name: 'Send request' }).click();
    const proposal = page.locator('.oss-ai-proposal');
    await expect(proposal.getByText(name, { exact: true })).toBeVisible();
    await expect(proposal.locator('.ai-page-comparison__viewport')).toHaveCount(0);
    await page.reload();
    await expect(proposal.getByText(name, { exact: true })).toBeVisible();
    await proposal.getByRole('button', { name: 'Apply changes' }).click();
    await expect(proposal).toHaveCount(0);
  }
  const savedMenu = await (await page.request.get('/api/menu', { headers })).json();
  expect(savedMenu.enabled).toBe(false);
  expect(savedMenu.items.some((item: { name: string }) => item.name === 'Fictional AI pasta')).toBe(true);
  // This is the real local Shop endpoint; no provider or payment setup is needed.
  const shop = await (await page.request.get('/api/shop', { headers })).json();
  expect(shop.products.find((product: { title: string }) => product.title === 'Fictional AI consultation')).toMatchObject({ active: false, files: [], bookingUrl: '' });
  await page.locator('#oss-ai-prompt').fill('Suggest the next edit');
  await page.getByRole('button', { name: 'Send request' }).click();
  const suggestion = page.getByRole('button', { name: 'Make the biography more concise', exact: true });
  await expect(suggestion).toBeVisible();
  const sent = page.waitForRequest(request => request.url().endsWith('/api/ai/page/plan') && request.postDataJSON().message === 'Make the biography more concise');
  await suggestion.click();
  await sent;
  await expect(page.locator('.oss-ai-message.user').last()).toHaveText('Make the biography more concise');
});
