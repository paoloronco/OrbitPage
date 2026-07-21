import { test, expect } from '@playwright/test';
import { openAuthenticatedAdmin } from './helpers';

test.describe('OrbitPage Application Flow', () => {
  test('should complete first-time setup, edit profile, add a link, and verify public page', async ({ page }) => {
    await openAuthenticatedAdmin(page);
    
    // Selezioniamo esplicitamente la scheda "Page" per gestire stati di inizializzazione transitori
    const profileTabTrigger = page.getByRole('tab', { name: 'Page', exact: true });
    await expect(profileTabTrigger).toBeVisible();
    await profileTabTrigger.click();
    
    // Il nuovo editor del profilo resta sempre disponibile senza una modalita di sola lettura.
    const nameInput = page.getByLabel('Page name');
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill('Mario Rossi');

    const bioInput = page.getByRole('textbox', { name: 'Description', exact: true });
    await bioInput.clear();
    await bioInput.fill('Sviluppatore Web ed entusiasta dell\'open-source.');

    // Clicchiamo su Salva nel Profilo
    const saveProfileButton = page.getByRole('button', { name: 'Save page' });
    if (await saveProfileButton.isEnabled()) await saveProfileButton.click();

    // 3. Spostiamoci sulla scheda "Links" e aggiungiamo un link pubblico
    const linksTabTrigger = page.getByRole('tab', { name: 'Links' });
    await expect(linksTabTrigger).toBeVisible();
    await linksTabTrigger.click();

    let linkCard = page.locator('.admin-link-list [data-link-id]').filter({ has: page.getByRole('heading', { name: 'Mio Sito Web' }) }).first();
    if (await linkCard.count() === 0) {
      await page.getByRole('button', { name: 'Add link' }).click();
      linkCard = page.locator('.admin-link-list [data-link-id]').filter({ has: page.getByRole('heading', { name: 'New link' }) }).first();
      await expect(linkCard).toBeVisible();
    }

    const linkId = await linkCard.getAttribute('data-link-id');
    expect(linkId).toBeTruthy();
    linkCard = page.locator(`.admin-link-list [data-link-id="${linkId}"]`);

    await linkCard.hover();
    await linkCard.getByRole('button', { name: 'Edit block' }).click();

    const linkTitleInput = page.getByPlaceholder('Link title');
    await expect(linkTitleInput).toBeVisible();
    await linkTitleInput.clear();
    await linkTitleInput.fill('Mio Sito Web');

    const linkUrlInput = page.getByPlaceholder('https://example.com', { exact: true });
    await linkUrlInput.clear();
    await linkUrlInput.fill('https://mariorossi.dev');

    // Salviamo la modifica sulla singola card, poi persistiamo con Save della toolbar
    await linkCard.getByRole('button', { name: 'Save' }).click();
    await page.locator('.admin-link-actions button:has-text("Save")').click();
    
    // Verifichiamo che il badge di modifiche non salvate sia sparito
    await expect(page.getByText('Unsaved changes')).not.toBeVisible();

    // 4. Verifichiamo il rendering corretto sulla Pagina Pubblica
    await page.goto('/');

    // Il nome, la bio e il link devono essere visibili pubblicamente
    await expect(page.getByText('Mario Rossi')).toBeVisible();
    await expect(page.getByText('Sviluppatore Web ed entusiasta dell\'open-source.')).toBeVisible();
    
    const publicLink = page.getByRole('link', { name: 'Mio Sito Web' }).first();
    await expect(publicLink).toBeVisible();
    await expect(publicLink).toHaveAttribute('href', 'https://mariorossi.dev');
  });
});
