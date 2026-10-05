import { test, expect } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('logout revokes a copied dashboard token and permits a fresh login', async ({ page, request }) => {
  const authenticated = page.waitForResponse(response => /\/api\/auth\/(setup|login)$/.test(response.url()) && response.request().method() === 'POST');
  await openAuthenticatedAdmin(page);
  const { token } = await (await authenticated).json();
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };
  expect((await request.post('/api/auth/verify', { headers })).status()).toBe(200);
  const loggedOut = page.waitForResponse(response => response.url().endsWith('/api/auth/logout'));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  expect((await loggedOut).status()).toBe(200);
  expect((await request.post('/api/auth/verify', { headers })).status()).toBe(403);
  await openAuthenticatedAdmin(page);
  expect((await request.post('/api/auth/verify', { headers })).status()).toBe(403);
});
