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

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

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
  const cv = await get('SELECT content FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
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
  const cv = await get('SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  const attachment = cv?.pdf_data ? { data: cv.pdf_data, filename: cv.filename || 'CV.pdf', mimeType: 'application/pdf' } : null;

  if (!hasEmail(company) && !hasPhone(company)) return res.status(400).json({ error: 'لا توجد وسيلة تواصل صالحة' });
  if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'نص الرسالة مطلوب' });
  if (scheduledAt && (!Number.isFinite(new Date(scheduledAt).getTime()) || new Date(scheduledAt).getTime() <= Date.now())) return res.status(400).json({ error: 'اختار موعدًا صحيحًا في المستقبل' });
  if (channel==='whatsapp') {
    try { await requireConnected(req.session.userId); }
    catch (err) { return res.status(409).json({ error: err.message }); }
  }

  const account=channel==='email'?await resolveAccount(req.session.userId,req.body.senderAccountId||null):null;
  if (scheduledAt) {
    const tsMs = new Date(scheduledAt).getTime();
    const logId = uuidv4();
    await run('INSERT INTO scheduled_jobs (id,user_id,company_id,scheduled_at,log_id,sender_account_id) VALUES ($1,$2,$3,$4,$5,$6)', [uuidv4(), req.session.userId, companyId, tsMs, logId,account?.gmail_account_id||null]);
    await run('UPDATE companies SET status=$1, scheduled_at=$2 WHERE id=$3', ['scheduled', tsMs, companyId]);
    await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [logId, req.session.userId, companyId, company.name, destination(company,channel), subject, body, 'scheduled', channel]);
    await rememberSender(logId,req.session.userId,account);
    return res.json({ ok: true, status: 'scheduled' });
  }

  const logId = uuidv4();

  if (channel==='whatsapp') {
    try {
      const result = await sendWhatsAppMessage(req.session.userId, company.phone, body, attachment);
      await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', companyId]);
      await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,channel,message_id,thread_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [logId, req.session.userId, companyId, company.name, company.phone, subject||'', body, 'sent', 'whatsapp',result.messageId,result.threadId]);
      return res.json({ ok: true, status: 'sent', channel: 'whatsapp' });
    } catch (err) {
      await run('UPDATE companies SET status=$1 WHERE id=$2', ['failed', companyId]);
      await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,reason,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [logId, req.session.userId, companyId, company.name, company.phone, subject||'', body||'', 'failed', err.message, 'whatsapp']);
      return res.status(500).json({ error: err.message });
    }
  }

  const trackingUrl = `${BASE_URL}/track/open/${logId}.gif`;
  try {
    const result = await sendEmail({ user, account, to: company.email, subject, body, trackingPixelUrl: trackingUrl, attachment });
    await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', companyId]);
    await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,message_id,thread_id,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [logId, req.session.userId, companyId, company.name, company.email, subject, body, 'sent', result.messageId, result.threadId, 'email']);
    await rememberSender(logId,req.session.userId,account);
    res.json({ ok: true, status: 'sent', channel: 'email', logId });
  } catch (err) {
    await run('UPDATE companies SET status=$1 WHERE id=$2', ['failed', companyId]);
    await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,reason,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [logId, req.session.userId, companyId, company.name, company.email, subject||'', body||'', 'failed', err.message, 'email']);
    await rememberSender(logId,req.session.userId,account);
    res.status(500).json({ error: err.message });
  }
}));

router.post('/send-bulk', requireAuth, wrap(async (req, res) => {
  const { companyIds, scheduleType, scheduledAt, delaySeconds } = req.body;
  if(!Array.isArray(companyIds) || !companyIds.length || companyIds.length > 500 || companyIds.some(id=>typeof id!=='string')) return res.status(400).json({error:'اختار من 1 إلى 500 شركة'});
  if(scheduleType === 'scheduled' && (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime()) || new Date(scheduledAt).getTime() <= Date.now())) return res.status(400).json({error:'اختار موعدًا صحيحًا في المستقبل'});
  const user = await get('SELECT * FROM users WHERE id=$1', [req.session.userId]);
  const cv = await get('SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  const tpl = await get('SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  if (!cv) return res.status(400).json({ error: 'لا توجد سيرة ذاتية' });
  const attachment = cv.pdf_data ? { data: cv.pdf_data, filename: cv.filename||'CV.pdf', mimeType: 'application/pdf' } : null;
  const companies = (await Promise.all([...new Set(companyIds)].map(id => get('SELECT * FROM companies WHERE id=$1 AND user_id=$2', [id, req.session.userId])))).filter(Boolean);
  const channel=chooseChannel({},req.body.channel||'email');
  const eligible=companies.filter(c=>!skipReason(c,channel));
  if(channel==='whatsapp'&&eligible.length) {
    try {await requireConnected(req.session.userId);}
    catch(err){return res.status(409).json({error:err.message});}
  }
  const account=channel==='email'&&eligible.length?await resolveAccount(req.session.userId,req.body.senderAccountId||null):null;
  const apiKey = user?.gemini_key || null;
  const modelName = user?.gemini_model || null;

  if (scheduleType === 'scheduled' && scheduledAt) {
    const tsMs = new Date(scheduledAt).getTime();
    let scheduledCount=0;const skippedItems=[];
    for (const c of companies) {
      const reason=skipReason(c,channel);
      if(reason){await recordSkip(req.session.userId,c,channel,reason);skippedItems.push({companyId:c.id,company:c.name,reason});continue;}
      const logId = uuidv4();
      await run('UPDATE companies SET status=$1, scheduled_at=$2 WHERE id=$3', ['scheduled', tsMs, c.id]);
      await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,status,channel) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [logId, req.session.userId, c.id, c.name, destination(c,channel), 'scheduled', channel]);
      await run('INSERT INTO scheduled_jobs (id,user_id,company_id,scheduled_at,log_id,sender_account_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [uuidv4(), req.session.userId, c.id, tsMs, logId,channel==='email'?account.gmail_account_id:null]);
      if(channel==='email')await rememberSender(logId,req.session.userId,account);
      scheduledCount++;
    }
    return res.json({ ok: true, scheduled: scheduledCount,skipped:skippedItems.length,skippedItems });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let disconnected=false;
  res.on('close',()=>{disconnected=true;});
  const send = data => !disconnected && res.write(`data: ${JSON.stringify(data)}\n\n`);
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const delayMs = Math.min(300,Math.max(3,Number(delaySeconds)||3)) * 1000;
  let sent = 0, failed = 0, skipped=0;

  for (let i = 0; i < companies.length; i++) {
    if(disconnected) break;
    const company = companies[i];
    send({ type: 'progress', i: i+1, total: companies.length, company: company.name,companyId:company.id, channel });
    const reason=skipReason(company,channel);
    if(reason){await recordSkip(req.session.userId,company,channel,reason);skipped++;send({type:'skipped',company:company.name,companyId:company.id,channel,reason});continue;}
    const logId = uuidv4();
    try {
      if (channel === 'whatsapp') {
        const message = await generateWhatsAppMessage({ userId:req.session.userId, cv: cv.content, company, instructions: tpl?.instructions, apiKey, modelName });
        const result = await sendWhatsAppMessage(req.session.userId, company.phone, message, attachment);
        await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', company.id]);
        await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,body,status,channel,message_id,thread_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [logId, req.session.userId, company.id, company.name, company.phone, message, 'sent', 'whatsapp',result.messageId,result.threadId]);
      } else {
        const email = await generateEmail({ userId:req.session.userId, cv: cv.content, company, instructions: tpl?.instructions, subjectTemplate: tpl?.subject_template, apiKey, modelName });
        const trackingUrl = `${BASE_URL}/track/open/${logId}.gif`;
        const result = await sendEmail({ user, account, to: company.email, subject: email.subject, body: email.body, trackingPixelUrl: trackingUrl, attachment });
        await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', company.id]);
        await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,message_id,thread_id,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [logId, req.session.userId, company.id, company.name, company.email, email.subject, email.body, 'sent', result.messageId, result.threadId, 'email']);
      }
      if(channel==='email')await rememberSender(logId,req.session.userId,account);
      sent++;
      send({ type: 'sent', company: company.name,companyId:company.id, channel });
    } catch (err) {
      await run('UPDATE companies SET status=$1 WHERE id=$2', ['failed', company.id]);
      await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,status,reason,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [logId, req.session.userId, company.id, company.name, destination(company,channel), 'failed', err.message, channel]);
      if(channel==='email')await rememberSender(logId,req.session.userId,account);
      failed++;
      send({ type: 'failed', company: company.name,companyId:company.id, reason: err.message });
    }
    if (i < companies.length - 1) await delay(delayMs);
  }
  send({ type: 'done', sent, failed, skipped, total: companies.length });
  res.end();
}));

router.get('/log', requireAuth, wrap(async (req, res) => {
  const log = await all('SELECT * FROM email_log WHERE user_id=$1 ORDER BY sent_at DESC', [req.session.userId]);
  res.json(log);
}));

router.delete('/log', requireAuth, wrap(async (req, res) => {
  await run('DELETE FROM email_log WHERE user_id=$1', [req.session.userId]);
  res.json({ ok: true });
}));

router.get('/sync-replies', requireAuth, wrap(async (req, res) => {
  try { await syncReplies(); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
}));

module.exports = router;
