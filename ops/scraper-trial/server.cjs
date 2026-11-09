'use strict';
// Local-only sandbox: independent embedded PostgreSQL, a test session and only
// the discovery APIs. Never loads the production server or delivery workers.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),crypto=require('node:crypto');
const express=require('express'),session=require('express-session'),{PGlite}=require('@electric-sql/pglite');
const {build}=require('../../scripts/build-scraper-extension.cjs');
const root=path.resolve(__dirname,'../..');
function load(relative,deps){const filename=path.join(root,relative),requireFile=Module.createRequire(filename),box={module:{exports:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:requireFile(id),process,console,Buffer,URL};vm.runInNewContext(fs.readFileSync(filename,'utf8'),box,{filename});return box.module.exports;}
async function start({port=Number(process.env.MRSAAL_TRIAL_PORT)||4174,dataDir=path.resolve(root,'.mrsaal-trial')}={}){
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid local trial port.');
 fs.mkdirSync(dataDir,{recursive:true});const pg=new PGlite(path.join(dataDir,'postgres'));await pg.waitReady;
 let tail=Promise.resolve();
 const db={get:async(s,p)=>(await pg.query(s,p)).rows[0],all:async(s,p)=>(await pg.query(s,p)).rows,run:(s,p)=>p?pg.query(s,p):pg.exec(s),pool:{connect:async()=>{
  const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
  return {query:(s,p)=>p?pg.query(s,p):pg.exec(s),release};
 }}};
 let server;
 try{
  const schema=fs.readFileSync(path.join(root,'utils/db.js'),'utf8').match(/await query\(`([\s\S]*?)`\);/)[1];await pg.exec(schema);
  await load('utils/launch-schema.js',{'./db':db}).ensureLaunchSchema();
  await pg.query("INSERT INTO users(id,name,email) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",['scraper-trial-user','حساب تجربة مرسال','trial@mrsaal.test']);
  const store=load('utils/discovery/store.js',{'../db':db});
  const routes=load('routes/discovery.js',{'../utils/db':db,'../utils/discovery/store':store});
  const app=express(),base='http://localhost:'+port;
  app.disable('x-powered-by');
  app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
   if(req.headers.host!==new URL(base).host)return res.status(403).json({error:'Trial requires the localhost address printed in the console.'});
   if(!['GET','HEAD'].includes(req.method)&&req.get('Origin')!==base)return res.status(403).json({error:'Trial imports must originate from the local workspace.'});next();});
  app.use(express.json({limit:'2mb'}));app.use(session({secret:crypto.randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'strict'}}));
  app.get('/app',(req,res)=>{req.session.userId='scraper-trial-user';res.type('html').send(fs.readFileSync(path.join(__dirname,'index.html'),'utf8'));});
  app.use('/api', (req,res,next)=>{if(req.session.userId!=='scraper-trial-user')return res.status(401).json({error:'افتح صفحة تجربة مرسال أولًا.'});next();});
  app.use('/api/discovery',routes);
  app.get('/api/companies',async(req,res,next)=>{try{res.json({companies:await db.all('SELECT * FROM companies WHERE user_id=$1 ORDER BY created_at DESC LIMIT 250',['scraper-trial-user'])});}catch(e){next(e);}});
  app.get('/trial.js',(_,res)=>res.type('js').send(fs.readFileSync(path.join(__dirname,'trial.js'),'utf8')));
  app.get('/extension.zip',(_,res)=>{try{const bundle=build({appOrigin:base,out:path.join(dataDir,'extension')});res.download(bundle.zip,'mrsaal-scraper-trial.zip');}catch(e){res.status(500).json({error:e.message});}});
  app.use((_,res)=>res.status(404).json({error:'This sandbox only exposes discovery and saved results.'}));
  app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.status?e.message:'Trial request failed.'}));
  server=await new Promise((resolve,reject)=>{const s=app.listen(port,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
  return {url:base+'/app',close:async()=>{await new Promise(resolve=>server.close(resolve));await pg.close();}};
 }catch(e){if(server)await new Promise(resolve=>server.close(resolve));await pg.close();throw e;}
}
if(require.main===module)start().then(trial=>{console.log('Mrsaal Scraper TRIAL (local test data only): '+trial.url);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>trial.close().then(()=>process.exit(0)));}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={start};
