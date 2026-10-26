'use strict';
const {pool}=require('../db');
const keys=['name','email','phone','field','location'];
function fail(code,status=400,field){return Object.assign(new Error(code),{code,status,field});}
function validate(input){
 const result={};
 for(const key of keys){if(typeof input?.[key]!=='string'||input[key].length>(key==='email'?254:key==='phone'?40:200))throw fail('COMPANY_DETAILS_INVALID',400,key);result[key]=input[key].trim();}
 if(!result.name)throw fail('COMPANY_NAME_REQUIRED',400,'name');
 result.email=result.email.toLowerCase();
 if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw fail('COMPANY_EMAIL_INVALID',400,'email');
 if(result.phone){
  if(!/^[+\d\s().-]+$/.test(result.phone))throw fail('WA_RECIPIENT_FORMAT',400,'phone');
  const phone=result.phone.replace(/\D/g,'').replace(/^00/,'');
  if(!/^[1-9]\d{7,14}$/.test(phone))throw fail('WA_RECIPIENT_FORMAT',400,'phone');result.phone=phone;
 }
 if(!result.email&&!result.phone)throw fail('COMPANY_CONTACT_REQUIRED',400,'email');
 return result;
}
async function update(userId,id,input,expected){
 const values=validate(input);const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const owner=(await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!owner)throw fail('COMPANY_NOT_FOUND',404);
  const company=(await c.query('SELECT * FROM companies WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])).rows[0];if(!company)throw fail('COMPANY_NOT_FOUND',404);
  if(expected&&keys.some(key=>typeof expected[key]!=='string'||expected[key]!==String(company[key]||'')))throw fail('COMPANY_DETAILS_CHANGED',409);
  const busy=(await c.query(`SELECT id FROM email_log WHERE user_id=$1 AND company_id=$2 AND status IN ('processing','uncertain')
   UNION SELECT id FROM scheduled_jobs WHERE user_id=$1 AND company_id=$2 AND status IN ('pending','processing','uncertain')
   UNION SELECT i.id FROM campaign_items i JOIN campaigns a ON a.id=i.campaign_id WHERE a.user_id=$1 AND i.company_id=$2 AND (i.status IN ('processing','uncertain','generating') OR (a.status='running' AND i.status='ready')) LIMIT 1`,[userId,id])).rows[0];
  if(busy)throw fail('COMPANY_EDIT_BUSY',409);
  const row=(await c.query('UPDATE companies SET name=$1,email=$2,phone=$3,field=$4,location=$5 WHERE id=$6 AND user_id=$7 RETURNING *',[...keys.map(key=>values[key]),id,userId])).rows[0];
  await c.query('COMMIT');return row;
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
module.exports={update,validate};
