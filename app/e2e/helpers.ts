import { expect, type Page } from '@playwright/test';

export const E2E_ADMIN_PASSWORD = 'OrbitPageE2E123!';

export async function openAuthenticatedAdmin(page: Page) {
  await page.goto('/admin');

  const setupButton = page.getByRole('button', { name: 'Complete Setup' });
  const loginButton = page.getByRole('button', { name: 'Login to Admin' });
  await expect(setupButton.or(loginButton)).toBeVisible();

  if (await setupButton.isVisible()) {
    await expect(page.getByText('Welcome to OrbitPage')).toBeVisible();
    await expect(page.getByText('Create an admin password to get started')).toBeVisible();
    await page.locator('#password').fill(E2E_ADMIN_PASSWORD);
    await page.locator('#confirm-password').fill(E2E_ADMIN_PASSWORD);
    await expect(setupButton).toBeEnabled();
    await setupButton.click();
  } else {
    await page.locator('#password').fill(E2E_ADMIN_PASSWORD);
    await loginButton.click();
  }

  await expect(page.locator('h1.admin-title, .admin-title')).toHaveText('OrbitPage Admin');
}
