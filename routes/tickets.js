'use strict';
const router=require('express').Router();const {randomUUID}=require('crypto');
const {get,all,run,pool}=require('../utils/db');const {requireAuth}=require('../middleware/auth');const wrap=require('../middleware/async-handler');const {isAdmin,quota}=require('../utils/helpdesk');
const categories=new Set(['general','upload','ai','gmail','whatsapp','display']);const statuses=new Set(['open','in_progress','waiting_user','resolved']);
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function value(x,min,max){if(typeof x!=='string'||x.trim().length<min||x.length>max)fail(`النص مطلوب، من ${min} إلى ${max} حرف.`);return x.trim();}
router.use(requireAuth);router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(req.method!=='GET'){
 if(req.get('X-Mrsaal-Support')!=='1'||!req.is('application/json'))return res.status(403).json({error:'طلب غير مسموح'});
 if(!quota('ticket:'+req.session.userId,30))return res.status(429).json({error:'طلبات كثيرة. انتظر قليلًا قبل المحاولة.'});
 }next();});
router.get('/access',wrap(async(req,res)=>res.json({admin:await isAdmin(req.session.userId)})));
router.get('/',wrap(async(req,res)=>res.json({tickets:await all('SELECT id,subject,category,status,created_at,updated_at FROM support_tickets WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50',[req.session.userId])})));
router.post('/',wrap(async(req,res)=>{const subject=value(req.body.subject,3,120),body=value(req.body.body,10,4000),category=req.body.category;if(!categories.has(category))fail('اختار نوع المشكلة');if(!quota('newticket:'+req.session.userId,5))fail('الحد 5 تذاكر جديدة في الساعة.',429);const id=randomUUID();await run('INSERT INTO support_tickets(id,user_id,subject,body,category) VALUES($1,$2,$3,$4,$5)',[id,req.session.userId,subject,body,category]);res.status(201).json({id});}));
async function admin(req,res,next){if(!await isAdmin(req.session.userId))return res.status(403).json({error:'للإدارة فقط'});next();}
router.get('/admin',wrap(admin),wrap(async(req,res)=>{
 const offset=Math.max(0,Math.min(100000,parseInt(req.query.offset)||0));
 const tickets=await all(`SELECT t.id,t.subject,t.category,t.status,t.updated_at,u.email FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY CASE WHEN t.status='resolved' THEN 1 ELSE 0 END,t.updated_at DESC LIMIT 50 OFFSET $1`,[offset]);
 const events=await all('SELECT e.area,e.status,e.created_at,u.email FROM support_events e JOIN users u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 50');
 const users=await all('SELECT u.name,u.email,a.last_seen FROM users u LEFT JOIN support_activity a ON a.user_id=u.id ORDER BY a.last_seen DESC NULLS LAST LIMIT 50');
 const counts=await get("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM support_tickets WHERE status<>'resolved') AS pending,(SELECT COUNT(*) FROM support_events WHERE created_at>NOW()-INTERVAL '24 hours') AS errors");res.json({tickets,events,users,counts,offset});
}));
router.get('/:id',wrap(async(req,res)=>{const staff=await isAdmin(req.session.userId);const ticket=await get('SELECT id,user_id,subject,body,category,status,created_at FROM support_tickets WHERE id=$1 AND (user_id=$2 OR $3)',[req.params.id,req.session.userId,staff]);if(!ticket)fail('التذكرة غير موجودة',404);const messages=await all('SELECT staff,body,created_at FROM support_messages WHERE ticket_id=$1 ORDER BY created_at,id LIMIT 200',[ticket.id]);res.json({ticket,messages,admin:staff});}));
router.post('/:id/reply',wrap(async(req,res)=>{
 const body=value(req.body.body,1,4000),staff=await isAdmin(req.session.userId),client=await pool.connect();
 try{await client.query('BEGIN');const result=await client.query('SELECT id FROM support_tickets WHERE id=$1 AND (user_id=$2 OR $3) FOR UPDATE',[req.params.id,req.session.userId,staff]);if(!result.rowCount)fail('التذكرة غير موجودة',404);
 const count=await client.query('SELECT COUNT(*)::int AS n FROM support_messages WHERE ticket_id=$1',[req.params.id]);if(count.rows[0].n>=200)fail('وصلت المحادثة للحد؛ افتح تذكرة متابعة.');
 await client.query('INSERT INTO support_messages(id,ticket_id,user_id,staff,body) VALUES($1,$2,$3,$4,$5)',[randomUUID(),req.params.id,req.session.userId,staff,body]);await client.query('UPDATE support_tickets SET updated_at=NOW(),status=$1 WHERE id=$2',[staff?'waiting_user':'open',req.params.id]);await client.query('COMMIT');res.json({ok:true});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
router.patch('/:id',wrap(admin),wrap(async(req,res)=>{if(!statuses.has(req.body.status))fail('حالة غير صالحة');const r=await run('UPDATE support_tickets SET status=$1,updated_at=NOW() WHERE id=$2',[req.body.status,req.params.id]);if(!r.rowCount)fail('التذكرة غير موجودة',404);res.json({ok:true});}));
module.exports=router;
