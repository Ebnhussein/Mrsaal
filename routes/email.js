// routes/email.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { get, all, run } = require('../utils/db');
const { generateEmail } = require('../utils/ai');
const { sendEmail } = require('../utils/gmail');
const { syncReplies } = require('../utils/replyTracker');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

function hasEmail(company) { return company.email && company.email.includes('@'); }
function hasPhone(company) { return company.phone && String(company.phone).replace(/\D/g, '').length >= 7; }

router.post('/generate', requireAuth, async (req, res) => {
  const { companyId } = req.body;
  const company = await get('SELECT * FROM companies WHERE id=$1 AND user_id=$2', [companyId, req.session.userId]);
  if (!company) return res.status(404).json({ error: 'الشركة غير موجودة' });
  const cv = await get('SELECT content FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  if (!cv) return res.status(400).json({ error: 'لا توجد سيرة ذاتية محفوظة' });
  const tpl = await get('SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  const userSettings = await get('SELECT gemini_key, gemini_model FROM users WHERE id=$1', [req.session.userId]);
  try {
    if (hasEmail(company)) {
      const email = await generateEmail({
        cv: cv.content, company,
        instructions: tpl?.instructions,
        subjectTemplate: tpl?.subject_template,
        apiKey: userSettings?.gemini_key || null,
        modelName: userSettings?.gemini_model || 'gemini-2.0-flash'
      });
      return res.json({ channel: 'email', ...email });
    }
    if (hasPhone(company)) {
      const message = await generateWhatsAppMessage({
        cv: cv.content, company,
        instructions: tpl?.instructions,
        apiKey: userSettings?.gemini_key || null,
        modelName: userSettings?.gemini_model || 'gemini-1.5-flash'
      });
      return res.json({ channel: 'whatsapp', body: message });
    }
    return res.status(400).json({ error: 'الشركة ليس لها إيميل ولا رقم موبايل' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', requireAuth, async (req, res) => {
  const { companyId, subject, body, scheduledAt } = req.body;
  const company = await get('SELECT * FROM companies WHERE id=$1 AND user_id=$2', [companyId, req.session.userId]);
  if (!company) return res.status(404).json({ error: 'الشركة غير موجودة' });
  const user = await get('SELECT * FROM users WHERE id=$1', [req.session.userId]);
  if (!user) return res.status(401).json({ error: 'المستخدم غير موجود' });
  const cv = await get('SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  const attachment = cv?.pdf_data ? { data: cv.pdf_data, filename: cv.filename || 'CV.pdf', mimeType: 'application/pdf' } : null;

  if (scheduledAt) {
    const tsMs = new Date(scheduledAt).getTime();
    const logId = uuidv4();
    const channel = hasEmail(company) ? 'email' : 'whatsapp';
    await run('INSERT INTO scheduled_jobs (id,user_id,company_id,scheduled_at) VALUES ($1,$2,$3,$4)', [uuidv4(), req.session.userId, companyId, tsMs]);
    await run('UPDATE companies SET status=$1, scheduled_at=$2 WHERE id=$3', ['scheduled', tsMs, companyId]);
    await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [logId, req.session.userId, companyId, company.name, company.email || company.phone, subject, body, 'scheduled', channel]);
    return res.json({ ok: true, status: 'scheduled' });
  }

  const logId = uuidv4();

  if (!hasEmail(company) && hasPhone(company)) {
    try {
      await sendWhatsAppMessage(company.phone, body, attachment);
      await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', companyId]);
      await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [logId, req.session.userId, companyId, company.name, company.phone, subject||'', body, 'sent', 'whatsapp']);
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
    const result = await sendEmail({ user, to: company.email, subject, body, trackingPixelUrl: trackingUrl, attachment });
    await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', companyId]);
    await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,message_id,thread_id,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [logId, req.session.userId, companyId, company.name, company.email, subject, body, 'sent', result.messageId, result.threadId, 'email']);
    res.json({ ok: true, status: 'sent', channel: 'email', logId });
  } catch (err) {
    await run('UPDATE companies SET status=$1 WHERE id=$2', ['failed', companyId]);
    await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,reason,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [logId, req.session.userId, companyId, company.name, company.email, subject||'', body||'', 'failed', err.message, 'email']);
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-bulk', requireAuth, async (req, res) => {
  const { companyIds, scheduleType, scheduledAt, delaySeconds } = req.body;
  const user = await get('SELECT * FROM users WHERE id=$1', [req.session.userId]);
  const cv = await get('SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  const tpl = await get('SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.session.userId]);
  if (!cv) return res.status(400).json({ error: 'لا توجد سيرة ذاتية' });
  const attachment = cv.pdf_data ? { data: cv.pdf_data, filename: cv.filename||'CV.pdf', mimeType: 'application/pdf' } : null;
  const companies = (await Promise.all(companyIds.map(id => get('SELECT * FROM companies WHERE id=$1 AND user_id=$2', [id, req.session.userId])))).filter(Boolean);
  const apiKey = user?.gemini_key || null;
  const modelName = user?.gemini_model || 'gemini-2.0-flash';

  if (scheduleType === 'scheduled' && scheduledAt) {
    const tsMs = new Date(scheduledAt).getTime();
    for (const c of companies) {
      const channel = hasEmail(c) ? 'email' : 'whatsapp';
      await run('UPDATE companies SET status=$1, scheduled_at=$2 WHERE id=$3', ['scheduled', tsMs, c.id]);
      await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,status,channel) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuidv4(), req.session.userId, c.id, c.name, c.email||c.phone, 'scheduled', channel]);
      await run('INSERT INTO scheduled_jobs (id,user_id,company_id,scheduled_at) VALUES ($1,$2,$3,$4)',
        [uuidv4(), req.session.userId, c.id, tsMs]);
    }
    return res.json({ ok: true, scheduled: companies.length });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const delayMs = (delaySeconds || 3) * 1000;
  let sent = 0, failed = 0;

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const channel = hasEmail(company) ? 'email' : (hasPhone(company) ? 'whatsapp' : null);
    send({ type: 'progress', i: i+1, total: companies.length, company: company.name, channel });
    if (!channel) { failed++; send({ type: 'failed', company: company.name, reason: 'لا يوجد إيميل أو رقم' }); continue; }
    const logId = uuidv4();
    try {
      if (channel === 'whatsapp') {
        const message = await generateWhatsAppMessage({ cv: cv.content, company, instructions: tpl?.instructions, apiKey, modelName });
        await sendWhatsAppMessage(company.phone, message, attachment);
        await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', company.id]);
        await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,body,status,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [logId, req.session.userId, company.id, company.name, company.phone, message, 'sent', 'whatsapp']);
      } else {
        const email = await generateEmail({ cv: cv.content, company, instructions: tpl?.instructions, subjectTemplate: tpl?.subject_template, apiKey, modelName });
        const trackingUrl = `${BASE_URL}/track/open/${logId}.gif`;
        const result = await sendEmail({ user, to: company.email, subject: email.subject, body: email.body, trackingPixelUrl: trackingUrl, attachment });
        await run('UPDATE companies SET status=$1 WHERE id=$2', ['sent', company.id]);
        await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,message_id,thread_id,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [logId, req.session.userId, company.id, company.name, company.email, email.subject, email.body, 'sent', result.messageId, result.threadId, 'email']);
      }
      sent++;
      send({ type: 'sent', company: company.name, channel });
    } catch (err) {
      await run('UPDATE companies SET status=$1 WHERE id=$2', ['failed', company.id]);
      await run(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,status,reason,channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [logId, req.session.userId, company.id, company.name, company.email||company.phone, 'failed', err.message, channel]);
      failed++;
      send({ type: 'failed', company: company.name, reason: err.message });
    }
    if (i < companies.length - 1) await delay(delayMs);
  }
  send({ type: 'done', sent, failed, total: companies.length });
  res.end();
});

router.get('/log', requireAuth, async (req, res) => {
  const log = await all('SELECT * FROM email_log WHERE user_id=$1 ORDER BY sent_at DESC', [req.session.userId]);
  res.json(log);
});

router.delete('/log', requireAuth, async (req, res) => {
  await run('DELETE FROM email_log WHERE user_id=$1', [req.session.userId]);
  res.json({ ok: true });
});

router.get('/sync-replies', requireAuth, async (req, res) => {
  try { await syncReplies(); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
