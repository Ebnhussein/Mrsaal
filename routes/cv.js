const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdf = require('pdf-parse');
const {cvKind,textFile}=require('../utils/upload-files');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/async-handler');
const { get } = require('../utils/db');
const { replaceLatest } = require('../utils/user-records');
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024}});
router.use(requireAuth);
router.get('/', asyncHandler(async(req,res)=>{
 res.json(await get('SELECT id,content,filename,created_at,(pdf_data IS NOT NULL) AS has_attachment FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[req.session.userId])||null);
}));
router.post('/upload',upload.single('cv'),asyncHandler(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'لا يوجد ملف'});
 const isPDF=cvKind(req.file)==='pdf';
 let text;
 try{text=isPDF?(await pdf(req.file.buffer)).text:textFile(req.file.buffer);}
 catch{return res.status(400).json({error:'فشل قراءة ملف PDF. تأكد من سلامة الملف.'});}
 if(!text?.trim())return res.status(400).json({error:'الملف لا يحتوي على نص مقروء. ارفع PDF نصيًا أو أضف النص يدويًا. السيرة السابقة لم تتغير.'});
 const id=await replaceLatest('cv_profiles',req.session.userId,{content:text,filename:req.file.originalname,pdf_data:isPDF?req.file.buffer:null});
 res.json({id,content:text,filename:req.file.originalname});
}));
router.post('/text',asyncHandler(async(req,res)=>{
 const {content,name}=req.body;
 if(typeof content!=='string'||!content.trim())return res.status(400).json({error:'المحتوى فارغ'});
 const id=await replaceLatest('cv_profiles',req.session.userId,{content:content.trim(),filename:typeof name==='string'?name:'manual',pdf_data:null},{preservePDF:true});
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
