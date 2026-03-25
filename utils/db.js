// utils/db.js — SQLite database setup
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'mrsaal.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE,
    email TEXT,
    name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry INTEGER,
    gemini_key TEXT,
    gemini_model TEXT DEFAULT 'gemini-1.5-flash',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS cv_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    content TEXT,
    filename TEXT,
    pdf_data BLOB,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    field TEXT,
    location TEXT,
    status TEXT DEFAULT 'pending',
    selected INTEGER DEFAULT 1,
    scheduled_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_id TEXT,
    company_name TEXT,
    company_email TEXT,
    subject TEXT,
    body TEXT,
    status TEXT,
    channel TEXT DEFAULT 'email',
    reason TEXT,
    message_id TEXT,
    thread_id TEXT,
    open_count INTEGER DEFAULT 0,
    last_opened_at INTEGER,
    replied INTEGER DEFAULT 0,
    reply_text TEXT,
    sent_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject_template TEXT,
    instructions TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    scheduled_at INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// --- Migrations for existing databases ---
const migrations = [
  { table: 'users', col: 'gemini_key', type: 'TEXT' },
  { table: 'users', col: 'gemini_model', type: "TEXT DEFAULT 'gemini-1.5-flash'" },
  { table: 'cv_profiles', col: 'pdf_data', type: 'BLOB' },
  { table: 'email_log', col: 'open_count', type: 'INTEGER DEFAULT 0' },
  { table: 'email_log', col: 'last_opened_at', type: 'INTEGER' },
  { table: 'email_log', col: 'replied', type: 'INTEGER DEFAULT 0' },
  { table: 'email_log', col: 'reply_text', type: 'TEXT' },
  { table: 'email_log', col: 'channel', type: "TEXT DEFAULT 'email'" }
];

migrations.forEach(m => {
  try {
    db.prepare(`ALTER TABLE ${m.table} ADD COLUMN ${m.col} ${m.type}`).run();
    console.log(`✅ Migration: Added ${m.col} to ${m.table}`);
  } catch (err) {
    // Column likely already exists
  }
});

module.exports = db;
