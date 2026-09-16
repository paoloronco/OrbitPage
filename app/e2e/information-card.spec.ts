import { expect, test } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test('keeps information text editable and identical in the live preview', async ({ page }) => {
  await openAuthenticatedAdmin(page);
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add content' }).click();
  await page.getByRole('dialog', { name: 'Add content' }).getByRole('button', { name: /^Text/ }).click();

  const textCard = page.locator('[data-link-id]').last();
  await textCard.hover();
  await textCard.getByRole('button', { name: 'Edit block' }).click();

  const informationText = textCard.getByLabel('Information text');
  await expect(informationText).toBeVisible();
  await informationText.fill('Opening hours\nMonday to Friday, 09:00-18:00');

  const preview = page.locator('.visual-site-editor__canvas').getByRole('button', { name: 'Edit New text' });
  await expect(preview).toContainText('Opening hours');
  await expect(preview).toContainText('Monday to Friday');

  await textCard.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(textCard).toContainText('Opening hours');
});
