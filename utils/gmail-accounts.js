'use strict';
const {get,run}=require('./db');
const {seal,unseal}=require('./connection-secrets');
const {randomUUID}=require('crypto');
async function saveAccount(userId,info,tokens){
 const existing=await get('SELECT * FROM gmail_accounts WHERE user_id=$1 AND google_id=$2',[userId,info.id]);
 const previous=existing?.credentials?unseal(existing.credentials):{};
 const merged={...previous,...tokens,refresh_token:tokens.refresh_token||previous.refresh_token};
 if(!merged.refresh_token)throw new Error('أعد ربط حساب Google ووافق على الصلاحيات للحصول على اتصال مستمر.');
 const row=await get(`INSERT INTO gmail_accounts(id,user_id,google_id,email,name,credentials,connected) VALUES($1,$2,$3,$4,$5,$6,true) ON CONFLICT(user_id,google_id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,credentials=EXCLUDED.credentials,connected=true RETURNING id`,[existing?.id||randomUUID(),userId,info.id,info.email,info.name,seal(merged)]);
 await run('UPDATE users SET active_gmail_id=COALESCE(active_gmail_id,$1) WHERE id=$2',[row.id,userId]);return row.id;
}
async function resolveAccount(userId,id=null){
 const user=await get('SELECT google_id,active_gmail_id FROM users WHERE id=$1',[userId]);
 if(!user)throw new Error('الحساب غير موجود');
 const selected=id||user.active_gmail_id;
 const row=selected?await get('SELECT * FROM gmail_accounts WHERE id=$1 AND user_id=$2 AND connected=true',[selected,userId]):await get('SELECT * FROM gmail_accounts WHERE user_id=$1 AND google_id=$2 AND connected=true',[userId,user.google_id]);
 if(!row?.credentials)throw new Error('اختار أو أعد ربط حساب Gmail من قنوات التواصل.');
 return {...row,...unseal(row.credentials),gmail_account_id:row.id};
}
async function persistTokens(account,tokens){
 const row=await get('SELECT credentials FROM gmail_accounts WHERE id=$1 AND user_id=$2 AND connected=true',[account.gmail_account_id,account.user_id]);
 if(row)await run('UPDATE gmail_accounts SET credentials=$1 WHERE id=$2 AND user_id=$3',[seal({...unseal(row.credentials),...tokens}),account.gmail_account_id,account.user_id]);
}
module.exports={saveAccount,resolveAccount,persistTokens};
