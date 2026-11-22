const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/async-handler');
const { get,all,run,pool } = require('../utils/db');
const { replaceLatest } = require('../utils/user-records');
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024}});
router.use(requireAuth);
router.post('/builder/preview',asyncHandler(async(req,res)=>{const b=require('../utils/cv/builder'),d=b.normalize(req.body.profile);res.json({content:b.content(d),fingerprint:b.fingerprint(d),report:d.kind==='portfolio'?null:await require('../utils/cv/ats').analyze({kind:'builder',content:b.content(d),filename:'CV.docx',document_json:JSON.stringify(d)},req.body.jobDescription??'')});}));
router.post('/builder',asyncHandler(async(req,res)=>{const b=require('../utils/cv/builder'),d=b.normalize(req.body.profile);if(req.body.reviewed!==true||req.body.fingerprint!==b.fingerprint(d))return res.status(409).json({error:'راجع المعاينة بعد آخر تعديل قبل الحفظ.'});const id=await require('../utils/cv/store').save(req.session.userId,{content:b.content(d),filename:d.kind==='portfolio'?'Portfolio':'CV.docx',name:d.name+' · '+(d.kind==='portfolio'?'Portfolio':'CV'),kind:d.kind==='portfolio'?'portfolio':'builder',document_json:JSON.stringify(d)});res.json({ok:true,id});}));
router.get('/builder/:id',asyncHandler(async(req,res)=>{const cv=await require('../utils/cv/store').active(req.session.userId,req.params.id);if(!cv?.document_json)return res.status(404).json({error:'الملف غير موجود'});res.set('Cache-Control','no-store');res.json({profile:JSON.parse(cv.document_json)});}));
// Printer-friendly, text-based export. Browser's Save as PDF preserves selectable text.
router.get('/export/docx',asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv/store').active(req.session.userId,req.query.cvId||null);
 if(!cv||!['builder','tailored','ats-revised'].includes(cv.kind))return res.status(404).json({error:'السيرة غير موجودة'});
 const data=cv.attachment_data?Buffer.from(cv.attachment_data):cv.kind==='builder'&&cv.document_json?await require('../utils/cv/document').render(JSON.parse(cv.document_json)):await require('../utils/cv/export').renderText(cv.content);
 res.set({'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="Mrsaal-CV.docx"','Cache-Control':'private, no-store'});
 res.send(data);
}));
router.get('/print',asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv/store').active(req.session.userId,req.query.cvId||null);
 if(!cv||!['builder','tailored','ats-revised'].includes(cv.kind))return res.status(404).type('text/plain').send('CV not found');
 const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=cv.document_json?JSON.parse(cv.document_json):null;
 const lang=data?.language==='ar'||(!data&&/[\u0600-\u06ff]/.test(cv.content||''))?'ar':'en';
 const text=String(cv.content||'').slice(0,200000);
 const title=lang==='ar'?'تصدير CV كملف PDF':'Export CV as PDF';
 const source=require('../utils/cv/export').renderPrintableHTML(text);
 // Candidate text is escaped by the shared semantic HTML renderer.
 res.set({'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'});
 res.type('html').send(`<!doctype html><html lang="${lang}" dir="${lang==='ar'?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>
 @page{size:A4;margin:18mm 19mm}*{box-sizing:border-box}body{margin:0;background:#eef2f0;color:#172a25;font:14px/1.65 Arial,Tahoma,sans-serif}.toolbar{max-width:210mm;margin:20px auto;padding:13px 18px;border-radius:10px;background:white;display:flex;align-items:center;justify-content:space-between;gap:12px}.toolbar button{border:0;background:#0f7467;color:#fff;border-radius:8px;padding:10px 18px;font:inherit;cursor:pointer}.paper{width:210mm;min-height:297mm;background:white;margin:0 auto 30px;padding:18mm 19mm;box-shadow:0 6px 25px #0002}.content{overflow-wrap:anywhere;font:11pt/1.55 Arial,Tahoma,sans-serif}.cv-identity{padding-bottom:14px;border-bottom:1px solid #d9e1dc;margin-bottom:18px}.cv-identity h1{font-size:22px;margin:0 0 5px;line-height:1.35}.cv-role{margin:0 0 8px;font-weight:700;color:#247364}.cv-contact{font-size:10.5px;white-space:pre-wrap;unicode-bidi:plaintext;color:#50645e}.cv-section{margin:0 0 16px}.cv-section h2{font-size:12px;border-bottom:1px solid #dae2dc;padding:0 0 6px;margin:0 0 9px;break-after:avoid;color:#1b4339}.cv-paragraph{font-size:11px;line-height:1.65;white-space:pre-wrap;unicode-bidi:plaintext;overflow-wrap:anywhere;margin:0 0 10px}small{color:#66756e}@media(max-width:800px){.toolbar{margin:8px}.paper{width:100%;min-height:0;padding:22px}}@media print{body{background:#fff}.toolbar{display:none!important}.paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.content{font-size:10.5pt}}
 </style></head><body><div class="toolbar"><div><strong>${escape(title)}</strong><div><small>${lang==='ar'?'اختار Save as PDF من نافذة الطباعة':'Choose Save as PDF in the print dialog'}</small></div></div><button type="button" onclick="window.print()">${lang==='ar'?'حفظ PDF':'Save PDF'}</button></div><main class="paper"><div class="content" dir="auto">${source}</div></main></body></html>`);
}));
router.get('/attachment',asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv/store').active(req.session.userId,req.query.cvId||null),a=await require('../utils/cv/builder').attachment(cv);
 if(!a)return res.status(404).json({error:'لا يوجد مرفق لهذه النسخة'});
 const fallback=cv.kind==='builder'||cv.attachment_data?'CV.docx':'CV.pdf',filename=cv.kind==='tailored'?cv.filename:fallback;
 const encoded=encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 res.set({'Content-Type':a.mimeType,'Content-Disposition':`attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,'Cache-Control':'no-store'});res.send(a.data);
}));
router.post('/tailor',asyncHandler(async(req,res)=>{
 const id=req.session.userId,company=await get('SELECT * FROM companies WHERE id=$1 AND user_id=$2',[req.body.companyId,id]);if(!company)return res.status(404).json({error:'الشركة غير موجودة'});
 const source=await require('../utils/cv/store').active(id,req.body.cvId||null),tailor=require('../utils/cv/tailor');const row=await tailor.prepare(id,company,source,req.body.options??{});res.set('Cache-Control','private, no-store');res.json(tailor.view(row));
}));
router.get('/tailor/jobs',asyncHandler(async(req,res)=>{res.set('Cache-Control','private, no-store');res.json(await all("SELECT id,title,description FROM discovered_jobs WHERE user_id=$1 AND company_id=$2 AND status<>'needs_review' ORDER BY created_at DESC LIMIT 100",[req.session.userId,req.query.companyId]));}));
const aiReviewRunning=new Set();
router.post('/ats/ai-review',asyncHandler(async(req,res)=>{
 const userId=req.session.userId,{cvId,jobDescription}=req.body||{};
 if(typeof cvId!=='string'||!cvId||cvId.length>160)return res.status(400).json({error:'اختار CV صالح.'});
 if(aiReviewRunning.has(userId))return res.status(429).json({error:'في تحليل AI شغال حاليًا، جرّب بعد اكتماله.'});
 const cv=await require('../utils/cv/store').active(userId,cvId);
 if(!cv||cv.kind==='portfolio')return res.status(404).json({error:'ملف CV غير موجود.'});
 const read=require('../utils/cv/read-document');
 const parsed=cv.kind==='builder'&&cv.document_json?
  await read.docx(await require('../utils/cv/document').render(JSON.parse(cv.document_json))):
  cv.attachment_data?await read.docx(Buffer.from(cv.attachment_data)):
  cv.pdf_data?await read.pdf(Buffer.from(cv.pdf_data)):
  {text:cv.content,partial:false,pagesWithNoText:0};
 if(parsed.partial||parsed.pagesWithNoText)return res.status(422).json({error:'مش ممكن نعتمد على استخراج نص ناقص. ارفع ملف نصي كامل الأول.'});
 aiReviewRunning.add(userId);
 try{
  const ai=require('../utils/cv/ai-review');
  const review=await ai.improve(userId,parsed.text,jobDescription||'');
  res.set('Cache-Control','private, no-store');
  res.json({cvId:cv.id,kind:cv.kind,review});
 }finally{aiReviewRunning.delete(userId);}
}));
router.get('/ats/text',asyncHandler(async(req,res)=>{
 const cvId=req.query.cvId;
 if(typeof cvId!=='string'||!cvId||cvId.length>160)return res.status(400).json({error:'اختار نسخة CV صالحة.'});
 const source=await require('../utils/cv/store').active(req.session.userId,cvId);
 if(!source||!['cv','docx','ats-revised','builder'].includes(source.kind))return res.status(404).json({error:'النسخة غير موجودة'});
 const read=require('../utils/cv/read-document');
 const parsed=source.kind==='builder'&&source.document_json?await read.docx(await require('../utils/cv/document').render(JSON.parse(source.document_json)):source.attachment_data?await read.docx(Buffer.from(source.attachment_data)):source.pdf_data?await read.pdf(Buffer.from(source.pdf_data)):{text:source.content||''};
 if(parsed.partial||parsed.pagesWithNoText)return res.status(422).json({error:'لا يمكن تعديل ملف لم يتم استخراج نصه بالكامل. ارفع ملفًا نصيًا كاملًا.'});
 res.set('Cache-Control','private, no-store');res.json({content:parsed.text});
}));
// A user-reviewed copy of an uploaded CV; the uploaded original is left untouched.
router.post('/ats/revision',asyncHandler(async(req,res)=>{
 const {cvId,content,confirmed}=req.body||{};
 if(typeof cvId!=='string'||!cvId||cvId.length>160||typeof content!=='string'||content.length>180000||confirmed!==true)return res.status(400).json({error:'راجع النص ووافق على حفظ نسخة منفصلة.',code:'ATS_REVISION_INPUT'});
 const source=await require('../utils/cv/store').active(req.session.userId,cvId);
 if(!source||!['cv','docx','ats-revised','builder'].includes(source.kind))return res.status(422).json({error:'اختار نسخة CV صالحة قابلة للمراجعة.',code:'ATS_REVISION_SOURCE'});
 const safe=content.trim();
 if(!safe||/\x00/.test(safe)||!require('../utils/cv/ats').report(safe).readable)return res.status(422).json({error:'نص النسخة الجديدة غير مقروء بشكل كافٍ. راجع النص قبل الحفظ.',code:'ATS_REVISION_EMPTY'});
 const id=await require('../utils/cv/store').save(req.session.userId,{content:safe,filename:'ATS-reviewed-CV.docx',name:'ATS reviewed · '+String(source.name||source.filename||'CV').slice(0,100),kind:'ats-revised'});
 res.set('Cache-Control','private, no-store');res.json({ok:true,id,name:'ATS reviewed CV',kind:'ats-revised'});
}));
const atsRunning=new Set();
router.post('/ats',asyncHandler(async(req,res)=>{
 const id=req.session.userId,cvId=req.body.cvId;
 if(cvId!==undefined&&(typeof cvId!=='string'||!cvId||cvId.length>160))return res.status(400).json({error:'اختار نسخة CV صالحة.',code:'ATS_INPUT'});
 const cv=await require('../utils/cv/store').active(id,cvId||null);if(!cv)return res.status(404).json({error:'السيرة غير موجودة'});
 if(atsRunning.has(id))return res.status(429).json({error:'فحص آخر لملفك لسه شغال. انتظر ثم جرّب تاني.',code:'ATS_BUSY'});
 atsRunning.add(id);try{const report=await require('../utils/cv/ats').analyze(cv,req.body.jobDescription??'');res.set('Cache-Control','private, no-store');res.json({cv:{id:cv.id,name:cv.name,filename:cv.filename,kind:cv.kind},report});}finally{atsRunning.delete(id);}
}));
router.get('/summary',asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv/store').active(req.session.userId,req.query.cvId||null);if(!cv)return res.status(404).json({error:'السيرة غير موجودة'});
 const summary=require('../utils/cv/summary');const saved=summary.approved(cv);
 res.json({cvId:cv.id,sourceHash:summary.hash(cv.content),text:saved||summary.propose(cv.content),approved:!!saved,maxChars:summary.MAX_CHARS,sourceCharacters:cv.content?.length||0});
}));
router.post('/summary',asyncHandler(async(req,res)=>{
 const summary=require('../utils/cv/summary');const text=summary.validate(req.body.text,req.body.approved);
 const cv=await require('../utils/cv/store').active(req.session.userId,req.body.cvId);if(!cv||!req.body.cvId)return res.status(404).json({error:'السيرة غير موجودة'});
 if(req.body.sourceHash!==summary.hash(cv.content))return res.status(409).json({error:'السيرة تغيرت. افتح الملخص من جديد.'});
 const result=await run('UPDATE cv_profiles SET ai_summary=$1,ai_summary_source_hash=$2,ai_summary_approved_at=NOW() WHERE id=$3 AND user_id=$4 AND content=$5',[text,summary.hash(cv.content),cv.id,req.session.userId,cv.content]);
 if(!result.rowCount)return res.status(409).json({error:'السيرة تغيرت. افتح الملخص من جديد.'});res.json({ok:true});
}));
router.post('/summary/reset',asyncHandler(async(req,res)=>{await run("UPDATE cv_profiles SET ai_summary='',ai_summary_source_hash=NULL,ai_summary_approved_at=NULL WHERE id=$1 AND user_id=$2",[req.body.cvId,req.session.userId]);res.json({ok:true});}));
router.get('/list',asyncHandler(async(req,res)=>res.json(await all('SELECT id,name,filename,created_at,kind,(kind=$$builder$$ OR pdf_data IS NOT NULL OR attachment_data IS NOT NULL) AS has_attachment,(id=COALESCE((SELECT active_cv_id FROM users WHERE id=$1),$2)) AS active FROM cv_profiles WHERE user_id=$1 AND kind<>$$tailored$$ ORDER BY created_at DESC',[req.session.userId,'']))));
router.post('/select',asyncHandler(async(req,res)=>{if(!await get('SELECT id FROM cv_profiles WHERE user_id=$1 AND id=$2 AND kind<>$$tailored$$',[req.session.userId,req.body.id]))return res.status(404).json({error:'السيرة غير موجودة'});await run('UPDATE users SET active_cv_id=$1 WHERE id=$2',[req.body.id,req.session.userId]);res.json({ok:true});}));
router.delete('/:id',asyncHandler(async(req,res)=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.session.userId]);
  const values=[req.session.userId,req.params.id];
  const campaigns=await client.query("SELECT id FROM campaigns WHERE user_id=$1 AND cv_id=$2 AND status IN ('running','paused','draft')",values);
  const jobs=await client.query("SELECT id FROM scheduled_jobs WHERE user_id=$1 AND cv_id=$2 AND status IN ('pending','processing','uncertain')",values);
  const derived=await client.query("SELECT v.id FROM cv_profiles v WHERE v.user_id=$1 AND (v.id=$2 OR v.tailoring_json->>'sourceId'=$2) AND (EXISTS(SELECT 1 FROM scheduled_jobs j WHERE j.cv_id=v.id AND j.status IN ('pending','processing','uncertain')) OR EXISTS(SELECT 1 FROM campaign_items i JOIN campaigns c ON c.id=i.campaign_id WHERE i.cv_id=v.id AND c.status IN ('draft','paused','running')))",values);
  if(campaigns.rows.length||jobs.rows.length||derived.rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'السيرة مستخدمة في حملة أو إرسال مجدول. أنهِ الإرسال أو ألغِ الجدولة أولًا.'});}
  await client.query("DELETE FROM cv_profiles WHERE user_id=$1 AND tailoring_json->>'sourceId'=$2",values);
  const deleted=await client.query('DELETE FROM cv_profiles WHERE id=$1 AND user_id=$2',[req.params.id,req.session.userId]);
  await client.query('UPDATE users SET active_cv_id=NULL WHERE id=$1 AND active_cv_id=$2',values);
  await client.query('COMMIT');
  res.json({ok:true,deleted:deleted.rowCount});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
router.get('/pdf',asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv/store').active(req.session.userId);
 if(!cv?.pdf_data)return res.status(404).json({error:'لا يوجد PDF محفوظ. أعد رفع السيرة بصيغة PDF.'});
 res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="CV.pdf"','Cache-Control':'private, no-store'});
 res.send(cv.pdf_data);
}));
router.get('/', asyncHandler(async(req,res)=>{
 const cv=await require('../utils/cv/store').active(req.session.userId);res.json(cv?{id:cv.id,content:cv.content,filename:cv.filename,name:cv.name,created_at:cv.created_at,has_attachment:cv.kind==='builder'||!!cv.pdf_data||!!cv.attachment_data,attachment_type:cv.kind==='builder'||cv.attachment_data?'docx':cv.pdf_data?'pdf':null,kind:cv.kind}:null);
}));
router.post('/upload',upload.single('cv'),asyncHandler(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'لا يوجد ملف'});
 const parsed=await require('../utils/cv/read-document').upload(req.file);
 if(!parsed.text?.trim())return res.status(400).json({error:'الملف لا يحتوي على نص مقروء. قد يكون مصوّرًا ويحتاج OCR. السيرة السابقة لم تتغير.',code:'CV_NOT_READABLE'});
 if(parsed.partial)return res.status(422).json({error:'الملف أكبر من 20 صفحة. اختصر السيرة قبل رفعها علشان نقرأها كاملة.',code:'CV_PARSE_LIMIT'});
 const values={content:parsed.text,filename:req.file.originalname,pdf_data:parsed.format==='pdf'?req.file.buffer:null};
 if(parsed.format==='docx'){values.attachment_data=req.file.buffer;values.kind='docx';}
 const id=await require('../utils/cv/store').save(req.session.userId,values);
 res.json({id,content:parsed.text,filename:req.file.originalname,has_attachment:parsed.format!=='text',kind:parsed.format==='docx'?'docx':'cv'});
}));
router.post('/text',asyncHandler(async(req,res)=>{
 const {content,name}=req.body;
 if(typeof content!=='string'||!content.trim())return res.status(400).json({error:'المحتوى فارغ'});
 const id=await require('../utils/cv/store').save(req.session.userId,{content:content.trim(),filename:typeof name==='string'?name:'manual',pdf_data:null},true);
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
