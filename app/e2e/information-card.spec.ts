import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('keeps information text editable and identical in the live preview', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /^Text/ }).click();

  const textCard = page.locator('[data-link-id]').last();
  const cardId = await textCard.getAttribute('data-link-id');
  expect(cardId).toBeTruthy();
  await textCard.hover();
  await textCard.getByRole('button', { name: 'Edit block' }).click();

  const informationText = textCard.getByLabel('Information text');
  await expect(informationText).toBeVisible();
  await informationText.fill('Opening hours\nMonday to Friday, 09:00-18:00');

  const preview = page.locator(`.visual-site-editor__canvas [data-public-editor-link-id="${cardId}"]`);
  await expect(preview).toContainText('Opening hours');
  await expect(preview).toContainText('Monday to Friday');

  await expect(textCard.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  const saveContent = page.locator('.admin-link-actions').getByRole('button', { name: 'Save', exact: true });
  await expect(saveContent).toBeEnabled();
  await saveContent.click();
  await expect(textCard).toContainText('Opening hours');
  await page.reload();
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  const savedCard = page.locator(`[data-link-id="${cardId}"]`);
  await expect(savedCard).toHaveCount(1);
  await savedCard.hover();
  await savedCard.getByRole('button', { name: 'Edit block' }).click();
  await savedCard.getByLabel('Information text').fill('Temporary change');
  await expect(saveContent).toBeEnabled();
  await savedCard.getByRole('button', { name: 'Cancel' }).click();
  await expect(saveContent).toBeDisabled();
});
