// routes/tracking.js — Open tracking pixel (1x1 GIF)
const express = require('express');
const router = express.Router();
const db = require('../utils/db');

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

router.get('/open/:logId.gif', (req, res) => {
  const { logId } = req.params;

  // Update open count
  db.prepare(`
    UPDATE email_log
    SET open_count = open_count + 1,
        last_opened_at = unixepoch()
    WHERE id = ?
  `).run(logId);

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache'
  });
  res.send(PIXEL);
});

module.exports = router;
