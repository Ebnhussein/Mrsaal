'use strict';
const {get,run,pool}=require('../db');
const {seal,unseal}=require('../connection-secrets');
const {randomUUID}=require('crypto');
async function saveAccount(userId,info,tokens){
 const granted=String(tokens.scope||'').split(/\s+/);if(!granted.includes('https://www.googleapis.com/auth/gmail.send'))throw new Error('وافق على صلاحية الإرسال قبل ربط Gmail.');
 const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!user)throw new Error('الحساب غير موجود');
 const existing=(await client.query('SELECT * FROM gmail_accounts WHERE user_id=$1 AND google_id=$2',[userId,info.id])).rows[0];
 if(!existing?.connected){const count=Number((await client.query('SELECT COUNT(*) AS n FROM gmail_accounts WHERE user_id=$1 AND connected=true',[userId])).rows[0].n);const cap=require('../resource-limits').limits(user).gmail;if(count>=cap)require('../resource-limits').exceeded('وصلت لحد حسابات Gmail المتصلة ('+cap+'). افصل حسابًا قديمًا أولًا.');}
 const previous=existing?.credentials?unseal(existing.credentials):{};const merged={...previous,...tokens,refresh_token:tokens.refresh_token||previous.refresh_token};if(!merged.refresh_token)throw new Error('أعد ربط Google ووافق على الصلاحيات للحصول على اتصال مستمر.');
 const row=(await client.query(`INSERT INTO gmail_accounts(id,user_id,google_id,email,name,credentials,connected) VALUES($1,$2,$3,$4,$5,$6,true) ON CONFLICT(user_id,google_id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,credentials=EXCLUDED.credentials,connected=true RETURNING id`,[existing?.id||randomUUID(),userId,info.id,info.email,info.name,seal(merged)])).rows[0];
 await client.query('UPDATE users SET active_gmail_id=COALESCE(active_gmail_id,$1) WHERE id=$2',[row.id,userId]);await client.query('COMMIT');return row.id;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function resolveAccount(userId,id=null){
 const user=await get('SELECT google_id,active_gmail_id FROM users WHERE id=$1',[userId]);
 if(!user)throw new Error('الحساب غير موجود');
 const selected=id||user.active_gmail_id;
 const row=selected?await get('SELECT * FROM gmail_accounts WHERE id=$1 AND user_id=$2 AND connected=true',[selected,userId]):await get('SELECT * FROM gmail_accounts WHERE user_id=$1 AND google_id=$2 AND connected=true',[userId,user.google_id]);
 if(!row?.credentials)throw Object.assign(new Error('اختار أو أعد ربط حساب Gmail من قنوات التواصل.'),{status:409,code:'GMAIL_ACCOUNT_REQUIRED'});
 return {...row,...unseal(row.credentials),gmail_account_id:row.id};
}
async function persistTokens(account,tokens){
 const row=await get('SELECT credentials FROM gmail_accounts WHERE id=$1 AND user_id=$2 AND connected=true',[account.gmail_account_id,account.user_id]);
 if(row)await run('UPDATE gmail_accounts SET credentials=$1 WHERE id=$2 AND user_id=$3',[seal({...unseal(row.credentials),...tokens}),account.gmail_account_id,account.user_id]);
}
// Reply tracking needs gmail.readonly, which is optional; legacy accounts linked with both scopes keep working.
// Rows without a stored scope predate the optional scope, when both were required.
function canReadReplies(account){return !account?.scope||String(account.scope).split(/\s+/).includes('https://www.googleapis.com/auth/gmail.readonly');}
module.exports={saveAccount,resolveAccount,persistTokens,canReadReplies};
