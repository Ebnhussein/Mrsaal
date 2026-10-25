// routes/companies.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const {spreadsheetRows,column}=require('../utils/upload-files');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const asyncHandler=require('../middleware/async-handler');
const { get, all, run } = require('../utils/db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const offset=Math.max(0,Math.min(100000,parseInt(req.query?.offset)||0)),limit=Math.max(1,Math.min(250,parseInt(req.query?.limit)||250));
  const companies=await all('SELECT * FROM companies WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',[req.session.userId,limit+1,offset]);
  const more=companies.length>limit;res.json({companies:companies.slice(0,limit),nextOffset:more?offset+limit:null});
}));

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { name, email, phone, field, location } = req.body;
  if ([name,email,phone,field,location].some(v=>v!=null&&typeof v!=='string') || (name||'').length>200 || (email||'').length>254 || (phone||'').length>40 || (field||'').length>200 || (location||'').length>200) return res.status(400).json({error:'راجع نوع البيانات وطول الحقول.'});
  if (!name?.trim()) return res.status(400).json({ error: 'اسم الشركة مطلوب' });
  if (!email && !phone) return res.status(400).json({ error: 'الإيميل أو رقم الموبايل مطلوب' });
  const result=await require('../utils/companies/store').add(req.session.userId,[{name:name.trim(),email:(email||'').trim().toLowerCase(),phone:(phone||'').trim(),field:(field||'').trim(),location:(location||'').trim()}]);
  res.json({ok:true,id:result.ids[0]||null,duplicate:result.added===0});
}));

router.post('/import', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لا يوجد ملف' });
  try {
    const {rows,width,sheetName}=spreadsheetRows(req.file,XLSX);
    const headers = Array.from({length:width},(_,i) => ({ index:i, name:String(rows[0][i] || `عمود ${i+1}`) }));
    res.json({ headers, totalRows: rows.length - 1, sheetName });
  } catch (err) {
    res.status(err.status||400).json({ error: 'خطأ في قراءة الملف: ' + err.message });
  }
});

router.post('/import/commit', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لا يوجد ملف' });
  const { nameCol, emailCol, phoneCol, fieldCol, locationCol } = req.body;
  try {
    const {rows,width}=spreadsheetRows(req.file,XLSX);
    const ni=column(nameCol,width,true),ei=column(emailCol,width),pi=column(phoneCol,width),fi=column(fieldCol,width),li=column(locationCol,width);
    if(ei<0&&pi<0)return res.status(400).json({error:'اختار عمود الإيميل أو الهاتف على الأقل.'});
    const incoming=[];let invalid=0;
    for(const row of rows.slice(1).filter(r=>r.some(c=>c))){
      const data={name:String(row[ni]||'').trim(),email:ei>=0?String(row[ei]||'').trim().toLowerCase():'',phone:pi>=0?String(row[pi]||'').trim().replace(/\s/g,''):'',field:fi>=0?String(row[fi]||'').trim():'',location:li>=0?String(row[li]||'').trim():''};
      if(!data.name||(!data.email&&!data.phone)||(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))||data.name.length>200||data.email.length>254||data.phone.length>40||data.field.length>200||data.location.length>200){invalid++;continue;}incoming.push(data);
    }
    const result=await require('../utils/companies/store').add(req.session.userId,incoming);res.json({added:result.added,skipped:result.skipped+invalid});
  } catch (err) {
    if(err.status&&err.status<500)return res.status(err.status).json({error:err.message});
    throw err;
  }
}));

router.patch('/:id/details', requireAuth, asyncHandler(async (req,res)=>{const company=await require('../utils/companies/edit').update(req.session.userId,req.params.id,req.body,req.body.expected);res.json({ok:true,company});}));

router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { status, selected, scheduled_at } = req.body;
  if (status!==undefined&&!['pending','sent','failed','scheduled','skipped','processing','uncertain','cancelled'].includes(status)) return res.status(400).json({error:'حالة الشركة غير صحيحة.'});
  if (selected!==undefined&&![true,false,0,1].includes(selected)) return res.status(400).json({error:'اختيار الشركة غير صحيح.'});
  if (scheduled_at!==undefined&&scheduled_at!==null&&(!Number.isSafeInteger(scheduled_at)||scheduled_at<0)) return res.status(400).json({error:'موعد الجدولة غير صحيح.'});
  const fields = [], vals = [];
  let i = 1;
  if (status       !== undefined) { fields.push(`status=$${i++}`);       vals.push(status); }
  if (selected     !== undefined) { fields.push(`selected=$${i++}`);     vals.push(selected ? 1 : 0); }
  if (scheduled_at !== undefined) { fields.push(`scheduled_at=$${i++}`); vals.push(scheduled_at); }
  if (!fields.length) return res.json({ ok: true });
  vals.push(req.params.id, req.session.userId);
  await run(`UPDATE companies SET ${fields.join(',')} WHERE id=$${i} AND user_id=$${i+1}`, vals);
  res.json({ ok: true });
}));

router.patch('/', requireAuth, asyncHandler(async (req, res) => {
  const { ids, selected } = req.body;
  if (![true,false,0,1].includes(selected)) return res.status(400).json({error:'اختيار الشركة غير صحيح.'});
  if (!Array.isArray(ids)||ids.length>10000||ids.some(id=>typeof id!=='string'||!id||id.length>160)) return res.status(400).json({error:'اختار قائمة شركات صحيحة.'});
  if (!ids.length) return res.json({ ok: true });
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  await run(
    `UPDATE companies SET selected=$1 WHERE id IN (${placeholders}) AND user_id=$${ids.length + 2}`,
    [selected ? 1 : 0, ...ids, req.session.userId]
  );
  res.json({ ok: true });
}));

router.delete('/', requireAuth, asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)||ids.length>10000||ids.some(id=>typeof id!=='string'||!id||id.length>160)) return res.status(400).json({error:'اختار قائمة شركات صحيحة.'});
  if (!ids.length) return res.json({ ok: true });
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  const result = await run(
    `DELETE FROM companies WHERE id IN (${placeholders}) AND user_id=$1`,
    [req.session.userId, ...ids]
  );
  res.json({ deleted: result.rowCount });
}));

module.exports = router;
