// routes/whatsapp.js — WhatsApp status & QR endpoint
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getWhatsAppStatus, getQR, logoutWhatsApp } = require('../utils/whatsapp');

// GET status + QR
router.get('/status', requireAuth, (req, res) => {
  const { status, hasQR } = getWhatsAppStatus();
  const qr = hasQR ? getQR() : null;
  res.json({ status, qr }); // qr is base64 data URL or null
});

// POST logout / disconnect
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await logoutWhatsApp();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
