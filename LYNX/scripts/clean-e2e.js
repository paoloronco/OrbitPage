import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Risolviamo il percorso della cartella dati E2E (nella root di LYNX)
const e2eDataDir = path.resolve(__dirname, '../e2e-data');

if (fs.existsSync(e2eDataDir)) {
  try {
    // Rimuoviamo la cartella in modo ricorsivo e forzato
    fs.rmSync(e2eDataDir, { recursive: true, force: true });
    console.log('🛡️  E2E Cleanup: Cartella del database temporaneo pulita con successo:', e2eDataDir);
  } catch (err) {
    console.error('❌ E2E Cleanup: Impossibile pulire la cartella del database temporaneo:', err);
    process.exit(1);
  }
}

try {
  // Ricreiamo la cartella e un file database vuoto (0-byte)
  // Questo impedisce al server Express di copiare il database locale di sviluppo (legacyDbPath)
  // garantendo che i test partano sempre con un database realmente vuoto.
  fs.mkdirSync(e2eDataDir, { recursive: true });
  fs.writeFileSync(path.join(e2eDataDir, 'lynx.db'), '');
  console.log('🛡️  E2E Cleanup: Inizializzato database di test vuoto (0-byte) in:', path.join(e2eDataDir, 'lynx.db'));
} catch (err) {
  console.error('❌ E2E Cleanup: Errore durante la creazione del database di test vuoto:', err);
  process.exit(1);
}
