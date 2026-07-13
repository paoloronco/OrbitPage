import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// DATA_DIR is set to /app/data in Docker (see Dockerfile ENV).
// When running locally without the env var, data lives next to server.js.
const dataDir = process.env.DATA_DIR || __dirname;
const dbPath = join(dataDir, 'orbitpage.db');
const legacySourceDbPath = join(__dirname, 'lynx.db');
const legacyDataDirDbPath = join(dataDir, 'lynx.db');

// If the app is configured to use a separate persistent data directory,
// preserve any existing legacy database stored next to the server source.
if (dataDir !== __dirname && fs.existsSync(legacySourceDbPath) && !fs.existsSync(dbPath)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.copyFileSync(legacySourceDbPath, dbPath);
    console.log('Copied legacy database from', legacySourceDbPath, 'to', dbPath);
  } catch (copyErr) {
    console.error('Failed to migrate legacy database to DATA_DIR:', copyErr);
  }
}

if (fs.existsSync(legacyDataDirDbPath) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(legacyDataDirDbPath, dbPath);
    console.log('Copied legacy database from', legacyDataDirDbPath, 'to', dbPath);
  } catch (copyErr) {
    console.error('Failed to migrate legacy database name:', copyErr);
  }
}

// Create database connection with proper configuration for persistence
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
    // Enable foreign keys and other PRAGMAs
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA synchronous = NORMAL');
      db.run('PRAGMA foreign_keys = ON');
    });
  }
});

// Initialize database tables
export const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Admin users table
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Public page data table
      db.run(`
        CREATE TABLE IF NOT EXISTS profile_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          bio TEXT,
          avatar TEXT,
          social_links TEXT,
          show_avatar BOOLEAN DEFAULT 1,
          name_font_size TEXT,
          bio_font_size TEXT,
          tab_title TEXT,
          meta_description TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure show_avatar column exists for existing databases (best-effort migration)
      db.run(`ALTER TABLE profile_data ADD COLUMN show_avatar BOOLEAN DEFAULT 1`, (err) => { /* ignore if exists */ });
  // Ensure per-profile font size columns exist (best-effort migration)
  db.run(`ALTER TABLE profile_data ADD COLUMN name_font_size TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE profile_data ADD COLUMN bio_font_size TEXT`, (err) => { /* ignore if exists */ });
      // Add profile meta columns
      db.run(`ALTER TABLE profile_data ADD COLUMN tab_title TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE profile_data ADD COLUMN meta_description TEXT`, (err) => { /* ignore if exists */ });
      // Footer and browser bar customization
      db.run(`ALTER TABLE profile_data ADD COLUMN footer_text TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE profile_data ADD COLUMN favicon TEXT`, (err) => { /* ignore if exists */ });
      // Analytics integrations
      db.run(`ALTER TABLE profile_data ADD COLUMN google_analytics_id TEXT`, (err) => { /* ignore if exists */ });
      // Legal policy links (configurable, not hardcoded — required for open-source deployments)
      db.run(`ALTER TABLE profile_data ADD COLUMN privacy_policy_url TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE profile_data ADD COLUMN cookie_policy_url TEXT`, (err) => { /* ignore if exists */ });
      // Admin onboarding preference. Default enabled so new admin/customer sessions see the guided setup.
      db.run(`ALTER TABLE profile_data ADD COLUMN admin_onboarding_enabled BOOLEAN DEFAULT 1`, (err) => { /* ignore if exists */ });
      // Per-profile visual overrides. JSON keeps the schema extensible while old profiles inherit the active theme.
      db.run(`ALTER TABLE profile_data ADD COLUMN appearance TEXT`, (err) => { /* ignore if exists */ });

      // Role-based access control — default 'admin' keeps backward compatibility for the main admin user
      db.run(`ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'admin'`, (err) => { /* ignore if exists */ });

      // Links table
      db.run(`
        CREATE TABLE IF NOT EXISTS links (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          url TEXT,
          icon TEXT,
          type TEXT DEFAULT 'link',
          text_items TEXT,
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Ensure columns for link customization exist (best-effort migrations)
      db.run(`ALTER TABLE links ADD COLUMN background_color TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE links ADD COLUMN text_color TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE links ADD COLUMN size TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE links ADD COLUMN icon_type TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE links ADD COLUMN content TEXT`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE links ADD COLUMN hide_url BOOLEAN DEFAULT 0`, (err) => { /* ignore if exists */ });
  // Add columns for per-link typography and alignment
  db.run(`ALTER TABLE links ADD COLUMN title_font_family TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN description_font_family TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN text_alignment TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN title_font_size TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN description_font_size TEXT`, (err) => { /* ignore if exists */ });
  // Click analytics
  db.run(`ALTER TABLE links ADD COLUMN click_count INTEGER DEFAULT 0`, (err) => { /* ignore if exists */ });
  // Link scheduler
  db.run(`ALTER TABLE links ADD COLUMN start_date TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN end_date TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN status TEXT DEFAULT 'live'`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN start_time TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN end_time TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN timezone TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN campaign_name TEXT`, (err) => { /* ignore if exists */ });
  // Smart CTA metadata and dedicated analytics
  db.run(`ALTER TABLE links ADD COLUMN cta_action TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN cta_click_count INTEGER DEFAULT 0`, (err) => { /* ignore if exists */ });
  // Cover / header image
  db.run(`ALTER TABLE links ADD COLUMN cover_image TEXT`, (err) => { /* ignore if exists */ });
  db.run(`ALTER TABLE links ADD COLUMN cover_image_alt TEXT`, (err) => { /* ignore if exists */ });

      // Cookie consent configuration table
      // mode: 'disabled' | 'hardcoded' | 'builder'
      // enabled: whether the active mode is live (1=yes, 0=no)
      // full_config: JSON blob with { hardcoded: {...}, builder: {...} }
      db.run(`
        CREATE TABLE IF NOT EXISTS cookie_consent_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mode TEXT NOT NULL DEFAULT 'disabled',
          enabled INTEGER NOT NULL DEFAULT 0,
          full_config TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Error creating cookie_consent_config table:', err);
      });

      // Public crawler/discovery text files such as robots.txt, llms.txt, humans.txt, security.txt, and ai.txt.
      db.run(`
        CREATE TABLE IF NOT EXISTS text_files (
          file_key TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Error creating text_files table:', err);
      });

      // Theme configuration table
      db.run(`
        CREATE TABLE IF NOT EXISTS theme_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          primary_color TEXT DEFAULT '#007bff',
          background_color TEXT DEFAULT '#ffffff',
          text_color TEXT DEFAULT '#000000',
          button_style TEXT DEFAULT 'rounded',
          full_config TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          // Add full_config column if it doesn't exist (for existing databases)
          db.run(`
            ALTER TABLE theme_config ADD COLUMN full_config TEXT
          `, (alterErr) => {
            // Ignore error if column already exists
          });
          
          // Insert default theme if none exists
          db.get('SELECT COUNT(*) as count FROM theme_config', (err, row) => {
            if (!err && row.count === 0) {
              db.run(`
                INSERT INTO theme_config (primary_color, background_color, text_color, button_style)
                VALUES ('#007bff', '#ffffff', '#000000', 'rounded')
              `);
            }
          });
          resolve();
        }
      });
    });
  });
};

// Database query helpers with better error handling
export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Database get error:', { sql, params, error: err.message });
        return reject(err);
      }
      resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database all error:', { sql, params, error: err.message });
        return reject(err);
      }
      resolve(rows);
    });
  });
};

export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('Database run error:', { 
          sql, 
          params, 
          error: err.message,
          stack: err.stack 
        });
        return reject(err);
      }
      resolve(this);
    });
  });
};

// Transaction helper
export const withTransaction = async (callback) => {
  try {
    await dbRun('BEGIN TRANSACTION');
    const result = await callback();
    await dbRun('COMMIT');
    return result;
  } catch (error) {
    await dbRun('ROLLBACK');
    throw error;
  }
};

export default db;
