// routes/email.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const db = require('../utils/db');
const { generateEmail, generateWhatsAppMessage } = require('../utils/ai');
const { sendEmail } = require('../utils/gmail');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const { syncReplies } = require('../utils/replyTracker');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// ── helpers ──────────────────────────────────────────────────────────────────
function hasEmail(company) { return company.email && company.email.includes('@'); }
function hasPhone(company) { return company.phone && String(company.phone).replace(/\D/g, '').length >= 7; }

// POST generate preview for one company
router.post('/generate', requireAuth, async (req, res) => {
  const { companyId } = req.body;

  const company = db.prepare('SELECT * FROM companies WHERE id=? AND user_id=?').get(companyId, req.session.userId);
  if (!company) return res.status(404).json({ error: 'الشركة غير موجودة' });

  const cv = db.prepare('SELECT content FROM cv_profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(req.session.userId);
  if (!cv) return res.status(400).json({ error: 'لا توجد سيرة ذاتية محفوظة' });

  const tpl = db.prepare('SELECT * FROM templates WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(req.session.userId);

  try {
    if (hasEmail(company)) {
      // Fetch user settings for API key & Model
      const user = db.prepare('SELECT gemini_key, gemini_model FROM users WHERE id = ?').get(req.session.userId);
      const apiKey = user?.gemini_key || null;
      const modelName = user?.gemini_model || 'gemini-1.5-flash';

      const email = await generateEmail({
        cv: cv.content,
        company,
        instructions: tpl?.instructions,
        subjectTemplate: tpl?.subject_template,
        apiKey,
        modelName
      });
      return res.json({ channel: 'email', ...email });
    }

    if (hasPhone(company)) {
      const message = await generateWhatsAppMessage({ cv: cv.content, company, instructions: tpl?.instructions });
      return res.json({ channel: 'whatsapp', body: message });
    }

    return res.status(400).json({ error: 'الشركة ليس لها إيميل ولا رقم موبايل' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST send one email/whatsapp
router.post('/send', requireAuth, async (req, res) => {
  const { companyId, subject, body, scheduledAt } = req.body;

  const company = db.prepare('SELECT * FROM companies WHERE id=? AND user_id=?').get(companyId, req.session.userId);
  if (!company) return res.status(404).json({ error: 'الشركة غير موجودة' });

  const cv = db.prepare('SELECT * FROM cv_profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(req.session.userId);
  const attachment = cv?.pdf_data ? {
    data: cv.pdf_data,
    filename: cv.filename || 'CV.pdf',
    mimeType: 'application/pdf'
  } : null;

  // ── Scheduled ────────────────────────────────────────────────────────────
  if (scheduledAt) {
    const jobId = uuidv4();
    db.prepare('INSERT INTO scheduled_jobs (id, user_id, company_id, scheduled_at) VALUES (?,?,?,?)')
      .run(jobId, req.session.userId, companyId, new Date(scheduledAt).getTime());
    db.prepare('UPDATE companies SET status=?, scheduled_at=? WHERE id=?')
      .run('scheduled', new Date(scheduledAt).getTime(), companyId);

    const logId = uuidv4();
    const channel = hasEmail(company) ? 'email' : 'whatsapp';
    db.prepare(`INSERT INTO email_log (id, user_id, company_id, company_name, company_email, subject, body, status, channel)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(logId, req.session.userId, companyId, company.name, company.email || company.phone, subject, body, 'scheduled', channel);

    return res.json({ ok: true, status: 'scheduled', scheduledAt });
  }

  // ── Send now ─────────────────────────────────────────────────────────────
  const logId = uuidv4();

  // WhatsApp path
  if (!hasEmail(company) && hasPhone(company)) {
    try {
      await sendWhatsAppMessage(company.phone, body, attachment);
      db.prepare('UPDATE companies SET status=? WHERE id=?').run('sent', companyId);
      db.prepare(`INSERT INTO email_log (id, user_id, company_id, company_name, company_email, subject, body, status, channel)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(logId, req.session.userId, companyId, company.name, company.phone, subject || '', body, 'sent', 'whatsapp');
      return res.json({ ok: true, status: 'sent', channel: 'whatsapp', logId });
    } catch (err) {
      db.prepare('UPDATE companies SET status=? WHERE id=?').run('failed', companyId);
      db.prepare(`INSERT INTO email_log (id, user_id, company_id, company_name, company_email, subject, body, status, reason, channel)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(logId, req.session.userId, companyId, company.name, company.phone, subject || '', body || '', 'failed', err.message, 'whatsapp');
      return res.status(500).json({ error: err.message });
    }
  }

  // Email path
  const trackingUrl = `${BASE_URL}/track/open/${logId}.gif`;
  try {
    const result = await sendEmail({ user, to: company.email, subject, body, trackingPixelUrl: trackingUrl, attachment });
    db.prepare('UPDATE companies SET status=? WHERE id=?').run('sent', companyId);
    db.prepare(`INSERT INTO email_log (id, user_id, company_id, company_name, company_email, subject, body, status, message_id, thread_id, channel)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(logId, req.session.userId, companyId, company.name, company.email, subject, body, 'sent', result.messageId, result.threadId, 'email');
    res.json({ ok: true, status: 'sent', channel: 'email', logId });
  } catch (err) {
    db.prepare('UPDATE companies SET status=? WHERE id=?').run('failed', companyId);
    db.prepare(`INSERT INTO email_log (id, user_id, company_id, company_name, company_email, subject, body, status, reason, channel)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(logId, req.session.userId, companyId, company.name, company.email, subject || '', body || '', 'failed', err.message, 'email');
    res.status(500).json({ error: err.message });
  }
});

// POST bulk auto-send (no preview)
router.post('/send-bulk', requireAuth, async (req, res) => {
  const { companyIds, scheduleType, scheduledAt, batchSize, delaySeconds } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  const cv = db.prepare('SELECT * FROM cv_profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(req.session.userId);
  const tpl = db.prepare('SELECT * FROM templates WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(req.session.userId);

  if (!cv) return res.status(400).json({ error: 'لا توجد سيرة ذاتية' });

  const attachment = cv.pdf_data ? {
    data: cv.pdf_data,
    filename: cv.filename || 'CV.pdf',
    mimeType: 'application/pdf'
  } : null;

  const companies = companyIds.map(id =>
    db.prepare('SELECT * FROM companies WHERE id=? AND user_id=?').get(id, req.session.userId)
  ).filter(Boolean);

  if (scheduleType === 'scheduled' && scheduledAt) {
    companies.forEach(c => {
      const logId = uuidv4();
      const channel = hasEmail(c) ? 'email' : 'whatsapp';
      db.prepare('UPDATE companies SET status=?,scheduled_at=? WHERE id=?')
        .run('scheduled', new Date(scheduledAt).getTime(), c.id);
      db.prepare(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,status,channel)
        VALUES(?,?,?,?,?,?,?)`)
        .run(logId, req.session.userId, c.id, c.name, c.email || c.phone, 'scheduled', channel);
      db.prepare('INSERT INTO scheduled_jobs (id,user_id,company_id,scheduled_at) VALUES(?,?,?,?)')
        .run(uuidv4(), req.session.userId, c.id, new Date(scheduledAt).getTime());
    });
    return res.json({ ok: true, scheduled: companies.length });
  }

  // Stream via SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const delayMs = (delaySeconds || 3) * 1000;

  let sent = 0, failed = 0;

  const userSettings = db.prepare('SELECT gemini_key, gemini_model FROM users WHERE id=?').get(req.session.userId);
  const apiKey = userSettings?.gemini_key || null;
  const modelName = userSettings?.gemini_model || 'gemini-1.5-flash';

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const channel = hasEmail(company) ? 'email' : (hasPhone(company) ? 'whatsapp' : null);
    send({ type: 'progress', i, total: companies.length, company: company.name, channel });

    if (!channel) {
      failed++;
      send({ type: 'failed', company: company.name, reason: 'لا يوجد إيميل أو رقم واتساب' });
      continue;
    }

    const logId = uuidv4();

    try {
      if (channel === 'whatsapp') {
        const message = await generateWhatsAppMessage({ 
          cv: cv.content, 
          company, 
          instructions: tpl?.instructions,
          apiKey,
          modelName
        });
        await sendWhatsAppMessage(company.phone, message, attachment);
        db.prepare('UPDATE companies SET status=? WHERE id=?').run('sent', company.id);
        db.prepare(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,body,status,channel)
          VALUES(?,?,?,?,?,?,?,?)`)
          .run(logId, req.session.userId, company.id, company.name, company.phone, message, 'sent', 'whatsapp');
      } else {
        const email = await generateEmail({ 
          cv: cv.content, 
          company, 
          instructions: tpl?.instructions, 
          subjectTemplate: tpl?.subject_template,
          apiKey,
          modelName
        });
        const trackingUrl = `${BASE_URL}/track/open/${logId}.gif`;
        const result = await sendEmail({ user, to: company.email, subject: email.subject, body: email.body, trackingPixelUrl: trackingUrl, attachment });
        db.prepare('UPDATE companies SET status=? WHERE id=?').run('sent', company.id);
        db.prepare(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,subject,body,status,message_id,thread_id,channel)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
          .run(logId, req.session.userId, company.id, company.name, company.email, email.subject, email.body, 'sent', result.messageId, result.threadId, 'email');
      }

      sent++;
      send({ type: 'sent', company: company.name, channel });
    } catch (err) {
      db.prepare('UPDATE companies SET status=? WHERE id=?').run('failed', company.id);
      db.prepare(`INSERT INTO email_log (id,user_id,company_id,company_name,company_email,status,reason,channel)
        VALUES(?,?,?,?,?,?,?,?)`)
        .run(logId, req.session.userId, company.id, company.name, company.email || company.phone, 'failed', err.message, channel);
      failed++;
      send({ type: 'failed', company: company.name, reason: err.message });
    }

    if (i < companies.length - 1) await delay(delayMs);
  }

  send({ type: 'done', sent, failed, total: companies.length });
  res.end();
});

// GET email/whatsapp log
router.get('/log', requireAuth, (req, res) => {
  const log = db.prepare('SELECT * FROM email_log WHERE user_id=? ORDER BY sent_at DESC').all(req.session.userId);
  res.json(log);
});

// DELETE clear log
router.delete('/log', requireAuth, (req, res) => {
  db.prepare('DELETE FROM email_log WHERE user_id=?').run(req.session.userId);
  res.json({ ok: true });
});

// GET sync replies manually
router.get('/sync-replies', requireAuth, async (req, res) => {
  try {
    await syncReplies();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
