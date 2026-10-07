const express = require('express');
const router = express.Router();
const { run } = require('../utils/db');

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

router.get('/open/:logId.gif', async (req, res) => {
  await run(
    `UPDATE email_log SET open_count = COALESCE(open_count,0) + 1, last_opened_at = EXTRACT(EPOCH FROM NOW()) WHERE id = $1 AND channel='email' AND status='sent'`,
    [req.params.logId]
  ).catch(() => {});
  res.set({ 'Content-Type': 'image/gif', 'Content-Length': PIXEL.length, 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control':'no-store', 'X-Robots-Tag':'noindex' });
  res.send(PIXEL);
});

module.exports = router;
