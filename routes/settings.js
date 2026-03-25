const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAuth } = require('../utils/auth');

// GET settings
router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT gemini_key FROM users WHERE id = ?').get(req.session.userId);
  res.json(user || {});
});

// POST settings (save key)
router.post('/', requireAuth, (req, res) => {
  const { gemini_key } = req.body;
  db.prepare('UPDATE users SET gemini_key = ? WHERE id = ?').run(gemini_key || null, req.session.userId);
  res.json({ ok: true });
});

module.exports = router;
