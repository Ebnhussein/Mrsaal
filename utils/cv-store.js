'use strict';
const {pool,get}=require('./db');const {randomUUID}=require('crypto');
async function active(userId,cvId=null){return get(`SELECT * FROM cv_profiles WHERE user_id=$1 ${cvId?'AND id=$2':''} ORDER BY (id=COALESCE((SELECT active_cv_id FROM users WHERE id=$1),'')) DESC,created_at DESC,id DESC LIMIT 1`,cvId?[userId,cvId]:[userId]);}
async function save(userId,values,preservePDF=false){const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
 const count=(await client.query('SELECT COUNT(*) AS count FROM cv_profiles WHERE user_id=$1',[userId])).rows[0];if(Number(count.count)>=10){const e=new Error('عندك 10 نسخ سيرة. احذف نسخة قديمة قبل إضافة نسخة جديدة.');e.status=409;throw e;}
 const old=preservePDF?(await client.query('SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY (id=COALESCE((SELECT active_cv_id FROM users WHERE id=$1),\'\')) DESC,created_at DESC LIMIT 1',[userId])).rows[0]:null;
 const id=randomUUID();await client.query('INSERT INTO cv_profiles(id,user_id,content,filename,pdf_data,name) VALUES($1,$2,$3,$4,$5,$6)',[id,userId,values.content,old?.pdf_data?old.filename:values.filename,old?.pdf_data||values.pdf_data||null,values.name||values.filename||'CV']);await client.query('UPDATE users SET active_cv_id=$1 WHERE id=$2',[id,userId]);await client.query('COMMIT');return id;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
module.exports={active,save};
