'use strict';
const {createHash,randomUUID}=require('crypto');
const {get,all,run,pool}=require('./db');
const {config,createGateway,fail}=require('./mrsaalwa-gateway');
const {buildWhatsAppContent}=require('./whatsapp-content');
let schema,timer,syncing=false;
const enabled=()=>process.env.MRSAALWA_ENABLED==='true';
const gateway=()=>createGateway(config());
// Explicit 0 disables the global session cap; missing/invalid values keep the safe default.
const maxSessions=()=>{const raw=process.env.MRSAALWA_MAX_SESSIONS;if(!raw?.trim())return 1;const n=Number(raw);return Number.isInteger(n)&&n>=0&&n<=50?n:1;};
function ensureSchema(){return schema||=(async()=>{await run(`
 CREATE TABLE IF NOT EXISTS whatsapp_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL DEFAULT 'baileys' CHECK(provider IN ('baileys','mrsaalwa')),beta_allowed BOOLEAN NOT NULL DEFAULT false,session_id TEXT UNIQUE,session_name TEXT UNIQUE,last_status TEXT,last_error TEXT,last_seen TIMESTAMPTZ,pair_requested_at TIMESTAMPTZ);
 ALTER TABLE whatsapp_preferences ADD COLUMN IF NOT EXISTS beta_blocked BOOLEAN NOT NULL DEFAULT false;
 ALTER TABLE whatsapp_preferences ADD COLUMN IF NOT EXISTS provider_chosen BOOLEAN NOT NULL DEFAULT false;
 CREATE TABLE IF NOT EXISTS mrsaalwa_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,event TEXT NOT NULL,code TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS mrsaalwa_events_time ON mrsaalwa_events(created_at DESC);
 CREATE TABLE IF NOT EXISTS mrsaalwa_capacity(id INTEGER PRIMARY KEY);
 INSERT INTO mrsaalwa_capacity(id) VALUES(1) ON CONFLICT DO NOTHING;
 ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_synced_at TIMESTAMPTZ;
 ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT;
 ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_session_id TEXT;
 `);})().catch(e=>{schema=null;throw e;});}
async function profile(id){await ensureSchema();return await get('SELECT * FROM whatsapp_preferences WHERE user_id=$1',[id])||{user_id:id,provider:'baileys',beta_allowed:false,session_id:null};}
async function allowed(id){const p=await profile(id);return enabled()&&!p.beta_blocked&&(process.env.MRSAALWA_PUBLIC_BETA!=='false'||p.beta_allowed||await require('./helpdesk').isAdmin(id));}
// Initialise the UI default only when no saved connection or active work can be displaced.
async function prepareDefault(id){
 const p=await profile(id);
 if(p.provider==='mrsaalwa'||p.provider_chosen||!await allowed(id))return p;
 await select(id,'mrsaalwa',true);return profile(id);
}
async function assertAllowed(id){if(!await allowed(id))throw fail('MRSAALWA_DISABLED',403);await require('./access-control').checkToolAccess(id);}
async function locked(id,task){await ensureSchema();const c=await pool.connect();try{await c.query('BEGIN');const r=await c.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE NOWAIT',[id]);if(!r.rows.length)throw fail('MRSAALWA_DISABLED',403);const result=await task(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');if(e.code==='55P03')throw fail('MRSAALWA_BUSY',409);throw e;}finally{c.release();}}
async function event(id,type,code=null){await run('INSERT INTO mrsaalwa_events(id,user_id,event,code) VALUES($1,$2,$3,$4)',[randomUUID(),id,type,code]);await run("DELETE FROM mrsaalwa_events WHERE created_at<NOW()-INTERVAL '14 days'");}
async function busy(id){return !!await get(`SELECT id FROM delivery_attempts WHERE user_id=$1 AND status IN ('processing','uncertain')
 UNION SELECT id FROM campaigns WHERE user_id=$1 AND status='running' AND channel='whatsapp'
 UNION SELECT sj.id FROM scheduled_jobs sj JOIN email_log l ON l.id=sj.log_id WHERE sj.user_id=$1 AND sj.status IN ('pending','processing') AND l.channel='whatsapp' LIMIT 1`,[id]);}
async function select(id,provider,initialise=false){
 if(!['baileys','mrsaalwa'].includes(provider))throw fail('MRSAALWA_INPUT',400);
 return locked(id,async c=>{const p=await profile(id);
  if(initialise){
   if(p.provider_chosen||p.provider==='mrsaalwa'||require('./whatsapp').status(id).status!=='disconnected'||await busy(id))return {ok:true};
   const table=await get("SELECT to_regclass('public.whatsapp_auth') AS name");
   if(table?.name&&await get("SELECT user_id FROM whatsapp_auth WHERE user_id=$1 AND key_id='creds' LIMIT 1",[id]))return {ok:true};
  }
  if(p.provider===provider){await c.query('INSERT INTO whatsapp_preferences(user_id,provider,provider_chosen) VALUES($1,$2,true) ON CONFLICT(user_id) DO UPDATE SET provider_chosen=true',[id,provider]);return {ok:true};}
  if(provider==='mrsaalwa')await assertAllowed(id);
  if(await busy(id))throw fail('MRSAALWA_BUSY',409);
  if(p.provider==='mrsaalwa'&&p.session_id)throw fail('MRSAALWA_DISCONNECT_FIRST',409);
  if(p.provider==='baileys'&&require('./whatsapp').status(id).status!=='disconnected')throw fail('MRSAALWA_DISCONNECT_FIRST',409);
  await c.query('INSERT INTO whatsapp_preferences(user_id,provider,provider_chosen) VALUES($1,$2,true) ON CONFLICT(user_id) DO UPDATE SET provider=EXCLUDED.provider,provider_chosen=true',[id,provider]);
  await event(id,'provider_changed',provider);return {ok:true};
 });
}
async function status(id,includeQR=true){
 const p=await profile(id);if(!p.session_id)return {provider:'mrsaalwa',status:'disconnected',qr:null,phone:null,hasSession:false};
 try{const g=gateway(),s=await g.session(p.session_id);const state={ready:'connected',qr_ready:'qr',created:'disconnected',initializing:'connecting',authenticating:'connecting',action_required:'disconnected',failed:'disconnected',disconnected:'disconnected'}[s.status]||'disconnected';
  if(p.last_status!==state){await event(id,'connection',state);if(p.last_status==='connected'&&state==='disconnected')require('./notifications').whatsappDisconnected(id,{});}
  await run('UPDATE whatsapp_preferences SET last_status=$2,last_error=NULL,last_seen=NOW() WHERE user_id=$1 AND session_id=$3',[id,state,p.session_id]);
  return {provider:'mrsaalwa',status:state,phone:s.phone||null,hasSession:true,qr:includeQR&&s.status==='qr_ready'?await g.qr(p.session_id):null};
 }catch(e){await run('UPDATE whatsapp_preferences SET last_error=$2,last_seen=NOW() WHERE user_id=$1',[id,e.code||'MRSAALWA_RESPONSE']);throw e;}
}
async function connect(id,{method='qr',phone='',acknowledge=false}={}){
 if(!['qr','phone'].includes(method))throw fail('MRSAALWA_INPUT',400);
 if(method==='phone'&&(!acknowledge||!/^[1-9]\d{7,14}$/.test(phone)))throw fail('MRSAALWA_PHONE',400);
 return locked(id,async c=>{await assertAllowed(id);let p=await profile(id);if(p.provider!=='mrsaalwa')throw fail('MRSAALWA_INPUT',409);
  // Serialise capacity reservations across every app replica.
  await c.query('SELECT id FROM mrsaalwa_capacity WHERE id=1 FOR UPDATE NOWAIT');
  const g=gateway();
  if(!p.session_id){
   const reserved=await c.query('SELECT count(*)::int AS n FROM whatsapp_preferences WHERE session_id IS NOT NULL');
   if(maxSessions()>0&&reserved.rows[0].n>=maxSessions())throw fail('MRSAALWA_CAPACITY',409);
   const name='mrsaal-'+createHash('sha256').update(id).digest('hex').slice(0,24);
   // Recover a creation whose response was lost, without creating a second session.
   const sessions=await g.list();if(!Array.isArray(sessions))throw fail('MRSAALWA_RESPONSE');
   const old=sessions.find(s=>s.name===name);const s=old||await g.create(name);
   if(!require('./mrsaalwa-gateway').UUID.test(s.id||''))throw fail('MRSAALWA_RESPONSE');
   const taken=await get('SELECT user_id FROM whatsapp_preferences WHERE session_id=$1 AND user_id<>$2',[s.id,id]);if(taken)throw fail('MRSAALWA_SESSION');
   // Persist ownership before start/pair network calls, including ambiguous failures.
   await c.query('UPDATE whatsapp_preferences SET session_id=$2,session_name=$3 WHERE user_id=$1',[id,s.id,name]);
   p={...p,session_id:s.id,session_name:name};
  }
  return {session:p.session_id,method,phone,acknowledge};
 }).then(async data=>locked(id,async c=>{
  await c.query('SELECT id FROM mrsaalwa_capacity WHERE id=1 FOR UPDATE NOWAIT');const p=await profile(id);if(p.session_id!==data.session||p.provider!=='mrsaalwa')throw fail('MRSAALWA_SESSION');await assertAllowed(id);
  const g=gateway();let s=await g.session(p.session_id);
  if(s.status==='ready')return {ok:true,status:'connected'};
  if(!s.engineLoaded){const sessions=await g.list();if(maxSessions()>0&&sessions.filter(x=>x.engineLoaded&&x.id!==p.session_id).length>=maxSessions())throw fail('MRSAALWA_CAPACITY',409);await g.start(p.session_id);s=await g.session(p.session_id);}
  if(method==='phone'){
   // Never request a pairing code for an already authenticated session.
   if(s.phone||!['qr_ready','initializing'].includes(s.status))throw fail('MRSAALWA_PAIR_WAIT',409);
   if(p.pair_requested_at&&Date.now()-new Date(p.pair_requested_at).getTime()<60000)throw fail('MRSAALWA_PAIR_WAIT',429);
   await run('UPDATE whatsapp_preferences SET pair_requested_at=NOW() WHERE user_id=$1',[id]);
   const pairingCode=await g.pair(p.session_id,phone);await event(id,'pair_requested');return {ok:true,pairingCode};
  }
  await event(id,'connect_requested');return {ok:true};
 }));
}
async function disconnect(id,forget=true){return locked(id,async()=>{const p=await profile(id);if(!p.session_id)return;
 if(await busy(id))throw fail('MRSAALWA_BUSY',409);
 const g=gateway();if(forget){try{const s=await g.session(p.session_id);if(s.engineLoaded)await g.logout(p.session_id);}catch(e){if(e.code!=='MRSAALWA_SESSION')throw e;}try{await g.remove(p.session_id);}catch(e){if(e.code!=='MRSAALWA_SESSION')throw e;}
  await run('UPDATE whatsapp_preferences SET session_id=NULL,session_name=NULL,last_status=$2,last_error=NULL,pair_requested_at=NULL WHERE user_id=$1',[id,'disconnected']);
 }else if((await g.session(p.session_id)).engineLoaded)await g.stop(p.session_id);
 await event(id,'disconnected');
 });}
async function requireConnected(id){await assertAllowed(id);const p=await profile(id);if(!p.session_id)throw fail('WA_NOT_CONNECTED');const s=await gateway().session(p.session_id);if(s.status!=='ready')throw fail('WA_NOT_CONNECTED');return p;}
async function send(id,phone,body,attachment){
 const number=String(phone||'').replace(/^00/,'').replace(/\D/g,'');if(!/^[1-9]\d{7,14}$/.test(number))throw fail('MRSAALWA_PHONE',400);
 let content;try{content=buildWhatsAppContent(body,attachment);}catch{throw fail('MRSAALWA_PDF',400);}
 if(content.document&&(content.document.length>10*1024*1024||content.caption.length>1024))throw fail('MRSAALWA_PDF',400);
 const p=await requireConnected(id);
 try{const result=await gateway().send(p.session_id,number,content);await event(id,'send_accepted');return {...result,provider:'mrsaalwa',sessionId:p.session_id};}catch(e){await event(id,'send_uncertain',e.code);throw e;}
}
function seconds(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:null;}
async function sync(){
 if(syncing||!enabled())return;syncing=true;
 try{await ensureSchema();for(const p of await all("SELECT user_id FROM whatsapp_preferences WHERE provider='mrsaalwa' AND session_id IS NOT NULL LIMIT 50")){try{await status(p.user_id,false);}catch{}}const rows=await all(`SELECT l.id,l.user_id,l.message_id,l.thread_id,l.sent_at,l.whatsapp_session_id FROM email_log l JOIN whatsapp_preferences p ON p.user_id=l.user_id AND p.session_id=l.whatsapp_session_id WHERE l.channel='whatsapp' AND l.whatsapp_provider='mrsaalwa' AND l.status='sent' AND l.sent_at>EXTRACT(EPOCH FROM NOW()-INTERVAL '7 days') ORDER BY l.whatsapp_synced_at ASC NULLS FIRST,l.sent_at DESC LIMIT 10`);
  const g=gateway();for(const l of rows){try{
   await run('UPDATE email_log SET whatsapp_synced_at=NOW() WHERE id=$1 AND user_id=$2',[l.id,l.user_id]);const own=await g.messages(l.whatsapp_session_id,{messageId:l.message_id,limit:'1'});const m=own.find(x=>x.waMessageId===l.message_id&&x.direction==='outgoing');
   if(m?.status==='failed'){await run("UPDATE email_log SET status='failed',reason=$3 WHERE id=$1 AND user_id=$2",[l.id,l.user_id,'MrsaalWA أبلغ عن فشل التسليم. راجع المحادثة قبل إعادة الإرسال.']);await event(l.user_id,'delivery_failed');continue;}
   if(m&&['delivered','read'].includes(m.status))await require('./whatsappTracking').receipt(l.user_id,{id:l.message_id,fromMe:true},{read:m.status==='read'});
   const chat=m?.chatId||l.thread_id;if(!chat||!/@(?:c\.us|lid)$/.test(chat))continue;
   const incoming=await g.messages(l.whatsapp_session_id,{chatId:chat,direction:'incoming',since:String(Number(l.sent_at)*1000)});
   const reply=incoming.filter(x=>x.direction==='incoming'&&x.chatId===chat&&seconds(x.timestamp)>=Number(l.sent_at)).sort((a,b)=>Number(b.timestamp)-Number(a.timestamp))[0];
   if(reply){const latest=await get("SELECT id FROM email_log WHERE user_id=$1 AND whatsapp_session_id=$2 AND thread_id=$3 AND channel='whatsapp' AND status='sent' AND sent_at<=$4 ORDER BY sent_at DESC,id DESC LIMIT 1",[l.user_id,l.whatsapp_session_id,l.thread_id,reply.timestamp]);if(latest?.id===l.id)await run(`UPDATE email_log SET replied=1,reply_text=$3,whatsapp_reply_at=$4,whatsapp_reply_message_id=$5 WHERE id=$1 AND user_id=$2 AND (whatsapp_reply_at IS NULL OR whatsapp_reply_at<$4)`,[l.id,l.user_id,String(reply.body||'['+reply.type+']').slice(0,10000),reply.timestamp,reply.waMessageId||reply.id]);}
  }catch(e){await run('UPDATE whatsapp_preferences SET last_error=$2 WHERE user_id=$1',[l.user_id,e.code||'MRSAALWA_RESPONSE']);}}
 }catch(e){console.warn('MrsaalWA sync unavailable:',e.code||'ERROR');}finally{syncing=false;}
}
function start(){if(timer)return;timer=setInterval(sync,30000);timer.unref?.();if(enabled())(async()=>{for(const p of await all("SELECT user_id FROM whatsapp_preferences WHERE provider='mrsaalwa' AND session_id IS NOT NULL")){try{await connect(p.user_id,{method:'qr'});}catch(e){await run('UPDATE whatsapp_preferences SET last_error=$2 WHERE user_id=$1',[p.user_id,e.code||'MRSAALWA_RESPONSE']);}}})().catch(()=>console.warn('MrsaalWA restore unavailable'));}
function stop(){clearInterval(timer);timer=null;}
module.exports={ensureSchema,profile,prepareDefault,allowed,enabled,select,status,connect,disconnect,requireConnected,send,locked,busy,event,sync,start,stop,maxSessions};
