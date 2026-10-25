'use strict';
const {createHash}=require('crypto');
const db=require('../db'),provider=require('./openwa-client'),{buildWhatsAppContent}=require('./content');
let schema;
async function ensureSchema(){return schema ||= db.run(`CREATE TABLE IF NOT EXISTS openwa_trial_attempts(
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',message_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,request_key));
 CREATE INDEX IF NOT EXISTS openwa_trial_owner_time ON openwa_trial_attempts(user_id,created_at);`).catch(e=>{schema=null;throw e;});}
function enabledFor(email,env=process.env){return env.OPENWA_TRIAL_ENABLED==='true'&&!!email&&String(email).toLowerCase()===String(env.OPENWA_TRIAL_EMAIL||'').trim().toLowerCase();}
function client(){return provider.createClient(provider.config());}
async function send(userId,{key,body,includeCV,acknowledge}){
 if(acknowledge!==true||typeof body!=='string'||!body.trim()||body.length>1000||typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key)||typeof includeCV!=='boolean')throw provider.fail('OPENWA_INPUT',400);
 const settings=provider.config();let attachment=null;
 if(includeCV){const cv=await require('../cv-store').active(userId);if(!cv?.pdf_data)throw provider.fail('OPENWA_CV',400);if(cv.pdf_data.length>10*1024*1024)throw provider.fail('OPENWA_PDF_LIMIT',400);const content=buildWhatsAppContent(body,{data:cv.pdf_data,filename:cv.filename,mimeType:'application/pdf'});attachment={data:content.document,fileName:content.fileName};}
 const formatted=buildWhatsAppContent(body).text;
 const hash=createHash('sha256').update(JSON.stringify([settings.session,settings.recipient,formatted,attachment?.fileName||null])).update(attachment?.data||'').digest('hex');
 await ensureSchema();const connection=await db.pool.connect();let previous;
 try{
  await connection.query('BEGIN');await connection.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  previous=(await connection.query('SELECT * FROM openwa_trial_attempts WHERE user_id=$1 AND request_key=$2',[userId,key])).rows[0];
  if(previous){if(previous.payload_hash!==hash)throw provider.fail('OPENWA_KEY_REUSED',409);await connection.query('COMMIT');return {status:previous.status,messageId:previous.message_id,replayed:true};}
  const count=Number((await connection.query("SELECT COUNT(*) AS count FROM openwa_trial_attempts WHERE user_id=$1 AND created_at>=NOW()-INTERVAL '24 hours'",[userId])).rows[0].count);
  if(count>=5)throw provider.fail('OPENWA_TRIAL_LIMIT',429);
  await connection.query('INSERT INTO openwa_trial_attempts(user_id,request_key,payload_hash) VALUES($1,$2,$3)',[userId,key,hash]);await connection.query('COMMIT');
 }catch(e){await connection.query('ROLLBACK');throw e;}finally{connection.release();}
 // One attempt only. A timeout or engine error cannot prove that nothing was delivered.
 try{const sent=await provider.createClient(settings).send({body:formatted,attachment,key:'mrsaal-trial-'+userId+'-'+key});await db.run("UPDATE openwa_trial_attempts SET status='accepted',message_id=$3 WHERE user_id=$1 AND request_key=$2",[userId,key,sent.messageId]);return {status:'accepted',messageId:sent.messageId};}
 catch(e){await db.run("UPDATE openwa_trial_attempts SET status='uncertain' WHERE user_id=$1 AND request_key=$2",[userId,key]).catch(()=>{});const error=provider.fail('OPENWA_SEND_UNCERTAIN');error.deliveryUncertain=true;throw error;}
}
module.exports={enabledFor,client,send};
