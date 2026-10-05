require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let ready = false;
let closing = false;

app.set('trust proxy', 1);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '50mb'
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.status(ready ? 200 : 503)
    .send(ready ? 'OK' : 'Initialising');
});

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  lazyInit();
});

// API clients get a JSON response while services are initialising.
app.use(['/api','/auth','/track'], (req,res,next)=>{
  if(!ready)return res.status(503).json({error:'مرسال بيبدأ التشغيل. جرّب بعد لحظات.'});
  next();
});

async function lazyInit() {
  try {
    const { initDB, pool } = require('./utils/db');
    await initDB();
    await require('./utils/connections-schema').ensureConnectionsSchema();

    const {
      ensureSchedulerSchema,
      startScheduler
    } = require('./utils/scheduler');

    await ensureSchedulerSchema();

    const pgSession = require('connect-pg-simple')(session);

    if (!process.env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET is required');
    }

    app.use(session({
      store: new pgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: false
      }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000
      }
    }));

    app.use('/auth', require('./routes/auth'));
    app.use('/api/companies', require('./routes/companies'));
    app.use('/api/cv', require('./routes/cv'));

    // إعدادات أسلوب الكتابة والتحليل والمعاينة
    app.use('/api/writing', require('./routes/writing'));

    // مساعد مرسال — يحتاج routes/support.js وباقي ملفات المساعد
    app.use('/api/support', require('./routes/support'));

    app.use('/api/email', require('./routes/email'));
    app.use('/api/settings', require('./routes/settings'));
    app.use('/api/accounts', require('./routes/accounts'));
    app.use('/api/providers', require('./routes/providers'));
    app.use('/api/whatsapp', require('./routes/whatsapp'));
    app.use('/track', require('./routes/tracking'));

    app.use('/api', (req, res) => {
      res.status(404).json({
        error: 'المسار غير موجود'
      });
    });

    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.use((error,req,res,next)=>{
      if(res.headersSent)return next(error);
      const status=error.code==='LIMIT_FILE_SIZE'?413:(Number(error.status)||500);
      const message=status===413?'الملف أكبر من الحجم المسموح.':status<500?error.message:'حصلت مشكلة أثناء تنفيذ الطلب. حاول مرة تانية.';
      console.error('Request failed:',req.method,req.path,error.code||error.name);
      res.status(status).json({error:message});
    });

    await require('./utils/whatsapp').restoreSessions();

    startScheduler();
    ready = true;

    console.log('All systems initialised.');
  } catch (err) {
    console.error('Init error:', err.message);
    process.exit(1);
  }
}

async function close() {
  if (closing) return;

  closing = true;
  ready = false;

  require('./utils/scheduler').stopScheduler();
  server.close();

  const timer = setTimeout(() => process.exit(0), 10000);
  timer.unref();

  await require('./utils/whatsapp').shutdown();
  await require('./utils/db').pool.end();

  process.exit(0);
}

process.on('SIGTERM', () => {
  close().catch(() => process.exit(1));
});

process.on('SIGINT', () => {
  close().catch(() => process.exit(1));
});
