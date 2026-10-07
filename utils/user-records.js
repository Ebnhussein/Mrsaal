'use strict';
const { randomUUID } = require('crypto');
const { pool } = require('./db');
const columns = {
  templates: ['subject_template', 'instructions'],
  cv_profiles: ['content', 'filename', 'pdf_data']
};
// Replaces a user's current record atomically; a failed insert retains the old record.
async function replaceLatest(table, userId, values, options = {}) {
  if (!columns[table]) throw new Error('Unsupported user record');
  const fields = columns[table];
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!user.rowCount) {
      const error = new Error('انتهت جلسة الحساب. سجّل دخولك من جديد.');
      error.status = 401;
      throw error;
    }
    if (table === 'cv_profiles' && options.preservePDF) {
      const previous = await client.query('SELECT filename,pdf_data FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [userId]);
      if (previous.rows[0]?.pdf_data) values = {...values, filename:previous.rows[0].filename, pdf_data:previous.rows[0].pdf_data};
    }
    await client.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId]);
    await client.query(
      `INSERT INTO ${table} (id,user_id,${fields.join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+3)).reduce((s,p)=>s+','+p,'$1,$2')})`,
      [id, userId, ...fields.map(key => values[key] ?? null)]
    );
    await client.query('COMMIT');
    return id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { replaceLatest };
