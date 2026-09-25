import { expect, test } from '@playwright/test';
import { contentSaveButton, openAuthenticatedAdmin, openPreviewContentCard } from './helpers';

test('keeps information text editable and identical in the live preview', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /^Text/ }).click();
  await contentSaveButton(page).click();

  const previewCard = page.locator('.visual-site-editor__canvas [data-public-editor-link-id]').filter({ hasText: 'New text' }).last();
  const { editor: textCard, id: cardId } = await openPreviewContentCard(page, previewCard);

  const informationText = textCard.getByLabel('Information text');
  await expect(informationText).toBeVisible();
  await informationText.fill('Opening hours\nMonday to Friday, 09:00-18:00');

  const preview = page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${cardId}"]`);
  await expect(preview).toContainText('Opening hours');
  await expect(preview).toContainText('Monday to Friday');

  await expect(textCard.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  const saveContent = contentSaveButton(page);
  await expect(saveContent).toBeEnabled();
  await saveContent.click();
  await expect(preview).toContainText('Opening hours');
  await page.reload();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  const savedPreview = page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${cardId}"]`);
  const { editor: savedCard } = await openPreviewContentCard(page, savedPreview);
  await savedCard.getByLabel('Information text').fill('Temporary change');
  await expect(saveContent).toBeEnabled();
  await page.locator('.admin-profile-save-float').getByRole('button', { name: 'Cancel' }).click();
  await expect(saveContent).toHaveCount(0);
});
