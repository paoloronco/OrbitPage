import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

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
    await expect(proposal.getByRole('region', { name: 'Page preview before and after' })).toBeVisible({ timeout: 15_000 });
    await expect(proposal.getByRole('slider', { name: 'Move to compare before and after' })).toBeVisible();

    await publicPage.reload();
    await expect(publicPage.getByText(E2E_BIO, { exact: true })).toHaveCount(0);

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
