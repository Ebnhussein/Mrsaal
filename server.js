require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let ready = false;
let closing = false;
let services = null;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(require('./middleware/api-errors').locale);
app.use(require('./middleware/security-headers'));
app.use(require('./middleware/request-guard'));
app.get('/robots.txt',(req,res)=>res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: https://mrsaal.ebnhussein.co/sitemap.xml\n')); 

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '2mb'
}));

app.get('/privacy.html',(req,res)=>res.redirect(301,'/ar/privacy'));
app.get('/terms.html',(req,res)=>res.redirect(301,'/ar/terms'));
app.get('/index.html', (req,res)=>res.redirect('/app'));
app.use(express.static(path.join(__dirname, 'public'), {index:false}));

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

// Heavy modules load after the port is open so /health answers while the app initialises.
// Every dependency is listed here once; the steps below keep their original order.
function loadServices() {
  return {
    db: require('./utils/db'),
    migrate: require('./utils/migrate'),
    connectionsSchema: require('./utils/connections-schema'),
    replyTracker: require('./utils/reply-tracker'),
    helpdesk: require('./utils/helpdesk'),
    websiteSchema: require('./utils/website-schema'),
    scheduler: require('./utils/scheduler'),
    notifications: require('./utils/notifications'),
    launchSchema: require('./utils/launch-schema'),
    accessControl: require('./utils/access-control'),
    mrsaalwa: require('./utils/mrsaalwa'),
    whatsapp: require('./utils/whatsapp/baileys'),
    campaignWorker: require('./utils/campaign-worker'),
    middleware: {
      mutationRate: require('./middleware/mutation-rate'),
      adminSession: require('./middleware/admin-session'),
      apiErrors: require('./middleware/api-errors')
    },
    routes: {
      admin: require('./routes/admin'),
      site: require('./routes/site'),
      notifications: require('./routes/notifications'),
      tickets: require('./routes/tickets'),
      supabaseAuth: require('./routes/supabase-auth'),
      auth: require('./routes/auth'),
      launch: require('./routes/launch'),
      campaigns: require('./routes/campaigns'),
      companies: require('./routes/companies'),
      cv: require('./routes/cv'),
      writing: require('./routes/writing'),
      support: require('./routes/support'),
      aiQueue: require('./routes/ai-queue'),
      email: require('./routes/email'),
      settings: require('./routes/settings'),
      accounts: require('./routes/accounts'),
      providers: require('./routes/providers'),
      whatsapp: require('./routes/whatsapp'),
      openwaTrial: require('./routes/openwa-trial'),
      tracking: require('./routes/tracking')
    }
  };
}

async function lazyInit() {
  try {
    services = loadServices();
    const { db, routes, middleware } = services;
    const { initDB, pool } = db;
    await initDB();
    await services.migrate.migrate(pool);
    await services.connectionsSchema.ensureConnectionsSchema();
    await services.replyTracker.ensureReplySchema();
    await services.helpdesk.ensureHelpdesk();
    await services.websiteSchema.ensureWebsiteSchema();
    await services.scheduler.ensureSchedulerSchema();
    await services.notifications.ensureNotifications();
    await services.launchSchema.ensureLaunchSchema();

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

    app.use(middleware.mutationRate);
    app.use(middleware.adminSession);
    app.use(services.accessControl.gate);
    app.use(services.helpdesk.monitor);
    app.use('/api/admin', routes.admin);
    app.use(routes.site);
    app.use('/api/notifications', routes.notifications);
    app.use('/api/tickets', routes.tickets);
    app.use('/auth', routes.supabaseAuth);
    app.use('/auth', routes.auth);
    app.use('/api/launch', routes.launch);
    app.use('/api/campaigns', routes.campaigns);
    app.use('/api/companies', routes.companies);
    app.use('/api/cv', routes.cv);

    // إعدادات أسلوب الكتابة والتحليل والمعاينة
    app.use('/api/writing', routes.writing);

    // مساعد مرسال — يحتاج routes/support.js وباقي ملفات المساعد
    app.use('/api/support', routes.support);
    app.use('/api/ai-queue', routes.aiQueue);

    app.use('/api/email', routes.email);
    app.use('/api/settings', routes.settings);
    app.use('/api/accounts', routes.accounts);
    app.use('/api/providers', routes.providers);
    app.use('/api/whatsapp', routes.whatsapp);
    app.use('/api/whatsapp-trial', routes.openwaTrial);
    app.use('/track', routes.tracking);

    app.use('/api', (req, res) => {
      res.status(404).json({
        error: 'المسار غير موجود'
      });
    });

    app.get('*', (req, res) => {
      res.status(404).type('text/plain').send('Not found');
    });

    app.use(middleware.apiErrors.handler);

    await services.mrsaalwa.ensureSchema();
    await services.whatsapp.restoreSessions();
    services.mrsaalwa.start();

    services.scheduler.startScheduler();
    services.notifications.startNotifications();
    services.campaignWorker.start();
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

  // Before initialisation finishes there is nothing running to stop.
  services?.scheduler.stopScheduler();
  services?.campaignWorker.stop();
  services?.notifications.stopNotifications();
  server.close();

  const timer = setTimeout(() => process.exit(0), 10000);
  timer.unref();

  services?.mrsaalwa.stop();
  await services?.whatsapp.shutdown();
  await services?.db.pool.end();

  process.exit(0);
}

process.on('SIGTERM', () => {
  close().catch(() => process.exit(1));
});

process.on('SIGINT', () => {
  close().catch(() => process.exit(1));
});
