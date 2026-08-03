import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

const E2E_BIO = 'OrbitPage AI E2E verified this page update.';

test.describe('OrbitPage AI API end-to-end', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 });

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
    await expect(page.getByText('Ready', { exact: true })).toBeVisible();

    const publicPage = await context.newPage();
    await publicPage.goto('/');
    await expect(publicPage.getByText(E2E_BIO, { exact: true })).toHaveCount(0);

    await page.locator('#oss-ai-prompt').fill('Set the E2E biography marker now.');
    await page.getByRole('button', { name: 'Send request' }).click();

    const proposal = page.getByRole('region', { name: 'Proposed changes' });
    await expect(proposal).toBeVisible();
    await expect(proposal.getByRole('heading', { name: 'Update the public biography.' })).toBeVisible({ timeout: 15_000 });

    await publicPage.reload();
    await expect(publicPage.getByText(E2E_BIO, { exact: true })).toHaveCount(0);

    await proposal.getByRole('button', { name: 'Apply approved changes' }).click();
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
    await expect(page.getByRole('region', { name: 'Proposed changes' })).toHaveCount(0);
  });
});
