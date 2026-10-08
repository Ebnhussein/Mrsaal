'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {run,get,all,pool}=require('./db');
const {seal,unseal}=require('./connection-secrets');
const {adminEmail}=require('./helpdesk');
const TYPES=['followup_reminder','release','email_open','email_reply','wa_delivered','wa_read','wa_reply','send_failed','schedule_started','schedule_done','schedule_failed','schedule_skipped','ticket_reply','ticket_status','wa_disconnected','connection_issue','admin_ticket','admin_ticket_reply','admin_errors'];
const DEFAULTS={types:Object.fromEntries(TYPES.map(k=>[k,true])),sound:false,toast:true,browser:false,language:'ar'};
let timer,busy=false,configured=null,cleanupAt=0;
function preferences(input={}){return {...DEFAULTS,...input,types:{...DEFAULTS.types,...input.types}};}
function validatePreferences(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('إعدادات غير صالحة'),{status:400});
 const result={};for(const key of ['sound','toast','browser'])if(key in value){if(typeof value[key]!=='boolean')throw Object.assign(new Error('الإعداد لازم يكون تشغيل أو إيقاف'),{status:400});result[key]=value[key];}
 if('language' in value){if(!['ar','en'].includes(value.language))throw Object.assign(new Error('لغة غير صالحة'),{status:400});result.language=value.language;}
 if('types' in value){if(!value.types||typeof value.types!=='object'||Array.isArray(value.types))throw Object.assign(new Error('أنواع غير صالحة'),{status:400});result.types={};for(const [key,v]of Object.entries(value.types)){if(!TYPES.includes(key)||typeof v!=='boolean')throw Object.assign(new Error('نوع إشعار غير صالح'),{status:400});result.types[key]=v;}}
 return result;
}
function validSubscription(input){
 let url;try{url=new URL(input?.endpoint);}catch{return false;}
 const host=url.hostname;const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='web.push.apple.com'||host.endsWith('.notify.windows.com');
 if(!allowed||url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||input.endpoint.length>2048)return false;
 const key=input?.keys?.p256dh,auth=input?.keys?.auth;
 if(typeof key!=='string'||typeof auth!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(key)||!/^[A-Za-z0-9_-]+={0,2}$/.test(auth))return false;
 const bytes=Buffer.from(key,'base64url');try{crypto.ECDH.convertKey(bytes,'prime256v1');}catch{return false;}return bytes.length===65&&bytes[0]===4&&Buffer.from(auth,'base64url').length===16;
}
function endpointHash(endpoint){return crypto.createHash('sha256').update(endpoint).digest('hex');}
async function syncStaff(){
 const users=await all('SELECT id,email FROM users');const ids=users.filter(u=>adminEmail(u.email)).map(u=>u.id);
 await run('DELETE FROM notification_staff WHERE NOT(user_id=ANY($1::text[]))',[ids]);
 for(const id of ids)await run('INSERT INTO notification_staff(user_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
}
async function ensureNotifications(){
 await run('ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_delivered_at BIGINT; ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_read_at BIGINT; ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_reply_at BIGINT; ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_reply_message_id TEXT;');
 await run(fs.readFileSync(path.join(__dirname,'notifications-schema.sql'),'utf8'));
 await syncStaff();
 await run(`INSERT INTO notification_releases(id,title_ar,title_en,body_ar,body_en) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,['2026-10-08-notifications','مركز الإشعارات وصل','Your notification centre is ready','تابع الردود وفتح البريد وواتساب وتذاكر الدعم من الجرس. تحكم في الأنواع والصوت وإشعارات المتصفح من إعدادات الإشعارات.','Follow replies, email open indicators, WhatsApp receipts and support tickets from the bell. Choose event types, sound and browser alerts in notification settings.']);
}
async function config(){
 if(configured)return configured;
 const curve=crypto.createECDH('prime256v1');curve.generateKeys();
 const proposed={publicKey:curve.getPublicKey().toString('base64url'),privateKey:curve.getPrivateKey().toString('base64url')};
 await run('INSERT INTO notification_push_config(id,credentials) VALUES(1,$1) ON CONFLICT DO NOTHING',[seal(proposed)]);
 const row=await get('SELECT credentials FROM notification_push_config WHERE id=1');
 const keys=unseal(row.credentials);const webpush=require('web-push');
 const base=process.env.BASE_URL||'https://mrsaal.ebnhussein.co';const subject=new URL(base).origin;
 webpush.setVapidDetails(subject,keys.publicKey,keys.privateKey);
 configured={webpush,publicKey:keys.publicKey};return configured;
}
async function ensureRelease(userId){
 // Current published release is delivered once, including users joining later.
 await run(`SELECT mrsaal_notify($1,'release:'||id,'release','updates',jsonb_build_object('page','release','releaseId',id),jsonb_build_object('title_ar',title_ar,'title_en',title_en,'body_ar',body_ar,'body_en',body_en)) FROM notification_releases ORDER BY created_at DESC LIMIT 1`,[userId]);
}
async function emit(userId,eventKey,kind,category,target,data={},aggregate=false){if(!TYPES.includes(kind))throw new Error('Unknown notification type');await run('SELECT mrsaal_notify($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',[userId,eventKey,kind,category,JSON.stringify(target),JSON.stringify(data),aggregate]);}
function whatsappDisconnected(userId,entry){if(entry.notifiedDisconnect)return;entry.notifiedDisconnect=true;emit(userId,'wa-disconnected:'+crypto.randomUUID(),'wa_disconnected','messages',{page:'settings',section:'channels'}).catch(()=>console.warn('Notification could not be recorded'));}
async function cleanup(){
 if(Date.now()<cleanupAt)return;cleanupAt=Date.now()+3600000;
 await syncStaff();
 await run("DELETE FROM notifications WHERE updated_at<NOW()-INTERVAL '90 days'; DELETE FROM notification_events WHERE created_at<NOW()-INTERVAL '90 days' AND event_key NOT LIKE 'release:%'; DELETE FROM notification_push_subscriptions WHERE updated_at<NOW()-INTERVAL '90 days';");
}
async function dispatchPush(){
 if(busy)return;busy=true;let client;
 try{
  await cleanup();
  client=await pool.connect();const lock=await client.query('SELECT pg_try_advisory_lock(86240081) AS locked');if(!lock.rows[0].locked)return;
  const jobs=await all(`SELECT j.*,n.user_id,n.read_at,n.kind,p.settings FROM notification_push_jobs j JOIN notifications n ON n.id=j.notification_id LEFT JOIN notification_preferences p ON p.user_id=n.user_id WHERE j.due_at<=NOW() ORDER BY j.due_at LIMIT 20`);
  for(const job of jobs){
   const pref=preferences(job.settings||{});
   if(!pref.browser||!pref.types[job.kind]||job.read_at){await run('DELETE FROM notification_push_jobs WHERE notification_id=$1 AND revision=$2',[job.notification_id,job.revision]);continue;}
   const subs=await all('SELECT endpoint_hash,subscription FROM notification_push_subscriptions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 5',[job.user_id]);let retry=false;
   if(subs.length){const {webpush}=await config();const en=pref.language==='en';const payload=JSON.stringify({title:en?'Mrsaal · New notifications':'مرسال · إشعارات جديدة',body:en?'Open your notification centre for details.':'افتح مركز الإشعارات لمراجعة التفاصيل.',url:'/app?notifications=1',tag:'mrsaal-updates',silent:!pref.sound});
    for(const sub of subs){try{await webpush.sendNotification(unseal(sub.subscription),payload,{TTL:3600,timeout:5000,topic:'mrsaal-notifications'});await run('UPDATE notification_push_subscriptions SET updated_at=NOW() WHERE endpoint_hash=$1 AND user_id=$2',[sub.endpoint_hash,job.user_id]);}catch(e){if([404,410].includes(e.statusCode))await run('DELETE FROM notification_push_subscriptions WHERE endpoint_hash=$1',[sub.endpoint_hash]);else retry=true;}}
   }
   if(retry&&job.attempts<2)await run("UPDATE notification_push_jobs SET attempts=attempts+1,due_at=NOW()+INTERVAL '1 minute' WHERE notification_id=$1 AND revision=$2",[job.notification_id,job.revision]);
   else await run('DELETE FROM notification_push_jobs WHERE notification_id=$1 AND revision=$2',[job.notification_id,job.revision]);
  }
 }catch(e){console.warn('Notification delivery temporarily unavailable:',e.code||e.name);}
 finally{if(client){await client.query('SELECT pg_advisory_unlock(86240081)').catch(()=>{});client.release();}busy=false;}
}
function startNotifications(){if(timer)return;timer=setInterval(()=>dispatchPush(),15000);timer.unref();dispatchPush();}
function stopNotifications(){clearInterval(timer);timer=null;}
module.exports={TYPES,preferences,validatePreferences,validSubscription,endpointHash,ensureNotifications,ensureRelease,emit,whatsappDisconnected,config,startNotifications,stopNotifications,dispatchPush};
