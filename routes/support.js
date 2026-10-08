'use strict';
const router=require('express').Router();
const {requireAuth}=require('../middleware/auth');
const {get}=require('../utils/db');
const {respond,answer,docs}=require('../utils/support');
router.use(requireAuth);
const windows=new Map(),busy=new Set(),conversations=new Map();const HOUR=3600000;
function reserve(id){const now=Date.now();for(const [key,row] of windows)if(now-row.start>=HOUR)windows.delete(key);if(windows.size>=10000&&!windows.has(id))return false;let row=windows.get(id)||{start:now,count:0};if(row.count>=30)return false;row.count++;windows.set(id,row);return true;}
router.get('/topics',(req,res)=>res.json({topics:docs.map(d=>({id:d.id,title:req.query.lang==='en'?(d.title_en||d.title):d.title}))}));
router.get('/topics/:id',(req,res)=>{if(!docs.some(d=>d.id===req.params.id))return res.status(404).json({error:'الموضوع غير موجود'});res.json(answer({scope:'help',topics:[req.params.id]},req.query.lang==='en'?'en':'ar'));});
router.post('/chat',async(req,res)=>{
 const id=req.session.userId,q=req.body?.question;
 if(typeof q!=='string'||q.trim().length<2||q.length>1200)return res.status(400).json({error:'اكتب سؤالًا من 2 إلى 1200 حرف عن مرسال.'});
 if(/(?:AIza[\w-]{20,}|sk-[\w-]{16,})/.test(q))return res.status(400).json({error:'لا ترسل مفاتيح API هنا؛ استخدم إعدادات منصات الذكاء الاصطناعي.'});
 if(busy.has(id)||busy.size>=3)return res.status(429).json({error:'استنى الطلب الحالي يخلص، أو جرّب بعد لحظات.'});
 if(!reserve(id)){res.setHeader('Retry-After','3600');return res.status(429).json({error:'وصلت لحد 30 سؤال في الساعة. الشروحات الجاهزة والجولات ما زالت متاحة.'});}
 busy.add(id);
 try{
  for(const [key,row]of conversations)if(Date.now()-row.time>1800000)conversations.delete(key);
  if(conversations.size>=500&&!conversations.has(id))conversations.delete(conversations.keys().next().value);
  const history=req.body.resetHistory?[]:conversations.get(id)?.messages||[];
  const u=await get('SELECT gemini_key,gemini_model FROM users WHERE id=$1',[id]);
  const result=await respond(q.trim(),{previousTopics:req.body.previousTopics,history,language:req.body.language==='en'?'en':'ar'},{userId:id,apiKey:u?.gemini_key,modelName:u?.gemini_model});
  conversations.set(id,{time:Date.now(),messages:[...history,{role:'user',content:q.trim()},{role:'assistant',content:result.text}].slice(-6)});res.json(result);
 }
 catch{res.status(503).json({error:'تعذر تشغيل المساعد. جرب الشروحات الجاهزة.'});}
 finally{busy.delete(id);}
});
module.exports=router;
