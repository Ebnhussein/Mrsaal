// server.js — Main server entry point (FIXED: Lazy loading for Railway healthcheck)
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy
app.set('trust proxy', 1);

// ── SESSION (Using memory store for stable startup on Railway)
app.use(session({
  secret: process.env.SESSION_SECRET || 'mrsaal-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// ── MIDDLEWARE
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── HEALTH CHECK (Must be at top and fast)
app.get('/health', (req, res) => res.status(200).send('OK'));

// ── START LISTENING FIRST (To pass Railway Healthcheck instantly)
app.listen(PORT, () => {
  console.log(`\n🚀 [ROOT-FIX]: Server is listening on port ${PORT}. Healthcheck passed!`);
  
  // ── LAZY LOAD EVERYTHING ELSE (After server is up)
  try {
    console.log('⏳ Lazy loading routes and modules...');

    // Routes
    app.use('/auth', require('./routes/auth'));
    app.use('/api/companies', require('./routes/companies'));
    app.use('/api/cv', require('./routes/cv'));
    app.use('/api/email', require('./routes/email'));
    app.use('/api/settings', require('./routes/settings'));
    app.use('/api/whatsapp', require('./routes/whatsapp'));
    app.use('/track', require('./routes/tracking'));

    // Catch-all
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

    console.log('✅ Routes loaded.');

    // Utils
    const { startScheduler } = require('./utils/scheduler');
    startScheduler();

    const { initWhatsApp } = require('./utils/whatsapp');
    initWhatsApp();

    console.log('✨ All systems initialised in background.');
  } catch (err) {
    console.error('❌ Delayed load error:', err);
  }
});
