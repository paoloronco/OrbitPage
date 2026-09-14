import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

import { openAdminSection, openAuthenticatedAdmin, useClassicAdmin } from './helpers';
import { prepareHostedRestoreBackup } from '../src/lib/hosted-backup-import';
import { createPortableBackupArchive, readPortableBackupArchive } from '../src/lib/portable-backup';

const avatar = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlVAAAAAASUVORK5CYII=',
  'base64',
);
const e2eDataRoot = path.resolve('e2e-data');
const uploadRoot = path.resolve(e2eDataRoot, 'uploads');

test.beforeEach(async ({ page }) => {
  expect(uploadRoot.startsWith(`${e2eDataRoot}${path.sep}`)).toBe(true);
  fs.rmSync(uploadRoot, { recursive: true, force: true });
  fs.mkdirSync(uploadRoot, { recursive: true });
  await useClassicAdmin(page);
});

test('moves a backup with images through OSS restore and the SaaS import path', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  const emptyImagesResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/backup/images'));
  await openAdminSection(page, 'Backup');
  await expect((await emptyImagesResponse).json()).resolves.toMatchObject({ images: [] });
  await expect(page.getByRole('checkbox', { name: /Include images \(ZIP\)/ })).toHaveCount(0);
  await openAdminSection(page, 'Page');

  await page.locator('.admin-profile-avatar-editor input[type="file"]').setInputFiles({
    name: 'portable-avatar.png',
    mimeType: 'image/png',
    buffer: avatar,
  });
  await expect(page.getByAltText('Profile image preview')).toHaveAttribute('src', /^blob:/);
  await page.getByLabel('Page name').fill('Portable backup source');
  const saveProfile = page.getByRole('button', { name: 'Save', exact: true });
  await saveProfile.click();
  await expect(saveProfile).toBeHidden();

  const availableImagesResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/backup/images'));
  await openAdminSection(page, 'Backup');
  await expect((await availableImagesResponse).json()).resolves.toMatchObject({ images: [expect.objectContaining({ path: expect.any(String) })] });
  const includeImages = page.getByRole('checkbox', { name: /Include images \(ZIP\)/ });
  await expect(includeImages).toBeVisible();

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download selected' }).click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/);
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonBackup = JSON.parse(fs.readFileSync(jsonPath!, 'utf8'));
  expect(jsonBackup.includedSections).not.toContain('media');
  expect(jsonBackup.uploads).toEqual([]);

  await includeImages.check();
  const zipDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download selected' }).click();
  const zipDownload = await zipDownloadPromise;
  expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/);
  const zipPath = await zipDownload.path();
  expect(zipPath).toBeTruthy();

  const archiveBytes = fs.readFileSync(zipPath!);
  const zip = await JSZip.loadAsync(archiveBytes);
  const imageEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.startsWith('uploads/'));
  expect(imageEntry).toBeTruthy();
  const archivedImage = Buffer.from(await imageEntry!.async('uint8array'));
  const archivedFileName = imageEntry!.name.split('/').at(-1)!;
  expect(await zip.file('backup.json')?.async('string')).toBeTruthy();

  const portableBackup = await readPortableBackupArchive(archiveBytes);
  const hosted = await prepareHostedRestoreBackup(portableBackup, async ({ base64, fileName }) => {
    expect(Buffer.from(base64, 'base64')).toEqual(archivedImage);
    return `https://media.example/${fileName}`;
  });
  expect(hosted.migratedMedia).toBe(1);
  expect(hosted.backup).toHaveProperty('content.profile.name', 'Portable backup source');

  const managedKey = `tenants/e2e/pages/portable/${archivedFileName}`;
  const managedArchive = Buffer.from(await createPortableBackupArchive({
    format: 'orbitpage-managed-page',
    schemaVersion: 2,
    runtimeVersion: 'e2e-managed',
    createdAt: '2026-09-14T00:00:00.000Z',
    source: { username: 'saas-e2e' },
    includedSections: ['profile'],
    content: {
      profile: {
        name: 'Portable backup from SaaS',
        avatar: `/api/orbitpage/assets/${managedKey}`,
        showAvatar: true,
      },
    },
  }, [{ path: archivedFileName, reference: managedKey, bytes: new Uint8Array(archivedImage) }]));

  const uploadPath = path.resolve(uploadRoot, imageEntry!.name.slice('uploads/'.length));
  expect(uploadPath.startsWith(`${uploadRoot}${path.sep}`)).toBe(true);
  expect(fs.existsSync(uploadPath)).toBe(true);
  fs.rmSync(uploadPath);
  expect(fs.existsSync(uploadPath)).toBe(false);

  await openAdminSection(page, 'Page');
  await page.getByLabel('Page name').fill('Changed after backup');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await openAdminSection(page, 'Backup');
  await page.locator('input[type="file"][accept*=".zip"]').setInputFiles({
    name: 'orbitpage-saas-portable.zip',
    mimeType: 'application/zip',
    buffer: managedArchive,
  });
  await expect(page.getByText('orbitpage-saas-portable.zip')).toBeVisible();
  await expect(page.locator('#restore-backup-section-profile')).toHaveAttribute('data-state', 'checked');
  await expect(page.locator('#restore-backup-section-media')).toHaveAttribute('data-state', 'checked');
  page.once('dialog', (dialog) => dialog.accept());
  const reload = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Restore selected' }).click();
  await reload;

  await openAdminSection(page, 'Page');
  await expect(page.getByLabel('Page name')).toHaveValue('Portable backup from SaaS');
  await page.goto('/');
  const restoredAvatar = page.locator('.public-page-root--standalone .profile-card__avatar img');
  await expect(restoredAvatar).toBeVisible();
  const avatarUrl = await restoredAvatar.getAttribute('src');
  expect(avatarUrl).toBeTruthy();
  const response = await page.request.get(new URL(avatarUrl!, page.url()).toString(), {
    headers: { 'cache-control': 'no-cache' },
  });
  expect(response.status()).toBe(200);
  expect(await response.body()).toEqual(archivedImage);
});
