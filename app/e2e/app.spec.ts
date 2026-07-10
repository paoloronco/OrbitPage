import { test, expect } from '@playwright/test';

test.describe('OrbitPage Application Flow', () => {
  test('should complete first-time setup, edit profile, add a link, and verify public page', async ({ page }) => {
    // 1. Visita la pagina admin (dovrebbe reindirizzare o mostrare il First-Time Setup)
    await page.goto('/admin');
    
    // Verifichiamo che venga mostrata la schermata di benvenuto del setup iniziale
    await expect(page.getByText('Welcome to OrbitPage')).toBeVisible();
    await expect(page.getByText('Create an admin password to get started')).toBeVisible();

    // Compiliamo il form di setup iniziale
    // Nota: Il setup richiede una password robusta (almeno 8 caratteri, maiuscola, minuscola, numero, carattere speciale)
    const testPassword = 'PasswordSicura123!';
    await page.locator('#password').fill(testPassword);
    await page.locator('#confirm-password').fill(testPassword);

    // Clicchiamo sul pulsante di completamento del setup
    const completeSetupButton = page.getByRole('button', { name: 'Complete Setup' });
    await expect(completeSetupButton).toBeEnabled();
    await completeSetupButton.click();

    // 2. Verifica reindirizzamento al pannello Admin e modifica della pagina
    // Dovrebbe apparire l'header dell'admin
    await expect(page.locator('h1.admin-title, .admin-title')).toHaveText('OrbitPage Admin');
    
    // Selezioniamo esplicitamente la scheda "Page" per gestire stati di inizializzazione transitori
    const profileTabTrigger = page.getByRole('tab', { name: 'Page' });
    await expect(profileTabTrigger).toBeVisible();
    await profileTabTrigger.click();
    
    // Il profilo è inizialmente in modalità sola lettura. Clicchiamo sul pulsante Modifica (l'unico bottone con icona nella scheda profilo)
    const editProfileButton = page.locator('.glass-card button').first();
    await expect(editProfileButton).toBeVisible();
    await editProfileButton.click();
    
    // Ora che siamo in modalità di modifica, modifichiamo il profilo
    const nameInput = page.getByPlaceholder('Name, brand, venue, or project', { exact: true });
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill('Mario Rossi');

    const bioInput = page.getByPlaceholder('Tell people what this page is for...');
    await bioInput.clear();
    await bioInput.fill('Sviluppatore Web ed entusiasta dell\'open-source.');

    // Clicchiamo su Salva nel Profilo
    const saveProfileButton = page.locator('button:has-text("Save")').first();
    await saveProfileButton.click();

    // 3. Spostiamoci sulla scheda "Links" e aggiungiamo un link pubblico
    const linksTabTrigger = page.getByRole('tab', { name: 'Links' });
    await expect(linksTabTrigger).toBeVisible();
    await linksTabTrigger.click();

    // Aggiungiamo una card link dalla griglia di creazione
    await page.getByRole('button', { name: 'Link URL card' }).click();

    // La card viene creata in modalità visualizzazione: entriamo in modifica
    const linkCard = page.locator('.admin-link-list [data-link-id]').first();
    await expect(linkCard.getByRole('heading', { name: 'New link' })).toBeVisible();
    await linkCard.hover();
    // Pulsanti azione (▲ ▼ Hide Edit Delete): Edit è il quarto
    await linkCard.locator('button').nth(3).click();

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
    
    const publicLink = page.getByRole('link', { name: 'Mio Sito Web' });
    await expect(publicLink).toBeVisible();
    await expect(publicLink).toHaveAttribute('href', 'https://mariorossi.dev');
  });
});
