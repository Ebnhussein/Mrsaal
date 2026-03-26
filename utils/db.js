// utils/db.js — PostgreSQL database setup
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT) || 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
  family: 4
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function get(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

async function all(text, params) {
  const res = await query(text, params);
  return res.rows;
}

async function run(text, params) {
  return await query(text, params);
}

async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      email TEXT,
      name TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry BIGINT,
      gemini_key TEXT,
      gemini_model TEXT DEFAULT 'gemini-2.0-flash',
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS cv_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT,
      content TEXT,
      filename TEXT,
      pdf_data BYTEA,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      field TEXT,
      location TEXT,
      status TEXT DEFAULT 'pending',
      selected INTEGER DEFAULT 1,
      scheduled_at BIGINT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
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
      last_opened_at BIGINT,
      replied INTEGER DEFAULT 0,
      reply_text TEXT,
      sent_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      subject_template TEXT,
      instructions TEXT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      company_id TEXT NOT NULL,
      scheduled_at BIGINT NOT NULL,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS session (
      sid TEXT NOT NULL PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
  `);

  -- Update existing users to new model
  await query(`
    UPDATE users SET gemini_model = 'gemini-2.0-flash'
    WHERE gemini_model = 'gemini-1.5-flash' OR gemini_model IS NULL
  `);

  console.log('✅ Database tables ready');
}

module.exports = { pool, query, get, all, run, initDB };
