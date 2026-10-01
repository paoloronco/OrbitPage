import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';


const primaryNavigation = [
  'Site editor',
  'AI Assistant',
  'Theme',
  'Publish',
  'Backup',
  'Analytics',
  'Privacy',
];

const secondaryNavigation = ['Newsletter', 'Team', 'Account', 'Plan'];

const navigationIcons = {
  'Site editor': 'person-outline',
  'AI Assistant': 'auto-awesome-outlined',
  Theme: 'palette-outlined',
  Publish: 'share-outlined',
  Backup: 'storage-outlined',
  Analytics: 'bar-chart-outlined',
  Privacy: 'cookie-outlined',
  Newsletter: 'mail-outline',
  Team: 'group-outlined',
  Account: 'account-circle-outlined',
  Plan: 'credit-card-outlined',
} as const;

test('checks OSS updates and explains when the host update service is not enabled', async ({ page }) => {
  let tag = 'v99.0.0';
  let status = 200;
  await page.route('https://api.github.com/repos/paoloronco/OrbitPage/releases/latest', route => route.fulfill({
    status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ tag_name: tag, draft: false, prerelease: false }),
  }));
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const instance = page.locator('.account-instance-card');
  const details = page.locator('.oss-account-details-card');
  const currentVersion = await instance.locator('.account-detail-row').filter({ hasText: 'Current version' }).locator('dd').innerText();
  expect(currentVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  const shell = await page.request.get('/en-US/dashboard/account');
  const shellHtml = await shell.text();
  for (const extension of ['js', 'css']) {
    const asset = shellHtml.match(new RegExp(`/assets/orbitpage-[\\w-]+\\.${extension}`))?.[0];
    expect(asset).toBeTruthy();
    expect((await page.request.get(asset!)).ok()).toBe(true);
  }
  await expect(page.getByRole('heading', { name: "We couldn't open this page." })).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  const initialCards = await Promise.all([details.boundingBox(), instance.boundingBox()]);
  expect(initialCards.every(Boolean)).toBe(true);
  expect(Math.abs(initialCards[0]!.height - initialCards[1]!.height)).toBeLessThanOrEqual(1);
  const initialSupport = await page.locator('.oss-account-support-card').boundingBox();
  const check = instance.getByRole('button', { name: 'Check for updates', exact: true });
  const install = instance.getByRole('button', { name: 'Install update…', exact: true });
  await expect(install).toBeDisabled();
  await check.click();
  await expect(instance.getByRole('status')).toContainText('Update available: v99.0.0');
  await expect(instance.getByRole('link', { name: 'Release notes' })).toHaveAttribute('href', 'https://github.com/paoloronco/OrbitPage/releases/tag/v99.0.0');
  const updatedSupport = await page.locator('.oss-account-support-card').boundingBox();
  expect(Math.abs(updatedSupport!.y - initialSupport!.y)).toBeLessThanOrEqual(1);
  await install.click();
  const dialog = page.getByRole('dialog', { name: 'Install OrbitPage update' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveCSS('color', 'rgb(17, 27, 45)');
  await expect(dialog.getByRole('button', { name: 'Copy command', exact: true })).toHaveCSS('color', 'rgb(15, 23, 41)');
  await expect(dialog.locator('code')).toHaveText('sudo orbitpage-update');
  await expect(dialog.getByRole('status')).toContainText('Web updates are not enabled');
  await expect(dialog.getByRole('link', { name: 'Update guide' })).toHaveAttribute('href', /#web-updates$/);
  await page.keyboard.press('Escape');
  tag = currentVersion;
  await check.click();
  await expect(instance.getByRole('status')).toHaveText('You’re up to date.');
  await expect(install).toBeDisabled();
  status = 503;
  await check.click();
  await expect(instance.getByRole('status')).toHaveText('Could not check for updates. Try again.');
  await expect(install).toBeDisabled();
});

test('keeps the update modal locked through a restart and shows logs and the confirmed result', async ({ page }) => {
  let job: Record<string, unknown> | null = null;
  let disconnected = false;
  let rejectInstall = false;
  let latestTag = 'v99.0.0';
  await page.route('**/api/account/updates*', route => {
    if (rejectInstall && route.request().method() === 'POST') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Host updater unavailable.' }) });
    if (disconnected) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Restarting' }) });
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ version: '99.0.0', currentPassword: 'Current123!' });
      job = { id: 'isolated-update', state: 'queued', version: '99.0.0', startedAt: Date.now() / 1000, updatedAt: Date.now() / 1000, logs: '', error: null };
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true, job }) });
  });
  await page.route('https://api.github.com/repos/paoloronco/OrbitPage/releases/latest', route => route.fulfill({
    contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ tag_name: latestTag, draft: false, prerelease: false }),
  }));
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await page.getByRole('button', { name: 'Install update…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Install OrbitPage update' });
  await expect(dialog.getByRole('status')).toContainText('Ready to install');
  await dialog.getByLabel('Current password', { exact: true }).fill('Current123!');
  await dialog.getByRole('button', { name: 'Install update', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Checking the release');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeHidden();
  job = { ...job, state: 'running', logs: '[update] Downloading image\n[update] Backing up persistent data\nBackup created\n[update] Checking application health' };
  await expect(dialog.getByLabel('Update logs', { exact: true })).toContainText('Backup created', { timeout: 10000 });
  await page.screenshot({ path: 'output/playwright/oss-update-running.png' });
  disconnected = true;
  await expect(dialog.getByRole('alert')).toContainText('Waiting for the server', { timeout: 10000 });
  await expect(dialog).toBeVisible();
  await page.clock.setSystemTime(new Date(Date.now() + 91_000));
  await dialog.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Connection lost — update status unknown');
  await expect(dialog.locator('progress')).toHaveCount(0);
  disconnected = false;
  job = { ...job, state: 'completed', logs: 'Health check passed\nUpdate completed. OrbitPage v99.0.0 is running.' };
  await dialog.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Update completed · v99.0.0');
  await expect(dialog.getByRole('button', { name: 'Reload dashboard' })).toBeVisible();
  await page.screenshot({ path: 'output/playwright/oss-update-completed.png' });
  await dialog.locator('.account-delete-actions').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  latestTag = 'v100.0.0'; rejectInstall = true;
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await page.getByRole('button', { name: 'Install update…', exact: true }).click();
  await dialog.getByLabel('Current password', { exact: true }).fill('Current123!');
  await dialog.getByRole('button', { name: 'Install update', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Host updater unavailable.');
  await expect(dialog.getByRole('status')).toHaveText('Ready to install v100.0.0');
  await expect(dialog.locator('progress')).toHaveCount(0);
});

test('resumes an active host update after a dashboard reload and reports failure without an endless spinner', async ({ page }) => {
  let state = 'running';
  await page.route('**/api/account/updates*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true,
    job: { id: 'resumed-update', state, version: '99.0.0', startedAt: 1, updatedAt: 2, logs: 'Backup created\nChecking application health', error: state === 'failed' ? 'Host updater failed (exit 1). Review the logs before retrying.' : null },
  }) }));
  await openAuthenticatedAdmin(page);
  const dialog = page.getByRole('dialog', { name: 'Install OrbitPage update' });
  await expect(dialog.getByRole('status')).toContainText('Installing update');
  await page.reload();
  await expect(dialog.getByRole('status')).toContainText('Installing update');
  state = 'failed';
  await expect(dialog.getByRole('status')).toContainText('Update failed', { timeout: 10000 });
  await expect(dialog.getByRole('alert')).toContainText('Host updater failed');
  await expect(dialog.locator('progress')).toHaveCount(0);
  await dialog.locator('.account-delete-actions').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('does not claim installation when the start is rejected or cannot be confirmed', async ({ page }) => {
  let unavailable = false;
  let rejected = true;
  await page.route('**/api/account/updates*', route => {
    if (route.request().method() === 'POST') {
      unavailable = true;
      return rejected
        ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Current password is incorrect.' }) })
        : route.abort();
    }
    return route.fulfill({ status: unavailable ? 503 : 200, contentType: 'application/json',
      body: JSON.stringify(unavailable ? { error: 'Host updater unavailable.' } : { enabled: true, job: null }),
    });
  });
  await page.route('https://api.github.com/repos/paoloronco/OrbitPage/releases/latest', route => route.fulfill({
    contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ tag_name: 'v99.0.0', draft: false, prerelease: false }),
  }));
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await page.getByRole('button', { name: 'Install update…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Install OrbitPage update' });
  await dialog.getByLabel('Current password', { exact: true }).fill('Incorrect123!');
  await dialog.getByRole('button', { name: 'Install update', exact: true }).click();
  await expect(dialog.getByRole('alert').first()).toBeVisible();
  await expect(dialog.locator('progress')).toHaveCount(0);
  await dialog.locator('.account-delete-actions').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();

  unavailable = false; rejected = false;
  await page.getByRole('button', { name: 'Install update…', exact: true }).click();
  await dialog.getByLabel('Current password', { exact: true }).fill('Current123!');
  await expect(dialog.getByRole('button', { name: 'Install update', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Install update', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Update start has not been confirmed');
  await expect(dialog.locator('progress')).toHaveCount(0);
  await expect(dialog.getByLabel('Update logs', { exact: true })).toContainText('Waiting for the host updater');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.unroute('**/api/account/updates*');
  await page.route('**/api/account/updates*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: false, job: null }) }));
  await dialog.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Web updates are not enabled');
  await expect(dialog.locator('.account-delete-actions').getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  // An accepted job may exist even if the POST response was lost.
  await page.unroute('**/api/account/updates*');
  await page.route('**/api/account/updates*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true,
    job: { id: 'accepted-after-disconnect', state: 'running', version: '99.0.0', startedAt: 1, updatedAt: 2, logs: '[update] Downloading image', error: null },
  }) }));
  await expect(dialog.getByRole('status')).toContainText('Installing update');
  await expect(dialog.getByLabel('Update logs', { exact: true })).toContainText('Downloading image');
});

test('matches the SaaS dashboard shell and keeps hosted-only surfaces explicit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openAuthenticatedAdmin(page);

  const primaryLabels = await page.locator('.admin-dashboard-nav-page [data-onboarding$="-tab"]').allTextContents();
  const secondaryLabels = await page.locator('.admin-dashboard-nav-workspace button').allTextContents();

  expect(primaryLabels.map((label) => label.trim())).toEqual(primaryNavigation);
  expect(secondaryLabels.map((label) => label.trim())).toEqual(secondaryNavigation);

  for (const [label, icon] of Object.entries(navigationIcons)) {
    const navButton = page.getByRole('button', { name: label, exact: true });
    const navIcon = navButton.locator(`[data-dashboard-icon="${icon}"]`);
    await expect(navIcon).toBeVisible();
    const expectedColor = label === 'Site editor'
      ? 'rgb(131, 165, 255)'
      : await navButton.evaluate((element) => getComputedStyle(element).color);
    await expect(navIcon).toHaveCSS('color', expectedColor);
  }

  const shell = page.locator('.admin-dashboard-shell');
  await expect(shell).toHaveCSS('font-family', /Aptos|Avenir Next|Segoe UI Variable/);
  await expect(page.locator('.orbitpage-dashboard-brand img')).toHaveCSS('width', '30px');
  await expect(page.locator('.orbitpage-dashboard-brand img')).toHaveCSS('height', '30px');
  await expect(page.locator('.admin-dashboard-logo-copy')).toHaveCSS('width', '125px');
  await expect(page.locator('.admin-dashboard-header')).toHaveCSS('min-height', '92px');

  const language = page.locator('.admin-dashboard-language');
  await expect(language).toHaveCSS('height', '36px');
  await expect(page.getByLabel('Language')).toHaveCSS('font-weight', '800');
  await expect(language.locator('svg')).toHaveCSS('font-size', '15px');

  const sidebarFooter = page.locator('.admin-dashboard-sidebar-footer');
  await expect(sidebarFooter).toHaveCSS('gap', '4px');

  const signOut = page.getByRole('button', { name: 'Sign out' });
  const backToSite = page.getByRole('link', { name: 'Back to site' });
  await expect(signOut).toHaveCSS('height', '38px');
  await expect(backToSite).toHaveCSS('height', '38px');
  await expect(backToSite).toHaveCSS('font-weight', '800');
  await expect(backToSite).toHaveCSS('white-space', 'nowrap');
  await expect(backToSite).not.toHaveAttribute('target', '_blank');
  const footerActionBounds = await Promise.all([signOut.boundingBox(), backToSite.boundingBox()]);
  expect(footerActionBounds.every(Boolean)).toBe(true);
  expect(Math.abs(footerActionBounds[0]!.y - footerActionBounds[1]!.y)).toBeLessThanOrEqual(1);

  await expect(page.locator('.admin-dashboard-header .admin-dashboard-kicker')).toHaveCount(0);
  const headerLeftEdges = await Promise.all([
    page.locator('.admin-dashboard-heading-row h1').boundingBox(),
    page.locator('.admin-dashboard-context-row').boundingBox(),
  ]);
  expect(headerLeftEdges.every(Boolean)).toBe(true);
  expect(Math.max(...headerLeftEdges.map((bounds) => bounds!.x)) - Math.min(...headerLeftEdges.map((bounds) => bounds!.x))).toBeLessThanOrEqual(1);
  const contextSlug = page.locator('.admin-dashboard-context-slug');
  expect(await contextSlug.evaluate((element) => {
    const style = getComputedStyle(element);
    return Math.abs(Number.parseFloat(style.width) - Number.parseFloat(style.flexBasis)) <= 1
      && style.textOverflow === 'ellipsis';
  })).toBe(true);

  const publicPage = page.getByRole('link', { name: 'Public page' });
  await expect(publicPage).toHaveCSS('min-height', '40px');
  await expect(publicPage).toHaveCSS('font-size', '13px');
  await expect(publicPage.locator('button')).toHaveCount(0);

  const lockedShop = page.getByRole('navigation', { name: 'Site sections' }).getByRole('button', { name: 'Shop', exact: true });
  await expect(lockedShop).toHaveAttribute('data-status', 'locked');

  await page.getByRole('button', { name: 'Mobile preview' }).click();
  const mobilePreview = page.locator('.visual-site-editor__canvas .admin-preview-device--mobile');
  const mobileHardware = mobilePreview.locator('.admin-preview-device__hardware');
  const mobileHardwareBounds = await mobileHardware.boundingBox();
  expect(mobileHardwareBounds).not.toBeNull();
  expect(mobileHardwareBounds!.width).toBeGreaterThanOrEqual(220);
  expect(mobileHardwareBounds!.width).toBeLessThanOrEqual(280);
  await expect(mobileHardware).toHaveCSS('aspect-ratio', '6 / 13');

  await openAdminSection(page, 'Content');
  const contentInspector = page.locator('.visual-site-editor__inspector');
  await expect(contentInspector).toHaveAttribute('aria-label', 'Content block');
  const contentInspectorBounds = await contentInspector.boundingBox();
  expect(contentInspectorBounds).not.toBeNull();
  expect(contentInspectorBounds!.width).toBeGreaterThanOrEqual(360);
  expect(contentInspectorBounds!.width).toBeLessThanOrEqual(420);
  await page.getByRole('button', { name: 'Desktop preview' }).click();
  const desktopPreview = page.locator('.admin-preview-device--desktop');
  const desktopHardwareBounds = await desktopPreview.locator('.admin-preview-device__hardware').boundingBox();
  expect(desktopHardwareBounds).not.toBeNull();
  expect(desktopHardwareBounds!.width).toBeLessThanOrEqual(900);
  expect(desktopHardwareBounds!.height).toBeGreaterThanOrEqual(480);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  const launcher = page.getByRole('button', { name: 'Edit with AI' });
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveCSS('min-height', '46px');
  await expect(launcher).toHaveCSS('font-size', '13px');
  await launcher.click();
  await expect(page.getByRole('dialog', { name: 'OrbitPage AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Close AI assistant' }).click();

  await page.getByRole('button', { name: 'AI Assistant', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI usage' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit by asking' })).toBeVisible();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OpenAI API key' })).toBeVisible();
  await expect(launcher).toBeHidden();
});

test('keeps the parity navigation and AI launcher usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  const launcher = page.getByRole('button', { name: 'Edit with AI' });
  await expect(launcher).toBeVisible();
  await expect(page.locator('.ai-page-agent')).toHaveCSS('position', 'fixed');
  await expect(page.locator('.admin-profile-role-option')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: 'AI Assistant', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan', exact: true })).toBeVisible();
  await expect(page.locator('.admin-dashboard-language')).toHaveCSS('width', '44px');
  await expect(page.getByRole('link', { name: 'Back to site' })).toHaveCSS('width', '44px');

  await page.getByRole('button', { name: 'Close navigation' }).first().click();
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'OrbitPage AI' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.ai-page-agent')).toHaveCSS('position', 'fixed');
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
});

test('keeps the menu workflow clear on mobile without truncated guidance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedAdmin(page);

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await openAdminSection(page, 'Menu');

  const workflow = page.getByRole('navigation', { name: 'Menu setup workflow' });
  const steps = workflow.getByRole('button');
  const descriptions = workflow.locator('.menu-editor-tab-copy small');
  await expect(steps).toHaveCount(3);
  await expect(descriptions).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const step = steps.nth(index);
    const description = descriptions.nth(index);
    await expect(step).toBeVisible();
    await expect(description).toBeHidden();

    const bounds = await step.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(48);

  }

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('keeps the real theme preview available without crowding tablet and mobile layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Theme', exact: true }).click();

  const disclosure = page.locator('.admin-theme-preview-disclosure');
  const summary = disclosure.locator('.admin-theme-preview-summary');
  const previewBody = disclosure.locator('.admin-theme-preview-body');
  const mobileHardware = disclosure.locator('.admin-preview-device--mobile .admin-preview-device__hardware');

  await expect(summary).toBeVisible();
  await expect(summary).toHaveCSS('min-height', '52px');
  await expect(previewBody).toBeHidden();
  await summary.click();
  await expect(previewBody).toBeVisible();
  let mobileHardwareBounds = await mobileHardware.boundingBox();
  expect(mobileHardwareBounds).not.toBeNull();
  expect(mobileHardwareBounds!.width).toBeGreaterThanOrEqual(200);
  expect(mobileHardwareBounds!.width).toBeLessThanOrEqual(230);
  await expect(mobileHardware).toHaveCSS('aspect-ratio', '6 / 13');

  let horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await summary.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(previewBody).toBeHidden();
  await summary.click();
  await expect(previewBody).toBeVisible();
  mobileHardwareBounds = await mobileHardware.boundingBox();
  expect(mobileHardwareBounds).not.toBeNull();
  expect(mobileHardwareBounds!.width).toBeGreaterThanOrEqual(190);
  expect(mobileHardwareBounds!.width).toBeLessThanOrEqual(210);
  await expect(mobileHardware).toHaveCSS('aspect-ratio', '6 / 13');

  const previewBounds = await disclosure.boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(previewBounds!.width).toBeLessThanOrEqual(390);
  horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  const themeRail = page.locator('.admin-theme-preset-rail');
  const railDimensions = await themeRail.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(railDimensions.scrollWidth).toBeGreaterThan(railDimensions.clientWidth);
  const firstTheme = page.locator('.admin-theme-preset-card').nth(0);
  const secondTheme = page.locator('.admin-theme-preset-card').nth(1);
  const firstThemeBounds = await firstTheme.boundingBox();
  const secondThemeBounds = await secondTheme.boundingBox();
  expect(firstThemeBounds).not.toBeNull();
  expect(secondThemeBounds).not.toBeNull();
  expect(Math.abs(firstThemeBounds!.y - secondThemeBounds!.y)).toBeLessThanOrEqual(3);
  expect(secondThemeBounds!.x).toBeGreaterThan(firstThemeBounds!.x);
  await summary.click();
  await expect(previewBody).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open controls' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#admin-theme-manual-controls')).toHaveCount(0);
  const compactThemeHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(compactThemeHeight).toBeLessThan(1600);
});

test('keeps the content preview readable on a 720p laptop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openAuthenticatedAdmin(page);
  await openAdminSection(page, 'Content');
  await page.getByRole('button', { name: 'Mobile preview' }).click();

  const preview = page.locator('.visual-site-editor__canvas');
  const hardware = preview.locator('.admin-preview-device__hardware');
  const hardwareBounds = await hardware.boundingBox();
  expect(hardwareBounds).not.toBeNull();
  expect(hardwareBounds!.width).toBeGreaterThanOrEqual(250);
  expect(hardwareBounds!.width).toBeLessThanOrEqual(280);
  await expect(hardware).toHaveCSS('aspect-ratio', '6 / 13');

  const previewBounds = await preview.boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(previewBounds!.x).toBeGreaterThanOrEqual(0);
  expect(previewBounds!.x + previewBounds!.width).toBeLessThanOrEqual(1280);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('keeps the dense editors compact and organized by task', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openAuthenticatedAdmin(page);

  await expect(page.getByRole('heading', { name: 'Page type', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Identity', exact: true })).toBeVisible();
  await expect(page.getByText('Card style', { exact: true })).toBeVisible();
  await expect(page.locator('.admin-profile-save-layer')).toHaveCount(0);
  const avatarSizeSlider = page.getByLabel('Profile image size');
  const avatarSizeBounds = await avatarSizeSlider.boundingBox();
  expect(avatarSizeBounds).not.toBeNull();
  expect(avatarSizeBounds!.width).toBeLessThanOrEqual(176);
  await expect(page.getByLabel('Role or focus')).toHaveCSS('padding-left', '36px');
  await expect(page.getByLabel('Location')).toHaveCSS('padding-left', '36px');

  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  const compactThemePreview = page.locator('.admin-theme-mockup--compact').first();
  await expect(compactThemePreview).toHaveCSS('height', '112px');
  await expect(page.locator('.admin-theme-preview-disclosure')).toHaveAttribute('open', '');
  await expect(page.locator('.admin-theme-live-preview')).toBeVisible();
  const themeHardware = page.locator('.admin-theme-live-preview .admin-preview-device__hardware');
  const themeHardwareBounds = await themeHardware.boundingBox();
  expect(themeHardwareBounds).not.toBeNull();
  expect(themeHardwareBounds!.width).toBeGreaterThanOrEqual(200);
  expect(themeHardwareBounds!.width).toBeLessThanOrEqual(230);
  await expect(themeHardware).toHaveCSS('aspect-ratio', '6 / 13');

  await openAdminSection(page, 'Menu');
  const workflow = page.getByRole('navigation', { name: 'Menu setup workflow' });
  await expect(workflow.getByRole('button')).toHaveCount(3);
  await expect(workflow.getByText('Settings', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Menu', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Design', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Menu content view' })).toHaveCount(0);
  await workflow.getByRole('button', { name: /Settings/ }).click();
  const localeSelect = page.getByLabel('Locale', { exact: true });
  await expect(localeSelect).toHaveJSProperty('tagName', 'SELECT');
  await expect(localeSelect.locator('option')).toHaveCount(19);
  await localeSelect.selectOption('it-IT');
  await expect(localeSelect).toHaveValue('it-IT');

  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', /^mailto:contact@orbitpage\.com/);
  await expect(page.getByRole('button', { name: 'Remove personal page' })).toBeVisible();
  await page.getByRole('button', { name: 'Security', exact: true }).click();
  await expect(page.locator('#current-password')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.locator('#new-password')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#confirm-password')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#two-factor-password')).toHaveAttribute('autocomplete', 'current-password');
  const passwordCard = await page.locator('.oss-account-password-card').boundingBox();
  const mfaCard = await page.locator('.oss-account-mfa-card').boundingBox();
  expect(passwordCard).not.toBeNull();
  expect(mfaCard).not.toBeNull();
  expect(passwordCard!.x).toBeLessThan(mfaCard!.x);
  expect(Math.abs(passwordCard!.y - mfaCard!.y)).toBeLessThanOrEqual(1);
  const passwordForms = await page.locator('.oss-account-layout input[type="password"]').evaluateAll((inputs) => inputs.map((input) => Boolean((input as HTMLInputElement).form)));
  expect(passwordForms.every(Boolean)).toBe(true);
  await page.route('**/api/auth/2fa/setup', (route) => route.fulfill({ json: {
    success: true,
    uri: 'otpauth://totp/OrbitPage:parity?secret=JBSWY3DPEHPK3PXP&issuer=OrbitPage',
    secretKey: 'JBSWY3DPEHPK3PXP',
    expiresAt: '2099-01-01T00:00:00.000Z',
  } }));
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePassword = await page.locator('.oss-account-password-card').boundingBox();
  const mobileMfa = await page.locator('.oss-account-mfa-card').boundingBox();
  const mobileRecovery = await page.locator('.oss-account-recovery-card').boundingBox();
  expect(Math.abs(mobileMfa!.y - mobilePassword!.y - mobilePassword!.height - 18)).toBeLessThanOrEqual(1);
  expect(mobileRecovery!.y).toBeGreaterThanOrEqual(mobileMfa!.y + mobileMfa!.height);
  await page.locator('#two-factor-password').fill('synthetic-layout-password');
  await page.getByRole('button', { name: 'Set up authenticator', exact: true }).click();
  await expect(page.getByRole('img', { name: 'QR code for the OrbitPage authenticator setup' })).toBeVisible();
  const setupGrid = page.locator('.mfa-setup-grid');
  const qrBounds = await setupGrid.locator('img').boundingBox();
  const fieldsBounds = await setupGrid.locator('.mfa-setup-fields').boundingBox();
  expect(qrBounds).not.toBeNull();
  expect(fieldsBounds).not.toBeNull();
  expect(fieldsBounds!.y).toBeGreaterThanOrEqual(qrBounds!.y + qrBounds!.height);
  expect(fieldsBounds!.x + fieldsBounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await setupGrid.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('keeps product labels shared with SaaS while localizing section descriptions', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('orbitpage.locale', 'it'));
  await openAuthenticatedAdmin(page);

  await expect(page.getByRole('button', { name: 'Editor sito', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sezioni del sito' }).getByRole('button', { name: 'Contenuti', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Theme', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Editor sito', exact: true })).toBeVisible();
  await expect(page.getByText('Modifica identità e contenuti direttamente sulla pagina reale.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByText("Assegna a ogni collaboratore solo l'accesso necessario.", { exact: true })).toBeVisible();
  const members = page.locator('.team-overview-panel');
  const tokens = page.locator('.account-api-token-panel');
  await expect(members.getByRole('heading', { name: 'Membri del workspace', exact: true })).toHaveCSS('font-size', '16px');
  await expect(tokens.getByRole('heading', { name: 'Token API personali', exact: true })).toHaveCSS('font-size', '16px');
  await expect(members).toHaveCSS('border-color', 'rgb(216, 225, 238)');
  await expect(tokens).toHaveCSS('padding', '24px');
  await expect(tokens.locator('.api-token-list')).toHaveAttribute('aria-busy', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(members).toHaveCSS('padding', '16px');
  await expect(tokens).toHaveCSS('padding', '16px');
  await expect(tokens.getByLabel('Nome token')).toHaveCSS('height', '40px');
  await expect(tokens.getByLabel('Password attuale')).toHaveCSS('height', '40px');
  await expect(tokens.locator('.api-token-example pre')).toHaveCSS('white-space', 'pre');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.getByText('Gestisci identità, sicurezza e workspace attivo.', { exact: true })).toBeVisible();
});
