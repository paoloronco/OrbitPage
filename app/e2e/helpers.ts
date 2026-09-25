import { expect, type Locator, type Page } from '@playwright/test';

export const E2E_ADMIN_PASSWORD = 'OrbitPageE2E123!';

export async function useClassicAdmin(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('orbitpage.admin.new-ui', 'false'));
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
    await expect(page.locator('#setup-slug')).toHaveCount(0);
    const completeSetupButton = page.getByRole('button', { name: 'Complete setup' });
    await expect(completeSetupButton).toBeEnabled();
    await completeSetupButton.click();
  } else {
    await page.locator('#password').fill(E2E_ADMIN_PASSWORD);
    await loginButton.click();
  }

  await expect(page.locator('.admin-dashboard-shell')).toBeVisible();
  await expect(page.locator('.admin-dashboard-logo-copy strong')).toHaveText('OrbitPage');
}

export async function openAdminSection(page: Page, name: string) {
  const visualSection = page.getByRole('navigation', { name: 'Site sections' })
    .getByRole('button', { name, exact: true });
  if (await visualSection.isVisible()) {
    await visualSection.click();
    return;
  }

  const openNavigation = page.getByRole('button', { name: 'Open navigation' });

  if (await openNavigation.isVisible()) {
    await openNavigation.click();
    await expect(page.getByRole('button', { name: 'Close navigation' }).first()).toBeVisible();
  }

  const visualSectionNames = ['Page', 'Content', 'Menu', 'Shop', 'Pages'];
  if (visualSectionNames.includes(name)) {
    const siteEditorButton = page.locator('.admin-dashboard-nav-page')
      .getByRole('button', { name: 'Site editor', exact: true });
    if (await siteEditorButton.isVisible()) {
      await siteEditorButton.click();
      await expect(visualSection).toBeVisible();
      await visualSection.click();
      return;
    }
  }

  const sectionButton = page.locator('.admin-dashboard-nav')
    .getByRole('button', { name, exact: true });
  await expect(sectionButton).toBeVisible();
  await sectionButton.click();
}

export async function openPreviewContentCard(page: Page, previewCard: Locator) {
  await expect(previewCard).toBeVisible();
  const id = await previewCard.getAttribute('data-public-editor-link-id');
  expect(id).toBeTruthy();
  const editor = page.locator('.visual-site-editor__inspector .admin-link-list .admin-block-editor-shell');
  if (!await previewCard.evaluate((element) => element.classList.contains('is-selected'))) await previewCard.click();
  await expect(editor).toBeVisible();
  return { editor, id: id! };
}

export function contentSaveButton(page: Page) {
  return page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true });
}
