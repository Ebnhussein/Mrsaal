// routes/cv.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pdf = require('pdf-parse');
const { requireAuth } = require('../middleware/auth');
const { get, run } = require('../utils/db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', requireAuth, async (req, res) => {
  const cv = await get(
    'SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
    [req.session.userId]
  );
  res.json(cv || null);
});

router.post('/upload', requireAuth, upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لا يوجد ملف' });
  try {
    let text = '';
    if (req.file.mimetype === 'application/pdf') {
      try {
        const data = await pdf(req.file.buffer);
        text = data.text;
      } catch (err) {
        throw new Error('فشل قراءة ملف الـ PDF. تأكد من سلامة الملف.');
      }
    } else {
      text = req.file.buffer.toString('utf-8');
    }
    const id = uuidv4();
    await run('DELETE FROM cv_profiles WHERE user_id=$1', [req.session.userId]);
    await run(
      'INSERT INTO cv_profiles (id, user_id, content, filename, pdf_data) VALUES ($1,$2,$3,$4,$5)',
      [id, req.session.userId, text, req.file.originalname,
       req.file.mimetype === 'application/pdf' ? req.file.buffer : null]
    );
    res.json({ id, content: text, filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في قراءة الملف: ' + err.message });
  }
});

router.post('/text', requireAuth, async (req, res) => {
  const { content, name } = req.body;
  if (!content) return res.status(400).json({ error: 'المحتوى فارغ' });
  const id = uuidv4();
  await run('DELETE FROM cv_profiles WHERE user_id=$1', [req.session.userId]);
  await run(
    'INSERT INTO cv_profiles (id, user_id, content, filename) VALUES ($1,$2,$3,$4)',
    [id, req.session.userId, content, name || 'manual']
  );
  res.json({ id, content });
});

router.get('/template', requireAuth, async (req, res) => {
  const tpl = await get(
    'SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
    [req.session.userId]
  );
  res.json(tpl || { subject_template: 'طلب انضمام — {your_name}', instructions: '' });
});

router.post('/template', requireAuth, async (req, res) => {
  const { subject_template, instructions } = req.body;
  await run('DELETE FROM templates WHERE user_id=$1', [req.session.userId]);
  await run(
    'INSERT INTO templates (id, user_id, subject_template, instructions) VALUES ($1,$2,$3,$4)',
    [uuidv4(), req.session.userId, subject_template || '', instructions || '']
  );
  res.json({ ok: true });
});

module.exports = router;
