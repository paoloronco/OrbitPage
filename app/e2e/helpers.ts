import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const E2E_ADMIN_PASSWORD = 'OrbitPageE2E123!';

export async function openAuthenticatedAdmin(page: Page) {
  // Embedded maps and service players must not make local tests depend on providers.
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    return ['blob:', 'data:'].includes(url.protocol)
      || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? route.fallback() : route.abort();
  });
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
    if (await page.locator('#setup-token').count()) {
      await page.locator('#setup-token').fill(readFileSync(path.resolve('e2e-data', '.setup-token'), 'utf8').trim());
    }
    await expect(page.locator('#setup-slug')).toHaveCount(0);
    await expect(setupContinueButton).toBeEnabled();
    await setupContinueButton.click();

    const completeSetupButton = page.getByRole('button', { name: 'Complete setup' });
    await expect(completeSetupButton).toBeVisible();
    await completeSetupButton.click();
  } else {
    await page.locator('#password').fill(E2E_ADMIN_PASSWORD);
    await loginButton.click();
  }

  await expect(page.locator('.admin-dashboard-shell')).toBeVisible();
  await expect(page.locator('.admin-dashboard-logo-copy strong')).toHaveText('OrbitPage');
}

export async function openAdminSection(page: Page, name: string) {
  await expect(page.locator('.admin-dashboard-shell')).toBeVisible();
  const localizedNames: Record<string, RegExp> = {
    Page: /^(Page|Pagina)$/,
    Content: /^(Content|Contenuti)$/,
    Pages: /^(Pages|Pagine)$/,
    'Site editor': /^(Site editor|Editor sito)$/,
  };
  const accessibleName = localizedNames[name] ?? new RegExp(`^${name}$`);
  const visualSection = page.getByRole('navigation', { name: 'Site sections' })
    .getByRole('button', { name: accessibleName });
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
      .getByRole('button', { name: localizedNames['Site editor'] });
    await expect(siteEditorButton).toBeVisible();
    await siteEditorButton.click();
    await expect(visualSection).toBeVisible();
    await visualSection.click();
    return;
  }

  const sectionButton = page.locator('.admin-dashboard-nav')
    .getByRole('button', { name: accessibleName });
  await expect(sectionButton).toBeVisible();
  await sectionButton.click();
}

export async function openPreviewContentCard(page: Page, previewCard: Locator) {
  await expect(previewCard).toBeVisible();
  const id = await previewCard.getAttribute('data-public-editor-link-id');
  expect(id).toBeTruthy();
  const editor = page.locator('.visual-site-editor__inspector .admin-link-list .admin-block-editor-shell');
  if (!await editor.isVisible()) await previewCard.click();
  await expect(editor).toBeVisible();
  return { editor, id: id! };
}

export function contentSaveButton(page: Page) {
  return page.locator('.admin-profile-save-float').getByRole('button', { name: 'Save', exact: true });
}

export async function saveEditorChanges(page: Page) {
  const progress = page.locator('.admin-profile-saved-notice__progress i');
  const previous = await progress.count() ? await progress.elementHandle() : null;
  await contentSaveButton(page).click();
  await expect(page.locator('.admin-profile-saved-notice').getByRole('status')).toContainText(/Saved|Salvato/);
  if (previous) await expect.poll(() => progress.evaluate((element, old) => element !== old, previous)).toBe(true);
}
