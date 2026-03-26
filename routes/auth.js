// routes/auth.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getAuthUrl, getTokensFromCode, getUserInfo } = require('../utils/gmail');
const { get, run } = require('../utils/db');

router.get('/google', (req, res) => {
  res.redirect(getAuthUrl());
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect('/?error=auth_denied');
  if (!code)  return res.redirect('/?error=no_code');

  try {
    const tokens   = await getTokensFromCode(code);
    const userInfo = await getUserInfo(tokens.access_token);

    let user = await get('SELECT * FROM users WHERE google_id = $1', [userInfo.id]);

    if (!user) {
      const id = uuidv4();
      await run(
        `INSERT INTO users (id, google_id, email, name, access_token, refresh_token, token_expiry)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, userInfo.id, userInfo.email, userInfo.name,
         tokens.access_token, tokens.refresh_token, tokens.expiry_date]
      );
      user = await get('SELECT * FROM users WHERE id = $1', [id]);
    } else {
      await run(
        `UPDATE users
         SET access_token=$1, refresh_token=COALESCE($2, refresh_token),
             token_expiry=$3, email=$4, name=$5
         WHERE google_id=$6`,
        [tokens.access_token, tokens.refresh_token,
         tokens.expiry_date, userInfo.email, userInfo.name, userInfo.id]
      );
      user = await get('SELECT * FROM users WHERE google_id = $1', [userInfo.id]);
    }

    req.session.userId = user.id;
    req.session.save(() => res.redirect('/'));
  } catch (err) {
    console.error('Auth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/status', async (req, res) => {
  if (!req.session?.userId) return res.json({ loggedIn: false });
  const user = await get('SELECT id, email, name FROM users WHERE id = $1', [req.session.userId]);
  if (!user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, email: user.email, name: user.name });
});

module.exports = router;
