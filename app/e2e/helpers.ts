import { expect, type Page } from '@playwright/test';

export const E2E_ADMIN_PASSWORD = 'OrbitPageE2E123!';

async function dismissOnboarding(page: Page) {
  const welcome = page.locator('.admin-onboarding-welcome');

  try {
    await welcome.waitFor({ state: 'visible', timeout: 3_000 });
    await welcome.getByRole('button', { name: 'Skip for now' }).click();
    await expect(welcome).toBeHidden();
  } catch {
    const activeGuide = page.locator('.admin-onboarding-panel');
    if (await activeGuide.isVisible()) {
      await activeGuide.getByRole('button', { name: 'Skip guide' }).click();
      await expect(activeGuide).toBeHidden();
    }
  }
}

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
  await dismissOnboarding(page);
}
