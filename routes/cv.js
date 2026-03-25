// routes/cv.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { extractPdfText } = require('../utils/ai');
const { requireAuth } = require('../middleware/auth');
const db = require('../utils/db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET current CV
router.get('/', requireAuth, (req, res) => {
  const cv = db.prepare('SELECT * FROM cv_profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.session.userId);
  res.json(cv || null);
});

// POST upload PDF CV
router.post('/upload', requireAuth, upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لا يوجد ملف' });

  try {
    let text = '';

    const user = db.prepare('SELECT gemini_key FROM users WHERE id = ?').get(req.session.userId);
    const apiKey = user?.gemini_key || null;

    if (req.file.mimetype === 'application/pdf') {
      try {
        text = await extractPdfText(req.file.buffer, apiKey);
      } catch (err) {
        console.error('PDF Parse Error:', err);
        // Fallback or error handled by the AI utility
      }
    } else {
      text = req.file.buffer.toString('utf-8');
    }

    const id = uuidv4();
    db.prepare('DELETE FROM cv_profiles WHERE user_id = ?').run(req.session.userId);
    db.prepare('INSERT INTO cv_profiles (id, user_id, content, filename, pdf_data) VALUES (?,?,?,?,?)')
      .run(id, req.session.userId, text, req.file.originalname, req.file.mimetype === 'application/pdf' ? req.file.buffer : null);

    res.json({ id, content: text, filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في قراءة الملف: ' + err.message });
  }
});

// POST save text CV
router.post('/text', requireAuth, (req, res) => {
  const { content, name } = req.body;
  if (!content) return res.status(400).json({ error: 'المحتوى فارغ' });

  const id = uuidv4();
  db.prepare('DELETE FROM cv_profiles WHERE user_id = ?').run(req.session.userId);
  db.prepare('INSERT INTO cv_profiles (id, user_id, content, filename) VALUES (?,?,?,?)')
    .run(id, req.session.userId, content, name || 'manual');

  res.json({ id, content });
});

// GET / POST template
router.get('/template', requireAuth, (req, res) => {
  const tpl = db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.session.userId);
  res.json(tpl || { subject_template: 'طلب انضمام — {your_name}', instructions: '' });
});

router.post('/template', requireAuth, (req, res) => {
  const { subject_template, instructions } = req.body;
  db.prepare('DELETE FROM templates WHERE user_id = ?').run(req.session.userId);
  const id = uuidv4();
  db.prepare('INSERT INTO templates (id, user_id, subject_template, instructions) VALUES (?,?,?,?)')
    .run(id, req.session.userId, subject_template || '', instructions || '');
  res.json({ ok: true });
});

module.exports = router;
