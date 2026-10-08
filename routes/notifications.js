'use strict';
const router=require('express').Router();const {randomUUID}=require('crypto');
const {get,all,run}=require('../utils/db');const wrap=require('../middleware/async-handler');const {requireAuth}=require('../middleware/auth');const {isAdmin,quota}=require('../utils/helpdesk');
const notify=require('../utils/notifications');const {seal}=require('../utils/connection-secrets');
function validTime(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(new Date(value).getTime());}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
router.use(requireAuth);
router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'&&(req.get('X-Mrsaal-Notifications')!=='1'||!req.is('application/json')))return res.status(403).json({error:'طلب غير مسموح'});if(!quota('notifications:'+req.session.userId,600))return res.status(429).json({error:'انتظر قليلًا قبل التحديث'});next();});
router.get('/',wrap(async(req,res)=>{
 const uid=req.session.userId;await notify.ensureRelease(uid);const server=await get(`SELECT to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS time`);
 const category=['messages','support','updates','admin'].includes(req.query.category)?req.query.category:null;const unread=req.query.unread==='1';
 const offset=Math.min(10000,Math.max(0,parseInt(req.query.offset)||0));const staff=await isAdmin(uid);if(staff)await run('INSERT INTO notification_staff(user_id) VALUES($1) ON CONFLICT DO NOTHING',[uid]);else await run('DELETE FROM notification_staff WHERE user_id=$1',[uid]);
 const items=await all(`SELECT id,kind,category,target,data,event_count,created_at,updated_at,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision,read_at FROM notifications WHERE user_id=$1 AND ($2::text IS NULL OR category=$2) AND (NOT $3::boolean OR read_at IS NULL) AND ($4::boolean OR category<>'admin') ORDER BY updated_at DESC,id DESC LIMIT 30 OFFSET $5`,[uid,category,unread,staff,offset]);
 const count=await get("SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id=$1 AND read_at IS NULL AND ($2::boolean OR category<>'admin')",[uid,staff]);
 const pref=await get('SELECT settings FROM notification_preferences WHERE user_id=$1',[uid]);let fresh=[];const since=new Date(req.query.since);if(validTime(req.query.since))fresh=await all("SELECT id,kind,category,target,data,event_count,updated_at,read_at FROM notifications WHERE user_id=$1 AND read_at IS NULL AND updated_at>$2 AND ($3::boolean OR category<>'admin') ORDER BY updated_at DESC LIMIT 20",[uid,req.query.since,staff]);
 res.json({items,fresh,ownerId:uid,unread:count.unread,settings:notify.preferences(pref?.settings),admin:staff,serverTime:server.time,offset,hasMore:items.length===30});
}));
router.patch('/read',wrap(async(req,res)=>{
 const uid=req.session.userId;
 if(req.body.all===true){const before=new Date(req.body.before);if(!validTime(req.body.before)||before>Date.now()+5000)fail('وقت غير صالح');await run('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL AND updated_at<=$2',[uid,req.body.before]);}
 else{if(!/^\d{1,20}$/.test(String(req.body.id)))fail('إشعار غير صالح');if(req.body.revision&&!validTime(req.body.revision))fail('وقت غير صالح');await run('UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 AND ($3::timestamptz IS NULL OR updated_at<=$3)',[String(req.body.id),uid,req.body.revision||null]);}
 res.json({ok:true});
}));
router.patch('/settings',wrap(async(req,res)=>{
 const next=notify.validatePreferences(req.body);const uid=req.session.userId;
 await run(`INSERT INTO notification_preferences(user_id,settings) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET settings=notification_preferences.settings||EXCLUDED.settings||jsonb_build_object('types',COALESCE(notification_preferences.settings->'types','{}'::jsonb)||COALESCE(EXCLUDED.settings->'types','{}'::jsonb))`,[uid,JSON.stringify(next)]);
 if(next.browser===false)await run('DELETE FROM notification_push_jobs WHERE notification_id IN(SELECT id FROM notifications WHERE user_id=$1)',[uid]);res.json({ok:true});
}));
router.get('/push-config',wrap(async(req,res)=>{try{const c=await notify.config();res.json({publicKey:c.publicKey});}catch{res.status(503).json({error:'إشعارات المتصفح غير متاحة حاليًا؛ إشعارات الموقع شغالة.'});}}));
router.post('/device-status',wrap(async(req,res)=>{
 if(typeof req.body.endpoint!=='string'||req.body.endpoint.length>4096)fail('اشتراك متصفح غير صالح');
 const subscription=await get('SELECT endpoint_hash FROM notification_push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2',[req.session.userId,notify.endpointHash(req.body.endpoint)]);
 const pref=await get('SELECT settings FROM notification_preferences WHERE user_id=$1',[req.session.userId]);
 res.json({enabled:!!subscription&&notify.preferences(pref?.settings).browser===true});
}));
router.post('/subscribe',wrap(async(req,res)=>{
 if(!notify.validSubscription(req.body.subscription))fail('اشتراك متصفح غير صالح');const uid=req.session.userId,sub=req.body.subscription,hash=notify.endpointHash(sub.endpoint);
 const count=await get('SELECT COUNT(*)::int AS n FROM notification_push_subscriptions WHERE user_id=$1 AND endpoint_hash<>$2',[uid,hash]);if(count.n>=5)fail('الحد 5 أجهزة. أوقف إشعارات جهاز قديم أولًا.');
 await run(`INSERT INTO notification_push_subscriptions(endpoint_hash,user_id,subscription) VALUES($1,$2,$3) ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=EXCLUDED.user_id,subscription=EXCLUDED.subscription,updated_at=NOW()`,[hash,uid,seal({endpoint:sub.endpoint,keys:sub.keys})]);res.json({ok:true});
}));
router.post('/unsubscribe',wrap(async(req,res)=>{if(typeof req.body.endpoint!=='string')fail('اشتراك غير صالح');await run('DELETE FROM notification_push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2',[req.session.userId,notify.endpointHash(req.body.endpoint)]);res.json({ok:true});}));
router.get('/releases',wrap(async(req,res)=>{if(!await isAdmin(req.session.userId))fail('للإدارة فقط',403);res.json({releases:await all('SELECT * FROM notification_releases ORDER BY created_at DESC LIMIT 20')});}));
router.post('/releases',wrap(async(req,res)=>{
 if(!await isAdmin(req.session.userId))fail('للإدارة فقط',403);if(!quota('release:'+req.session.userId,5))fail('انتظر قبل نشر تحديث آخر',429);
 const value=key=>{const v=req.body[key];const limit=key.startsWith('title')?120:1500;if(typeof v!=='string'||v.trim().length<3||v.length>limit)fail('اكتب عنوانًا وتفاصيل بالعربية والإنجليزية');return v.trim();};
 const id=randomUUID();await run('INSERT INTO notification_releases(id,title_ar,title_en,body_ar,body_en) VALUES($1,$2,$3,$4,$5)',[id,value('title_ar'),value('title_en'),value('body_ar'),value('body_en')]);
 await run(`SELECT mrsaal_notify(u.id,'release:'||r.id,'release','updates',jsonb_build_object('page','release','releaseId',r.id),jsonb_build_object('title_ar',r.title_ar,'title_en',r.title_en,'body_ar',r.body_ar,'body_en',r.body_en)) FROM users u CROSS JOIN notification_releases r WHERE r.id=$1`,[id]);res.status(201).json({id});
}));
module.exports=router;
