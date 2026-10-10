const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdf = require('pdf-parse');
const {cvKind,textFile}=require('../utils/upload-files');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/async-handler');
const { get,all,run,pool } = require('../utils/db');
const { replaceLatest } = require('../utils/user-records');
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024}});
router.use(requireAuth);
router.get('/list',asyncHandler(async(req,res)=>res.json(await all('SELECT id,name,filename,created_at,(pdf_data IS NOT NULL) AS has_attachment,(id=COALESCE((SELECT active_cv_id FROM users WHERE id=$1),$2)) AS active FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC',[req.session.userId,'']))));
router.post('/select',asyncHandler(async(req,res)=>{if(!await get('SELECT id FROM cv_profiles WHERE user_id=$1 AND id=$2',[req.session.userId,req.body.id]))return res.status(404).json({error:'السيرة غير موجودة'});await run('UPDATE users SET active_cv_id=$1 WHERE id=$2',[req.body.id,req.session.userId]);res.json({ok:true});}));
router.delete('/:id',asyncHandler(async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.session.userId]);
  const values=[req.session.userId,req.params.id];
  const campaigns=await client.query("SELECT id FROM campaigns WHERE user_id=$1 AND cv_id=$2 AND status IN ('running','paused','draft')",values);
  const jobs=await client.query("SELECT id FROM scheduled_jobs WHERE user_id=$1 AND cv_id=$2 AND status IN ('pending','processing','uncertain')",values);
  if(campaigns.rows.length||jobs.rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'السيرة مستخدمة في حملة أو إرسال مجدول. أنهِ الإرسال أو ألغِ الجدولة أولًا.'});}
  const deleted=await client.query('DELETE FROM cv_profiles WHERE id=$1 AND user_id=$2',[req.params.id,req.session.userId]);
  await client.query('UPDATE users SET active_cv_id=NULL WHERE id=$1 AND active_cv_id=$2',values);
  await client.query('COMMIT');
  res.json({ok:true,deleted:deleted.rowCount});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
router.get('/pdf',asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv-store').active(req.session.userId);
 if(!cv?.pdf_data)return res.status(404).json({error:'لا يوجد PDF محفوظ. أعد رفع السيرة بصيغة PDF.'});
 res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="CV.pdf"','Cache-Control':'private, no-store'});
 res.send(cv.pdf_data);
}));
router.get('/', asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv-store').active(req.session.userId);res.json(cv?{id:cv.id,content:cv.content,filename:cv.filename,name:cv.name,created_at:cv.created_at,has_attachment:!!cv.pdf_data}:null);
}));
router.post('/upload',upload.single('cv'),asyncHandler(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'لا يوجد ملف'});
 const isPDF=cvKind(req.file)==='pdf';
 let text;
 try{text=isPDF?(await pdf(req.file.buffer)).text:textFile(req.file.buffer);}
 catch{return res.status(400).json({error:'فشل قراءة ملف PDF. تأكد من سلامة الملف.'});}
 if(!text?.trim())return res.status(400).json({error:'الملف لا يحتوي على نص مقروء. ارفع PDF نصيًا أو أضف النص يدويًا. السيرة السابقة لم تتغير.'});
 const id=await require('../utils/cv-store').save(req.session.userId,{content:text,filename:req.file.originalname,pdf_data:isPDF?req.file.buffer:null});
 res.json({id,content:text,filename:req.file.originalname,has_attachment:isPDF});
}));
router.post('/text',asyncHandler(async(req,res)=>{
 const {content,name}=req.body;
 if(typeof content!=='string'||!content.trim())return res.status(400).json({error:'المحتوى فارغ'});
 const id=await require('../utils/cv-store').save(req.session.userId,{content:content.trim(),filename:typeof name==='string'?name:'manual',pdf_data:null},true);
 res.json({id,content:content.trim()});
}));
router.get('/template',asyncHandler(async(req,res)=>{
 res.json(await get('SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[req.session.userId])||{subject_template:'',instructions:''});
}));
router.post('/template',asyncHandler(async(req,res)=>{
 const current=await get('SELECT instructions FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[req.session.userId]);
 if(current?.instructions?.startsWith('MRSAAL_STYLE_V1\n'))return res.status(409).json({error:'الأسلوب محفوظ بالنسخة الجديدة. حدّث الصفحة واستخدم «أسلوبي في الكتابة» لتعديله.'});
 const {subject_template,instructions}=req.body;
 if((subject_template!=null&&typeof subject_template!=='string')||(instructions!=null&&typeof instructions!=='string'))return res.status(400).json({error:'صيغة القالب غير صحيحة'});
 await replaceLatest('templates',req.session.userId,{subject_template:subject_template||'',instructions:instructions||''});
 res.json({ok:true});
}));
module.exports=router;
