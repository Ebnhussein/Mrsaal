const express = require('express');
const router = express.Router();
const { run } = require('../utils/db');

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

router.get('/open/:logId.gif', async (req, res) => {
  await run(
    `UPDATE email_log SET open_count = open_count + 1, last_opened_at = EXTRACT(EPOCH FROM NOW()) WHERE id = $1`,
    [req.params.logId]
  ).catch(() => {});
  res.set({ 'Content-Type': 'image/gif', 'Content-Length': PIXEL.length, 'Cache-Control': 'no-store' });
  res.send(PIXEL);
});

module.exports = router;
