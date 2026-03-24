// routes/auth.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getAuthUrl, getTokensFromCode, getUserInfo } = require('../utils/gmail');
const db = require('../utils/db');

// Redirect to Google OAuth
router.get('/google', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) return res.redirect('/?error=auth_denied');
  if (!code) return res.redirect('/?error=no_code');

  try {
    const tokens = await getTokensFromCode(code);
    const userInfo = await getUserInfo(tokens.access_token);

    // Upsert user
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(userInfo.id);

    if (!user) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO users (id, google_id, email, name, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, userInfo.id, userInfo.email, userInfo.name,
        tokens.access_token, tokens.refresh_token, tokens.expiry_date);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else {
      db.prepare(`
        UPDATE users SET access_token=?, refresh_token=?, token_expiry=?, email=?, name=?
        WHERE google_id=?
      `).run(tokens.access_token, tokens.refresh_token || user.refresh_token,
        tokens.expiry_date, userInfo.email, userInfo.name, userInfo.id);
      user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(userInfo.id);
    }

    req.session.userId = user.id;
    req.session.save(() => res.redirect('/'));
  } catch (err) {
    console.error('Auth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Status
router.get('/status', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, email: user.email, name: user.name });
});

module.exports = router;
