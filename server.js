// server.js — Main server entry point
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Session store (file-based, no DB dependency)
const SQLiteStore = require('connect-sqlite3')(session);
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Trust proxy is required when hosting on Railway/Heroku so secure cookies work
app.set('trust proxy', 1);

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
  secret: process.env.SESSION_SECRET || 'mrsaal-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// ── Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Static files
app.use(express.static(path.join(__dirname, 'public')));

// ── Roots
app.get('/health', (req, res) => res.status(200).send('OK'));

app.use('/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/cv', require('./routes/cv'));
app.use('/api/email', require('./routes/email'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/track', require('./routes/tracking'));

// ── Catch-all → serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START SERVER IMMEDIATELY (Crucial for Railway Healthcheck)
app.listen(PORT, () => {
  console.log(`\n🚀 مرسال يعمل على منفذ: ${PORT}`);
  
  // ── Delayed initializations
  setTimeout(() => {
    try {
      // ── Start scheduler
      const { startScheduler } = require('./utils/scheduler');
      startScheduler();

      // ── Start WhatsApp client
      const { initWhatsApp } = require('./utils/whatsapp');
      initWhatsApp();
    } catch (err) {
      console.error('Delayed startup error:', err);
    }
  }, 1000);
});
