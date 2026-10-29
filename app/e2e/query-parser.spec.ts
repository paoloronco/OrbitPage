import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, openAuthenticatedAdmin } from './helpers';

test('query and form parsing reject hostile login shapes and retain normal requests', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  const baseline = await (await page.request.get('/api/public-page')).json();
  for (const key of ['a[0][toString]', 'a%5B0%5D%5BtoString%5D', 'a[0][0][toString]']) {
    const response = await page.request.get(`/api/public-page?${key}=x`);
    expect(response.status()).toBe(200);
    expect((await response.json()).profile.name).toBe(baseline.profile.name);
  }
  const invalidLogin = await page.request.post('/api/auth/login', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: 'password[0][toString]=x',
  });
  expect(invalidLogin.status()).toBe(400);
  expect((await invalidLogin.json()).error).toBeTruthy();
  const login = await page.request.post('/api/auth/login', { form: { password: E2E_ADMIN_PASSWORD } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  expect((await page.request.post('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
  expect((await page.request.get('/health')).status()).toBe(200);
});
