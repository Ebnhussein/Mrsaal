// routes/companies.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const db = require('../utils/db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET all companies
router.get('/', requireAuth, (req, res) => {
  const companies = db.prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  res.json(companies);
});

// POST add single company
router.post('/', requireAuth, (req, res) => {
  const { name, email, phone, field, location } = req.body;
  if (!name) return res.status(400).json({ error: 'اسم الشركة مطلوب' });
  if (!email && !phone) return res.status(400).json({ error: 'الإيميل أو رقم الموبايل مطلوب' });

  const id = uuidv4();
  db.prepare(`INSERT INTO companies (id, user_id, name, email, phone, field, location) VALUES (?,?,?,?,?,?,?)`)
    .run(id, req.session.userId, name.trim(), (email || '').trim().toLowerCase(), (phone || '').trim(), (field || '').trim(), (location || '').trim());
  res.json({ ok: true, id });
});

// POST upload Excel
router.post('/import', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لا يوجد ملف' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) return res.status(400).json({ error: 'الملف فارغ' });

    const headers = rows[0].map((h, i) => ({ index: i, name: String(h || `عمود ${i+1}`) }));
    const preview = rows.slice(1, 6).map(r => r.map(v => String(v ?? '')));

    res.json({ headers, preview, totalRows: rows.length - 1 });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في قراءة الملف: ' + err.message });
  }
});

// POST commit import with column mapping
router.post('/import/commit', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لا يوجد ملف' });

  const { nameCol, emailCol, phoneCol, fieldCol, locationCol } = req.body;
  const ni = parseInt(nameCol);
  const ei = emailCol !== '' && emailCol !== undefined ? parseInt(emailCol) : -1;
  const pi = phoneCol !== '' && phoneCol !== undefined ? parseInt(phoneCol) : -1;
  const fi = fieldCol !== '' && fieldCol !== undefined ? parseInt(fieldCol) : -1;
  const li = locationCol !== '' && locationCol !== undefined ? parseInt(locationCol) : -1;

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let added = 0, skipped = 0;
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO companies (id, user_id, name, email, phone, field, location)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((dataRows) => {
      for (const row of dataRows) {
        const name = String(row[ni] || '').trim();
        const email = ei >= 0 ? String(row[ei] || '').trim().toLowerCase() : '';
        const phone = pi >= 0 ? String(row[pi] || '').trim().replace(/\s/g, '') : '';

        if (!name) { skipped++; continue; }
        if (!email && !phone) { skipped++; continue; }
        if (email && !email.includes('@')) { skipped++; continue; }

        // Check duplicate by email or phone
        if (email) {
          const exists = db.prepare('SELECT id FROM companies WHERE user_id=? AND email=?').get(req.session.userId, email);
          if (exists) { skipped++; continue; }
        } else if (phone) {
          const exists = db.prepare('SELECT id FROM companies WHERE user_id=? AND phone=?').get(req.session.userId, phone);
          if (exists) { skipped++; continue; }
        }

        insertStmt.run(
          uuidv4(), req.session.userId, name, email,
          phone,
          fi >= 0 ? String(row[fi] || '') : '',
          li >= 0 ? String(row[li] || '') : ''
        );
        added++;
      }
    });

    insertMany(rows.slice(1).filter(r => r.some(c => c)));
    res.json({ added, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update company
router.patch('/:id', requireAuth, (req, res) => {
  const { status, selected, scheduled_at } = req.body;
  const fields = [];
  const vals = [];

  if (status !== undefined) { fields.push('status=?'); vals.push(status); }
  if (selected !== undefined) { fields.push('selected=?'); vals.push(selected ? 1 : 0); }
  if (scheduled_at !== undefined) { fields.push('scheduled_at=?'); vals.push(scheduled_at); }

  if (!fields.length) return res.json({ ok: true });

  vals.push(req.params.id, req.session.userId);
  db.prepare(`UPDATE companies SET ${fields.join(',')} WHERE id=? AND user_id=?`).run(...vals);
  res.json({ ok: true });
});

// PATCH bulk update
router.patch('/', requireAuth, (req, res) => {
  const { ids, selected } = req.body;
  if (!ids || !ids.length) return res.json({ ok: true });

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE companies SET selected=? WHERE id IN (${placeholders}) AND user_id=?`)
    .run(selected ? 1 : 0, ...ids, req.session.userId);
  res.json({ ok: true });
});

// DELETE companies
router.delete('/', requireAuth, (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.json({ ok: true });

  const placeholders = ids.map(() => '?').join(',');
  const info = db.prepare(`DELETE FROM companies WHERE id IN (${placeholders}) AND user_id=?`).run(...ids, req.session.userId);
  res.json({ deleted: info.changes });
});

module.exports = router;
