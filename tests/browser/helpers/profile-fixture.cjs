'use strict';
// Isolated loopback-only QA harness. All authentication, AI and providers below are fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),express=require('express');
const root=path.resolve(__dirname,'../../..');
function load(file,deps){const filename=path.join(root,file),native=require('node:module').createRequire(filename),box={module:{exports:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:native(id),console,process,Buffer,URL};vm.runInNewContext(fs.readFileSync(filename,'utf8'),box);return box.module.exports;}
async function start(port=0){
 const {PGlite}=require('@electric-sql/pglite'),pg=new PGlite(),state={previewError:false,saveError:false,delay:0,sends:[]};
 const db={get:async(s,p)=>(await pg.query(s,p)).rows[0],all:async(s,p)=>(await pg.query(s,p)).rows,run:async(s,p)=>p?pg.query(s,p):pg.exec(s),pool:{connect:async()=>({query:async(s,p)=>pg.query(s,p),release(){}})}};
 await pg.exec(fs.readFileSync(path.join(root,'utils/db.js'),'utf8').match(/await query\(`([\s\S]*?)`\);/)[1]);await load('utils/connections-schema.js',{'./db':db,'./connection-secrets':{seal:()=>{throw new Error('Fixture cannot seal live credentials');}}}).ensureConnectionsSchema();await load('utils/launch-schema.js',{'./db':db}).ensureLaunchSchema();await pg.exec("INSERT INTO users(id,name,email) VALUES('browser-user','Demo User','demo@example.test'),('other-user','Other User','other@example.test'); INSERT INTO companies(id,user_id,name,email,phone,field,location) VALUES('demo-company','browser-user','Demo Studio','jobs@example.test','+201012345678','Design','Cairo')");
 const auth={requireAuth(req,res,next){req.session={userId:'browser-user'};next();}},store=load('utils/cv/store.js',{'../db':db}),facts=require(path.join(root,'utils/cv/builder'));
 const ai={async generate(args,channel){return facts.finalize({subject:channel==='email'?'Collaboration with Demo Studio':'',body:args.applicationMode==='portfolio'?'Hello Demo Studio, I would like to collaborate on a freelance project.':'Hello Demo Studio, I would like to apply for a suitable opportunity.',review:[],reviewed:false},args);}};
 const drafts=load('utils/delivery/drafts.js',{'../db':db}),editSafety={begin:async()=>({})};
 const delivery={async deliver(userId,options){const row=await store.active(userId,options.cvId),a=await facts.attachment(row);state.sends.push({...options,kind:row?.kind,attachment:a?{filename:a.filename,mimeType:a.mimeType}:null});return {ok:true,status:'sent',channel:options.channel};}};
 const deps={'../utils/db':db,'../middleware/auth':auth,'../utils/cv/store':store,'../utils/ai/index':{...ai,generateEmail:a=>ai.generate(a,'email'),generateWhatsAppMessage:async a=>(await ai.generate(a,'whatsapp')).body},'../utils/delivery/drafts':drafts,'../utils/delivery/edit-safety':editSafety,'../utils/auth/access-control':{checkToolAccess:async()=>{}},'../utils/gmail/accounts':{resolveAccount:async()=>({gmail_account_id:'demo-sender',email:'sender@example.test'})},'../utils/whatsapp/service':{requireConnected:async()=>({})},'../utils/delivery/index':delivery,'../utils/delivery/schedule-send':load('utils/delivery/schedule-send.js',{'../db':db})};
 const app=express();app.use(express.json({limit:'2mb'}));app.use((req,res,next)=>{req.session={userId:'browser-user'};next();});
 app.post('/__test/control',(req,res)=>{Object.assign(state,req.body);res.json({ok:true});});app.get('/__test/state',async(req,res)=>res.json({sends:state.sends,versions:await db.all('SELECT id,kind,name FROM cv_profiles WHERE user_id=$1',['browser-user']),jobs:await db.all('SELECT cv_id,status FROM scheduled_jobs')}));
 app.use('/api/cv',async(req,res,next)=>{if(state.delay)await new Promise(r=>setTimeout(r,state.delay));if(req.path==='/builder/preview'&&state.previewError||req.path==='/builder'&&state.saveError)return res.status(503).json({error:'Connection interrupted. Your draft is still here.'});next();},load('routes/cv.js',deps));
 app.use('/api/writing',load('routes/writing.js',deps));app.use('/api/email',load('routes/email.js',deps));app.use('/api/campaigns',load('routes/campaigns.js',deps));
 app.get('/auth/status',(req,res)=>res.json({loggedIn:true,id:'browser-user',name:'Demo User',email:'demo@example.test'}));
 app.get('/api/companies',async(req,res)=>res.json({companies:await db.all('SELECT * FROM companies WHERE user_id=$1',['browser-user']),nextOffset:null}));
 app.get('/api/accounts',(req,res)=>res.json({accounts:[{id:'demo-sender',email:'sender@example.test',connected:true}],activeId:'demo-sender'}));
 app.get('/api/providers',(req,res)=>res.json({source:'mrsaal',platformConfigured:true,providers:[],fallback:false}));
 app.get('/api/whatsapp/status',(req,res)=>res.json({status:'disconnected'}));
 app.get('/api/launch/resources',(req,res)=>res.json({used:{storageBytes:0,cv:0},limits:{storageBytes:104857600,cv:10}}));
 app.get('/api/discovery/*',(req,res)=>res.json({enabled:false,imports:[],jobs:[],nextOffset:null}));
 app.get('/api/notifications',(req,res)=>res.json({items:[],fresh:[],unread:0,settings:{types:{},sound:false,toast:false},admin:false,serverTime:new Date().toISOString()}));
 app.get('/api/*',(req,res)=>res.json({}));
 app.use('/assets',express.static(path.join(root,'public/assets')));app.use('/vendor',express.static(path.join(root,'public/vendor')));
 app.get(['/','/app'],(req,res)=>{let html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');if(req.query.lang==='en')html=html.replace(/lang="ar"/,'lang="en"').replace(/dir="rtl"/,'dir="ltr"');html=html.replace('<body class=', '<body data-profile-qa="true" class=');html=html.replace('<body data-profile-qa="true" class="mrsaal-workspace stitch-workspace">','<body data-profile-qa="true" class="mrsaal-workspace stitch-workspace"><aside role="note" style="text-align:center;padding:10px;font:12px Arial;background:#e8f6ef;color:#174c3c">بيئة اختبار محلية · بيانات وهمية · الإرسال محاكاة — Local QA, simulated messages</aside>');res.send(html);});
 app.use((e,req,res,next)=>{console.error('QA request error',req.path,e.message);res.status(e.status||500).json({error:e.message});});
 const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.on('listening',r));return {server,pg,db,store,state,url:'http://127.0.0.1:'+server.address().port,async close(){await new Promise(r=>server.close(r));await pg.close();}};
}
module.exports={start};if(require.main===module)start(4176).then(f=>console.log('Profile QA ready at '+f.url+' — isolated sample data; no live messages.')).catch(e=>{console.error(e);process.exitCode=1;});
