// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('OK'));

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server listening on port ${PORT}`);
  lazyInit();
});

async function lazyInit() {
  try {
    console.log('⏳ Initialising database...');

    const { initDB, pool } = require('./utils/db');
    await initDB();

    const pgSession = require('connect-pg-simple')(session);
    app.use(session({
      store: new pgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: false
      }),
      secret: process.env.SESSION_SECRET || 'mrsaal-dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000
      }
    }));

    app.use('/auth',          require('./routes/auth'));
    app.use('/api/companies', require('./routes/companies'));
    app.use('/api/cv',        require('./routes/cv'));
    app.use('/api/email',     require('./routes/email'));
    app.use('/api/settings',  require('./routes/settings'));
    app.use('/api/whatsapp',  require('./routes/whatsapp'));
    app.use('/track',         require('./routes/tracking'));

    app.get('*', (req, res) =>
      res.sendFile(path.join(__dirname, 'public', 'index.html'))
    );

    console.log('✅ Routes loaded.');

    const { startScheduler } = require('./utils/scheduler');
    startScheduler();

    const { initWhatsApp } = require('./utils/whatsapp');
    initWhatsApp();

    console.log('✨ All systems initialised.');
  } catch (err) {
    console.error('❌ Init error:', err);
    process.exit(1);
  }
}
