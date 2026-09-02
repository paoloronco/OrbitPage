import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Definiamo un percorso assoluto per la cartella dei dati dei test E2E
const e2eDataDir = path.resolve(__dirname, 'e2e-data');
const appPort = Number(process.env.ORBITPAGE_E2E_APP_PORT || 3123);
const fixturePort = Number(process.env.ORBITPAGE_E2E_FIXTURE_PORT || 3124);

export default defineConfig({
  testDir: './e2e',
  timeout: process.env.CI ? 45 * 1000 : 30 * 1000,
  /* Esegui i test in parallelo */
  fullyParallel: true,
  /* Fallisci la build su CI se hai lasciato accidentalmente test.only nel codice */
  forbidOnly: !!process.env.CI,
  /* Ritenta solo su CI */
  retries: process.env.CI ? 2 : 0,
  /* Su CI usiamo un solo worker per evitare conflitti sul database SQLite */
  workers: 1,
  /* Reporter per visualizzare i risultati */
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : 'html',
  /* Impostazioni condivise per tutti i progetti */
  use: {
    /* URL di base per i test */
    baseURL: `http://localhost:${appPort}`,
    /* Raccogli le tracce in caso di fallimento per il debug */
    trace: 'retain-on-failure',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    /* Stable interactions across Chromium, Firefox and WebKit in CI. */
    reducedMotion: process.env.CI ? 'reduce' : 'no-preference',
  },

  /* Configura i progetti per i diversi browser */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Avvia automaticamente il server dell'applicazione prima di eseguire i test */
  webServer: [
    {
      command: `npx cross-env PORT=${fixturePort} node e2e/support/openai-fixture-server.mjs`,
      url: `http://127.0.0.1:${fixturePort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    },
    {
      // Usiamo un provider locale deterministico: il test attraversa le vere API
      // OrbitPage senza inviare dati o consumare credito OpenAI.
      command: `npx cross-env NODE_ENV=test PORT=${appPort} DATA_DIR="${e2eDataDir}" JWT_SECRET=e2e-test-secret-key-0123456789abcdef0123456789abcdef OPENAI_API_KEY=sk-proj-orbitpage-e2e-only-123456789 ORBITPAGE_TEST_OPENAI_RESPONSES_URL=http://127.0.0.1:${fixturePort}/v1/responses ORBITPAGE_API_RATE_LIMIT_MAX=5000 npm run start`,
      url: `http://localhost:${appPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
