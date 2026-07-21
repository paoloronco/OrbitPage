import { expect, type Page } from '@playwright/test';

export const E2E_ADMIN_PASSWORD = 'OrbitPageE2E123!';
export const E2E_PUBLIC_PAGE_SLUG = 'e2e-public-page';

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

  const setupContinueButton = page.getByRole('button', { name: 'Continue', exact: true });
  const loginButton = page.getByRole('button', { name: 'Login to Admin' });
  await expect(setupContinueButton.or(loginButton)).toBeVisible({ timeout: 15_000 });

  if (await setupContinueButton.isVisible()) {
    await expect(page.getByRole('heading', { name: 'Make sure the installation is ready.' })).toBeVisible();
    await expect(setupContinueButton).toBeEnabled();
    await setupContinueButton.click();

    await page.locator('#setup-password').fill(E2E_ADMIN_PASSWORD);
    await page.locator('#setup-confirm-password').fill(E2E_ADMIN_PASSWORD);
    await expect(setupContinueButton).toBeEnabled();
    await setupContinueButton.click();

    await page.locator('#setup-slug').fill(E2E_PUBLIC_PAGE_SLUG);
    const completeSetupButton = page.getByRole('button', { name: 'Complete setup' });
    await expect(completeSetupButton).toBeEnabled();
    await completeSetupButton.click();
  } else {
    await page.locator('#password').fill(E2E_ADMIN_PASSWORD);
    await loginButton.click();
  }

  await expect(page.locator('.admin-dashboard-shell')).toBeVisible();
  await expect(page.locator('.admin-dashboard-logo-copy strong')).toHaveText('OrbitPage');
  await dismissOnboarding(page);
}
