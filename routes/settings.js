const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAuth } = require('../middleware/auth');

// GET settings
router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT gemini_key, gemini_model FROM users WHERE id = ?').get(req.session.userId);
  res.json(user || { gemini_model: 'gemini-1.5-flash' });
});

// POST settings (save key & model)
router.post('/', requireAuth, (req, res) => {
  const { gemini_key, gemini_model } = req.body;
  db.prepare('UPDATE users SET gemini_key = ?, gemini_model = ? WHERE id = ?')
    .run(gemini_key || null, gemini_model || 'gemini-1.5-flash', req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
