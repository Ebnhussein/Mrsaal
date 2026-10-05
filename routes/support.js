'use strict';
const router=require('express').Router();
const {requireAuth}=require('../middleware/auth');
const {get}=require('../utils/db');
const {respond,answer,docs}=require('../utils/support');
router.use(requireAuth);
const windows=new Map(),busy=new Set();const HOUR=3600000;
function reserve(id){const now=Date.now();for(const [key,row] of windows)if(now-row.start>=HOUR)windows.delete(key);if(windows.size>=10000&&!windows.has(id))return false;let row=windows.get(id)||{start:now,count:0};if(row.count>=30)return false;row.count++;windows.set(id,row);return true;}
router.get('/topics',(req,res)=>res.json({topics:docs.map(d=>({id:d.id,title:d.title}))}));
router.get('/topics/:id',(req,res)=>{if(!docs.some(d=>d.id===req.params.id))return res.status(404).json({error:'الموضوع غير موجود'});res.json(answer({scope:'help',topics:[req.params.id]}));});
router.post('/chat',async(req,res)=>{
 const id=req.session.userId,q=req.body?.question;
 if(typeof q!=='string'||q.trim().length<2||q.length>1200)return res.status(400).json({error:'اكتب سؤالًا من 2 إلى 1200 حرف عن مرسال.'});
 if(busy.has(id)||busy.size>=3)return res.status(429).json({error:'استنى الطلب الحالي يخلص، أو جرّب بعد لحظات.'});
 if(!reserve(id)){res.setHeader('Retry-After','3600');return res.status(429).json({error:'وصلت لحد 30 سؤال في الساعة. الشروحات الجاهزة والجولات ما زالت متاحة.'});}
 busy.add(id);
 try{const u=await get('SELECT gemini_key,gemini_model FROM users WHERE id=$1',[id]);res.json(await respond(q.trim(),{previousTopics:req.body.previousTopics},{userId:id,apiKey:u?.gemini_key,modelName:u?.gemini_model}));}
 catch{res.status(503).json({error:'تعذر تشغيل المساعد. جرب الشروحات الجاهزة.'});}
 finally{busy.delete(id);}
});
module.exports=router;
