const {checkToolAccess}=require('../utils/access-control');
// routes/email.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { get, all, run } = require('../utils/db');
const { generateEmail, generateWhatsAppMessage } = require('../utils/ai');
const { sendEmail } = require('../utils/gmail');
const {resolveAccount}=require('../utils/gmail-accounts');
const wrap=require('../middleware/async-handler');
async function rememberSender(logId,userId,account){if(account)await run('UPDATE email_log SET sender_account_id=$1,sender_email=$2 WHERE id=$3 AND user_id=$4',[account.gmail_account_id,account.email,logId,userId]);}
const { syncReplies } = require('../utils/replyTracker');
const { sendWhatsAppMessage, requireConnected } = require('../utils/whatsapp');

const BASE_URL = (process.env.BASE_URL || 'https://mrsaal.ebnhussein.co').replace(/\/$/,'');

const {hasEmail,hasPhone,chooseChannel,skipReason,destination}=require('../utils/delivery-channel');
async function recordSkip(userId,company,channel,reason){
 await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,status,reason,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
 [uuidv4(),userId,company.id,company.name,destination(company,channel)||'', 'skipped',reason,channel]);
}

router.post('/generate', requireAuth, wrap(async (req, res) => {
  const { companyId } = req.body;
  const company = await get('SELECT * FROM companies WHERE id=$1 AND user_id=$2', [companyId, req.session.userId]);
  if (!company) return res.status(404).json({ error: 'الشركة غير موجودة' });
  const channel=chooseChannel(company,req.body.channel);
  const reason=skipReason(company,channel);
  if(reason){return res.json({skipped:true,status:'skipped',channel,reason});}
  const cv = await get('SELECT content FROM cv_profiles WHERE user_id=$1 ORDER BY (id=COALESCE((SELECT active_cv_id FROM users WHERE id=$1),$$ $$)) DESC,created_at DESC LIMIT 1', [req.session.userId]);
  if (!cv) return res.status(400).json({ error: 'لا توجد سيرة ذاتية محفوظة' });
  const tpl = await get('SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  const userSettings = await get('SELECT gemini_key, gemini_model FROM users WHERE id=$1', [req.session.userId]);
  try {
    if (channel==='email') {
      const email = await generateEmail({
        userId:req.session.userId, cv: cv.content, company,
        instructions: tpl?.instructions,
        subjectTemplate: tpl?.subject_template,
        apiKey: userSettings?.gemini_key || null,
        modelName: userSettings?.gemini_model || null
      });
      return res.json({ channel: 'email', ...email });
    }
    if (channel==='whatsapp') {
      const message = await generateWhatsAppMessage({
        userId:req.session.userId, cv: cv.content, company,
        instructions: tpl?.instructions,
        apiKey: userSettings?.gemini_key || null,
        modelName: userSettings?.gemini_model || null
      });
      return res.json({ channel: 'whatsapp', body: message });
    }
    return res.status(400).json({ error: 'الشركة ليس لها إيميل ولا رقم موبايل' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}));

router.post('/send', requireAuth, wrap(async (req, res) => {
  const { companyId, subject, body, scheduledAt } = req.body;
  const company = await get('SELECT * FROM companies WHERE id=$1 AND user_id=$2', [companyId, req.session.userId]);
  if (!company) return res.status(404).json({ error: 'الشركة غير موجودة' });
  const channel=chooseChannel(company,req.body.channel);
  const reason=skipReason(company,channel);
  if(reason){await recordSkip(req.session.userId,company,channel,reason);return res.json({ok:true,skipped:true,status:'skipped',channel,reason});}
  const user = await get('SELECT * FROM users WHERE id=$1', [req.session.userId]);
  if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
  const cv = await get('SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY (id=COALESCE((SELECT active_cv_id FROM users WHERE id=$1),$$ $$)) DESC,created_at DESC LIMIT 1', [req.session.userId]);
  const attachment = cv?.pdf_data ? { data: cv.pdf_data, filename: cv.filename || 'CV.pdf', mimeType: 'application/pdf' } : null;

  if (!hasEmail(company) && !hasPhone(company)) return res.status(400).json({ error: 'لا توجد وسيلة تواصل صالحة' });
  if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'نص الرسالة مطلوب' });
  if (scheduledAt && (!Number.isFinite(new Date(scheduledAt).getTime()) || new Date(scheduledAt).getTime() <= Date.now())) return res.status(400).json({ error: 'اختار موعدًا صحيحًا في المستقبل' });
  if (channel==='whatsapp') {
    try { await requireConnected(req.session.userId); }
    catch (err) { return res.status(409).json({ error: err.message }); }
  }

  const account=channel==='email'?await resolveAccount(req.session.userId,req.body.senderAccountId||null):null;
  if(scheduledAt)return res.json(await require('../utils/schedule-send').schedule(req.session.userId,{company,channel,account,cv,body,subject:subject||'',scheduledAt,idempotencyKey:req.body.idempotencyKey}));

  const result=await require('../utils/delivery').deliver(req.session.userId,{companyId,channel,subject:subject||'',body,senderAccountId:req.body.senderAccountId||null,idempotencyKey:req.body.idempotencyKey});
  return res.status(result.ok?200:409).json(result);
}));

router.post('/send-bulk', requireAuth, (req,res)=>res.status(409).json({error:'استخدم الحملات: راجع واعتمد المسودات أولًا ثم ابدأ الإرسال. الحملات تكمل حتى بعد قفل الصفحة.'}));

router.get('/log', requireAuth, wrap(async (req, res) => {
  const log = await all('SELECT * FROM email_log WHERE user_id=$1 ORDER BY sent_at DESC', [req.session.userId]);
  res.json(log);
}));

router.delete('/log', requireAuth, wrap(async (req, res) => {
  await run('DELETE FROM email_log WHERE user_id=$1', [req.session.userId]);
  res.json({ ok: true });
}));

router.get('/sync-replies', requireAuth, wrap(async (req, res) => {
  try { const result=await syncReplies(req.session.userId); res.json({ ok: true, ...result }); }
  catch (err) { res.status(500).json({ error: err.message }); }
}));

module.exports = router;
