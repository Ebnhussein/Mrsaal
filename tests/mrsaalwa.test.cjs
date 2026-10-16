'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
const provider=require('../utils/mrsaalwa-gateway');
const sid='11111111-2222-4333-8444-555555555555',sid2='22222222-2222-4333-8444-555555555555';
const response=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
function load(file,deps,extra={}){const box={module:{exports:{}},require:id=>{if(!(id in deps))throw new Error('Missing dependency '+id);return deps[id];},process:{env:{}},console,Buffer,setInterval,clearInterval,...extra};vm.runInNewContext(fs.readFileSync(require.resolve(file),'utf8'),box);return box.module.exports;}
test('MrsaalWA gateway validates server config, strict session paths, and phone pairing; never exposes provider payloads',async()=>{
 assert.throws(()=>provider.config({MRSAALWA_BASE_URL:'https://secret:pass@host',MRSAALWA_API_KEY:'key'}),e=>e.code==='MRSAALWA_CONFIG');
 const calls=[],api=provider.createGateway({base:'http://openwa-trial:2785',key:'server-only'},async(url,o)=>{calls.push({url,o});return response({pairingCode:'ABCD1234'});});
 assert.equal(await api.pair(sid,'201012345678'),'ABCD1234');assert(calls[0].url.endsWith('/'+sid+'/pairing-code'));assert.deepEqual(JSON.parse(calls[0].o.body),{phoneNumber:'201012345678'});assert.equal(calls[0].o.headers['X-API-Key'],'server-only');assert.equal(calls[0].o.redirect,'error');
 await assert.rejects(api.pair(sid,'../../other'),e=>e.code==='MRSAALWA_PHONE');assert.throws(()=>api.session('../other'));assert.equal(calls.length,1);
 await assert.rejects(provider.createGateway({base:'http://host',key:'key'},async()=>response({secret:'private'},403)).list(),e=>e.code==='MRSAALWA_AUTH'&&!e.message.includes('private'));
});
test('MrsaalWA exact PDF/caption is one request, and ambiguous acknowledgement is never automatically replayed',async()=>{
 const calls=[],pdf=Buffer.from('%PDF exact bytes'),api=provider.createGateway({base:'http://host',key:'key'},async(u,o)=>{calls.push({u,o});return response({messageId:'true_123@lid_ABC'});});
 const sent=await api.send(sid,'201012345678',{document:pdf,fileName:'CV.pdf',caption:'Reviewed\n\ncaption'});assert.equal(sent.threadId,'123@lid');assert.equal(calls.length,1);const b=JSON.parse(calls[0].o.body);assert.deepEqual(Buffer.from(b.base64,'base64'),pdf);assert.equal(b.caption,'Reviewed\n\ncaption');assert.equal(b.chatId,'201012345678@c.us');
 let attempts=0;const broken=provider.createGateway({base:'http://host',key:'key'},async()=>{attempts++;throw new Error('lost acknowledgement');});await assert.rejects(broken.send(sid,'201012345678',{text:'hello'}),e=>e.deliveryUncertain===true&&e.beforeSend!==true);assert.equal(attempts,1);
});
async function fixture(){
 const pg=new PGlite();await pg.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT);INSERT INTO users VALUES('owner','owner@test'),('other','other@test');
 CREATE TABLE email_log(id TEXT PRIMARY KEY,user_id TEXT,channel TEXT,status TEXT,message_id TEXT,thread_id TEXT,sent_at BIGINT,whatsapp_delivered_at BIGINT,whatsapp_read_at BIGINT,open_count INTEGER DEFAULT 0,last_opened_at BIGINT,replied INTEGER DEFAULT 0,reply_text TEXT,whatsapp_reply_at BIGINT,whatsapp_reply_message_id TEXT);
 CREATE TABLE delivery_attempts(id TEXT,user_id TEXT,status TEXT);CREATE TABLE campaigns(id TEXT,user_id TEXT,status TEXT,channel TEXT);CREATE TABLE scheduled_jobs(id TEXT,user_id TEXT,status TEXT,log_id TEXT);`);
 const query=(s,a)=>pg.query(s,a),db={get:async(s,a)=>(await query(s,a)).rows[0]||null,all:async(s,a)=>(await query(s,a)).rows,run:(s,a)=>a?query(s,a):pg.exec(s),pool:{connect:async()=>({query,release(){}})}};
 const calls=[],sessions=[],env={MRSAALWA_PUBLIC_BETA:'false',MRSAALWA_ENABLED:'true',MRSAALWA_MAX_SESSIONS:'2'};let legacyStatus='disconnected',startFails=false;
 const g={list:async()=>sessions,create:async name=>{const s={id:calls.filter(c=>c[0]==='create').length?sid2:sid,name,status:'created',engineLoaded:false};sessions.push(s);calls.push(['create',s.id]);return s;},session:async id=>{calls.push(['session',id]);const s=sessions.find(x=>x.id===id);if(!s)throw provider.fail('MRSAALWA_SESSION');return s;},start:async id=>{calls.push(['start',id]);if(startFails)throw provider.fail('MRSAALWA_TIMEOUT');Object.assign(sessions.find(x=>x.id===id),{status:'qr_ready',engineLoaded:true});},qr:async()=> 'data:image/png;base64,dGVzdA==',pair:async(id,p)=>{calls.push(['pair',id,p]);return 'ABCD1234';},logout:async id=>calls.push(['logout',id]),remove:async id=>{calls.push(['remove',id]);sessions.splice(sessions.findIndex(x=>x.id===id),1);},send:async(id,phone,content)=>{calls.push(['send',id,phone,content]);return {messageId:'true_'+phone+'@c.us_MSG',threadId:phone+'@c.us'};},messages:async()=>[]};
 const deps={crypto:require('crypto'),'./db':db,'./mrsaalwa-gateway':{...provider,config:()=>({}),createGateway:()=>g},'./whatsapp-content':require('../utils/whatsapp-content'),'./helpdesk':{isAdmin:async()=>false},'./access-control':{checkToolAccess:async()=>{}},'./whatsapp':{status:()=>({status:legacyStatus})},'./notifications':{whatsappDisconnected(){}},'./whatsappTracking':{receipt:async(...args)=>calls.push(['receipt',...args])}};
 const beta=load('../utils/mrsaalwa',deps,{process:{env}});await beta.ensureSchema();
 return {pg,db,beta,g,calls,sessions,env,setLegacy:s=>legacyStatus=s,setStartFailure:v=>startFails=v,grant:async id=>{await query('INSERT INTO whatsapp_preferences(user_id,beta_allowed) VALUES($1,true) ON CONFLICT(user_id) DO UPDATE SET beta_allowed=true',[id]);},close:()=>pg.close()};
}
test('beta is opt-in; each user gets a distinct server-owned session and QR or phone code',async()=>{
 const f=await fixture();try{await assert.rejects(f.beta.select('owner','mrsaalwa'),e=>e.code==='MRSAALWA_DISABLED');assert.equal(f.calls.length,0);await f.grant('owner');await f.grant('other');await f.beta.select('owner','mrsaalwa');await f.beta.select('other','mrsaalwa');
 await f.beta.connect('owner',{method:'qr'});await f.beta.connect('other',{method:'phone',phone:'201012345678',acknowledge:true});assert.notEqual((await f.beta.profile('owner')).session_id,(await f.beta.profile('other')).session_id);
 assert.equal(f.calls.find(c=>c[0]==='pair')[1],sid2);const state=await f.beta.status('owner');assert.equal(state.status,'qr');assert(state.qr.startsWith('data:image/png'));assert(!Object.hasOwn(state,'session_id'));
 await assert.rejects(f.beta.connect('other',{method:'phone',phone:'201012345678',acknowledge:true}),e=>e.code==='MRSAALWA_PAIR_WAIT');
 }finally{await f.close();}
});
test('session ownership survives a failed start; a retry reuses it instead of creating another',async()=>{
 const f=await fixture();try{await f.grant('owner');await f.beta.select('owner','mrsaalwa');f.setStartFailure(true);await assert.rejects(f.beta.connect('owner'),e=>e.code==='MRSAALWA_TIMEOUT');assert.equal((await f.beta.profile('owner')).session_id,sid);f.setStartFailure(false);await f.beta.connect('owner');assert.equal(f.calls.filter(c=>c[0]==='create').length,1);}finally{await f.close();}
});
test('transport changes require disconnect and refuse active schedules or uncertain sends; capacity counts existing engines',async()=>{
 const f=await fixture();try{await f.grant('owner');f.setLegacy('connected');await assert.rejects(f.beta.select('owner','mrsaalwa'),e=>e.code==='MRSAALWA_DISCONNECT_FIRST');f.setLegacy('disconnected');await f.pg.query("INSERT INTO delivery_attempts VALUES('d','owner','uncertain')");await assert.rejects(f.beta.select('owner','mrsaalwa'),e=>e.code==='MRSAALWA_BUSY');await f.pg.exec('DELETE FROM delivery_attempts');await f.beta.select('owner','mrsaalwa');
 f.env.MRSAALWA_MAX_SESSIONS='1';f.sessions.push({id:sid2,name:'external-trial',status:'ready',engineLoaded:true});await assert.rejects(f.beta.connect('owner'),e=>e.code==='MRSAALWA_CAPACITY');await assert.rejects(f.beta.select('owner','baileys'),e=>e.code==='MRSAALWA_DISCONNECT_FIRST');
 }finally{await f.close();}
});
test('send validates attachment before relay, uses only owned session, and revocation fails closed',async()=>{
 const f=await fixture();try{await f.grant('owner');await f.beta.select('owner','mrsaalwa');await f.beta.connect('owner');Object.assign(f.sessions[0],{status:'ready',phone:'201099999999'});
 await assert.rejects(f.beta.send('owner','201012345678','x'.repeat(1025),{data:Buffer.from('%PDF'),filename:'CV.pdf'}),e=>e.beforeSend&&e.code==='MRSAALWA_PDF');assert.equal(f.calls.filter(c=>c[0]==='send').length,0);
 const r=await f.beta.send('owner','201012345678','Hi',{data:Buffer.from('%PDF'),filename:'CV.pdf'});assert.equal(r.provider,'mrsaalwa');assert.equal(r.sessionId,sid);assert.equal(f.calls.find(c=>c[0]==='send')[1],sid);
 await f.pg.query('UPDATE whatsapp_preferences SET beta_allowed=false WHERE user_id=$1',['owner']);await assert.rejects(f.beta.send('owner','201012345678','Hi'),e=>e.code==='MRSAALWA_DISABLED');assert.equal(f.calls.filter(c=>c[0]==='send').length,1);
 }finally{await f.close();}
});
test('selected MrsaalWA cannot silently fall back to Baileys when disabled or unreachable',async()=>{
 let legacySends=0;const deps={'./whatsapp':{sendWhatsAppMessage:async()=>legacySends++},'./mrsaalwa':{profile:async()=>({provider:'mrsaalwa'}),locked:async(id,fn)=>fn(),send:async()=>{throw provider.fail('MRSAALWA_DISABLED',403);}}};
 const service=load('../utils/whatsapp-service',deps);await assert.rejects(service.sendWhatsAppMessage('owner','201012345678','Hi'),e=>e.code==='MRSAALWA_DISABLED');assert.equal(legacySends,0);
});
test('tracking imports only owned sent-message receipts and replies; unrelated user data is untouched',async()=>{
 const f=await fixture();try{await f.grant('owner');await f.beta.select('owner','mrsaalwa');await f.beta.connect('owner');const at=Math.floor(Date.now()/1000)-20;
 await f.pg.query("INSERT INTO email_log(id,user_id,channel,status,message_id,thread_id,sent_at,whatsapp_provider,whatsapp_session_id) VALUES('log','owner','whatsapp','sent','message','201012345678@c.us',$1,'mrsaalwa',$2),('foreign','other','whatsapp','sent','message','201012345678@c.us',$1,'mrsaalwa',$2)",[at,sid]);
 f.g.messages=async(id,filters)=>{assert.equal(id,sid);assert.equal(filters.inlineMedia,undefined);if(filters.messageId)return [{waMessageId:'message',direction:'outgoing',status:'read',chatId:'201012345678@c.us'}];return [{direction:'incoming',chatId:'201012345678@c.us',timestamp:at+10,body:'Thanks',waMessageId:'reply'},{direction:'incoming',chatId:'999@c.us',timestamp:at+12,body:'private unrelated'}];};
 await f.beta.sync();assert.equal((await f.pg.query("SELECT reply_text FROM email_log WHERE id='log'")).rows[0].reply_text,'Thanks');assert.equal((await f.pg.query("SELECT reply_text FROM email_log WHERE id='foreign'")).rows[0].reply_text,null);assert.equal(f.calls.filter(c=>c[0]==='receipt').length,1);
 }finally{await f.close();}
});
test('provider changes between readiness and dispatch fail before sending on either account',async()=>{
 let sends=0;const deps={'./whatsapp':{sendWhatsAppMessage:async()=>sends++},'./whatsapp-policy':require('../utils/whatsapp-policy'),'./mrsaalwa':{profile:async()=>({provider:'mrsaalwa'}),locked:async(id,fn)=>fn(),send:async()=>sends++}};
 const service=load('../utils/whatsapp-service',deps);await assert.rejects(service.sendWhatsAppMessage('owner','201012345678','Hi',null,'baileys'),e=>e.code==='WA_CONNECTION_CHANGED'&&e.beforeSend);assert.equal(sends,0);
});
test('WhatsApp mutation routes require a signed request and recent auth and never accept a client session ID',async()=>{
 const layers=[],routes={},router={use:(...f)=>layers.push(...f),get:(p,...f)=>routes['GET '+p]=f.at(-1),post:(p,...f)=>routes['POST '+p]=f.at(-1)};let captured;
 const deps={express:{Router:()=>router},'../middleware/auth':{requireAuth:(req,res,next)=>req.session?.userId?next():res.status(401).json({})},'../middleware/async-handler':f=>f,'../middleware/recent-auth':require('../middleware/recent-auth'),'../utils/helpdesk':{quota:()=>true},'../utils/whatsapp-service':{connect:async(id,opts)=>{captured={id,opts};return {ok:true};}},'../utils/mrsaalwa':{}};
 load('../routes/whatsapp',deps);const res={statusCode:200,status(s){this.statusCode=s;return this;},json(v){this.body=v;return this;},set(){}};let passed=0;
 layers[0]({session:{}},res,()=>passed++);assert.equal(res.statusCode,401);assert.equal(passed,0);
 layers[2]({get:()=>null,is:()=>true},res,()=>passed++);assert.equal(res.statusCode,403);assert.equal(passed,0);
 layers[3]({session:{userId:'owner'}},res,()=>passed++);assert.equal(res.body.code,'REAUTH_REQUIRED');
 await routes['POST /connect']({session:{userId:'owner'},body:{method:'phone',phone:'201012345678',acknowledge:true,sessionId:'other-session',baseUrl:'http://evil'}},res);assert.equal(captured.id,'owner');assert(!Object.hasOwn(captured.opts,'sessionId'));assert(!Object.hasOwn(captured.opts,'baseUrl'));
});
test('disconnect can delete an unstarted capacity reservation without requiring a live engine',async()=>{
 const f=await fixture();try{await f.grant('owner');await f.beta.select('owner','mrsaalwa');f.setStartFailure(true);await assert.rejects(f.beta.connect('owner'));await f.beta.disconnect('owner');assert.equal((await f.beta.profile('owner')).session_id,null);assert.equal(f.calls.filter(c=>c[0]==='logout').length,0);assert.equal(f.calls.filter(c=>c[0]==='remove').length,1);await f.beta.select('owner','baileys');assert.equal((await f.beta.profile('owner')).provider,'baileys');}finally{await f.close();}
});

test('public beta is available by default, respects explicit admin blocking, and defaults only unlinked accounts',async()=>{
 const f=await fixture();try{delete f.env.MRSAALWA_PUBLIC_BETA;assert.equal(await f.beta.allowed('owner'),true);
 await f.pg.query("INSERT INTO users VALUES('fresh','fresh@test')");await f.beta.select('fresh','baileys');await f.beta.prepareDefault('fresh');assert.equal((await f.beta.profile('fresh')).provider,'baileys');
 const p=await f.beta.prepareDefault('owner');assert.equal(p.provider,'mrsaalwa');assert.equal(p.provider_chosen,true);
 await f.beta.select('owner','baileys');await f.beta.prepareDefault('owner');assert.equal((await f.beta.profile('owner')).provider,'baileys');
 await f.pg.query('UPDATE whatsapp_preferences SET beta_blocked=true WHERE user_id=$1',['owner']);assert.equal(await f.beta.allowed('owner'),false);
 f.setLegacy('connected');await f.beta.prepareDefault('other');assert.equal((await f.beta.profile('other')).provider,'baileys');
 f.setLegacy('disconnected');await f.pg.exec("CREATE TABLE whatsapp_auth(user_id TEXT,key_id TEXT);INSERT INTO whatsapp_auth VALUES('other','creds')");await f.beta.prepareDefault('other');assert.equal((await f.beta.profile('other')).provider,'baileys');
 }finally{await f.close();}
});
