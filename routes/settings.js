const express = require('express');
const router = express.Router();
const { get, run } = require('../utils/db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const user = await get(
    'SELECT gemini_key, gemini_model FROM users WHERE id=$1',
    [req.session.userId]
  );
  res.json(user || { gemini_model: 'gemini-1.5-flash' });
});

router.post('/', requireAuth, async (req, res) => {
  const { gemini_key, gemini_model } = req.body;
  await run(
    'UPDATE users SET gemini_key=$1, gemini_model=$2 WHERE id=$3',
    [gemini_key || null, gemini_model || 'gemini-1.5-flash', req.session.userId]
  );
  res.json({ ok: true });
});

module.exports = router;
