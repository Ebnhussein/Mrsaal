'use strict';
const router=require('express').Router();
const {requireAuth}=require('../middleware/auth');
const {get,run}=require('../utils/db');
const {replaceLatest}=require('../utils/user-records');
const {normalize,encode,decode}=require('../utils/writing-profile');
const {generate,analyzeStyle}=require('../utils/ai');
router.use(requireAuth);
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(err=>{console.warn('Writing studio:',err.status||'failed');res.status(err.status||400).json({error:err.message||'تعذر تنفيذ الطلب'});});
const {chooseChannel,skipReason}=require('../utils/delivery-channel');
const active=new Set();
async function aiJob(id,fn){if(active.has(id)){const e=new Error('استنى لحد ما الطلب الحالي يخلص.');e.status=429;throw e;}active.add(id);try{return await fn();}finally{active.delete(id);}}
async function settings(id){const u=await get('SELECT gemini_key,gemini_model FROM users WHERE id=$1',[id]);return {userId:id,apiKey:u?.gemini_key||null,modelName:u?.gemini_model||null};}
async function template(id){return await get('SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[id]);}
router.get('/draft',wrap(async(req,res)=>{res.json(await require('../utils/drafts').load(req.session.userId,req.query.companyId,req.query.channel)||null);}));
router.post('/draft',wrap(async(req,res)=>{await require('../utils/drafts').save(req.session.userId,req.body.companyId,req.body.channel,req.body.subject||'',req.body.body);res.json({ok:true});}));
router.post('/feedback',wrap(async(req,res)=>{const rating=Number(req.body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw new Error('التقييم من 1 إلى 5');if(!await get('SELECT id FROM companies WHERE id=$1 AND user_id=$2',[req.body.companyId,req.session.userId]))throw new Error('الشركة غير موجودة');await run('INSERT INTO ai_feedback(user_id,company_id,channel,rating,note) VALUES($1,$2,$3,$4,$5)',[req.session.userId,req.body.companyId,req.body.channel,rating,String(req.body.note||'').slice(0,1000)]);res.json({ok:true});}));
router.get('/',wrap(async(req,res)=>{const t=await template(req.session.userId);res.json({profile:decode(t?.instructions),subject:t?.subject_template||'',saved:!!t});}));
router.post('/',wrap(async(req,res)=>{
 const p=normalize(req.body.profile);const subject=typeof req.body.subject==='string'?req.body.subject.trim().slice(0,240):'';
 if(/[\r\n]/.test(subject))throw new Error('العنوان لازم يكون سطر واحد.');
 await replaceLatest('templates',req.session.userId,{subject_template:subject,instructions:encode(p)});res.json({ok:true,profile:p});
}));
router.post('/analyze',wrap(async(req,res)=>{const p=normalize(req.body.profile);res.json(await aiJob(req.session.userId,async()=>analyzeStyle(p,await settings(req.session.userId))));}));
router.post('/generate',wrap(async(req,res)=>{
 const id=req.session.userId;
 const company=await get('SELECT * FROM companies WHERE id=$1 AND user_id=$2',[req.body.companyId,id]);if(!company)throw new Error('اختار شركة من حسابك أولاً.');
 const channel=chooseChannel(company,req.body.channel);const reason=skipReason(company,channel);
 if(reason)return res.json({skipped:true,status:'skipped',channel,reason});
 const cv=await require('../utils/cv-store').active(id,req.body.cvId||null);if(!cv?.content?.trim())throw new Error('ضيف السي في الأول.');
 const t=await template(id);
 const actions={shorten:'اختصر مع الحفاظ على المعنى',simplify:'استخدم كلمات أبسط وجملاً مباشرة',casual:'قلل الرسمية مع الحفاظ على الاحترام',custom:'طبّق ملاحظة المستخدم على المسودة فقط'};
 let revision=null;if(req.body.action){if(!actions[req.body.action])throw new Error('تعديل غير معروف');if(typeof req.body.body!=='string'||!req.body.body.trim()||req.body.body.length>14000)throw new Error('المسودة غير صالحة');revision={action:actions[req.body.action],note:String(req.body.note||'').slice(0,1000),draft:{subject:String(req.body.subject||'').slice(0,240),body:req.body.body}};}
 const result=await aiJob(id,async()=>generate({cv:cv.content,company,instructions:t?.instructions,subjectTemplate:t?.subject_template,revision,...await settings(id)},channel));await require('../utils/drafts').save(id,company.id,channel,result.subject||'',result.body);res.json({channel,...result});
}));
module.exports=router;
