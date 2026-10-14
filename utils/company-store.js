'use strict';
const {pool}=require('./db');const {randomUUID}=require('crypto');const {limits,exceeded}=require('./resource-limits');
async function add(userId,rows){const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!user)exceeded('الحساب غير موجود.');
 const cap=limits(user).companies;let count=Number((await client.query('SELECT COUNT(*) AS n FROM companies WHERE user_id=$1',[userId])).rows[0].n);let added=0,skipped=0;const ids=[];
 for(const row of rows){const key=row.email?'email':'phone',value=row[key];if(value&&(await client.query('SELECT id FROM companies WHERE user_id=$1 AND '+key+'=$2 LIMIT 1',[userId,value])).rows.length){skipped++;continue;}
 if(count>=cap)exceeded('وصلت للحد المتاح للشركات ('+cap+'). احذف شركات قديمة أو تواصل مع الدعم. لم يُحفظ هذا الاستيراد.');
 const id=randomUUID();await client.query('INSERT INTO companies(id,user_id,name,email,phone,field,location) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,userId,row.name,row.email||'',row.phone||'',row.field||'',row.location||'']);ids.push(id);count++;added++;}
 await client.query('COMMIT');return {added,skipped,ids};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
module.exports={add};
