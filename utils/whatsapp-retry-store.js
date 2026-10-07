'use strict';
const {run,get}=require('./db');
const {seal,unseal}=require('./connection-secrets');
let cleanupAt=0;
async function ensureRetrySchema(){await run(`CREATE TABLE IF NOT EXISTS whatsapp_sent_messages(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,message_id TEXT NOT NULL,payload TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(user_id,message_id));CREATE INDEX IF NOT EXISTS whatsapp_sent_messages_age ON whatsapp_sent_messages(created_at)`);}
async function saveMessage(userId,message,proto){
 if(!message?.key?.id||!message.message)throw new Error('تعذر تجهيز رسالة واتساب لإعادة المحاولة');
 const bytes=Buffer.from(proto.Message.encode(message.message).finish()).toString('base64');
 await run('INSERT INTO whatsapp_sent_messages(user_id,message_id,payload) VALUES($1,$2,$3) ON CONFLICT(user_id,message_id) DO UPDATE SET payload=EXCLUDED.payload',[userId,message.key.id,seal({bytes})]);
 if(Date.now()>cleanupAt){cleanupAt=Date.now()+3600000;await run("DELETE FROM whatsapp_sent_messages WHERE created_at < NOW()-INTERVAL '7 days'").catch(()=>{});}
 await run('DELETE FROM whatsapp_sent_messages WHERE user_id=$1 AND message_id NOT IN (SELECT message_id FROM whatsapp_sent_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 2000)',[userId]);
}
async function getMessage(userId,key,proto){
 if(!key?.id)return undefined;
 const row=await get("SELECT payload FROM whatsapp_sent_messages WHERE user_id=$1 AND message_id=$2 AND created_at>NOW()-INTERVAL '7 days'",[userId,key.id]);
 if(!row)return undefined;return proto.Message.decode(Buffer.from(unseal(row.payload).bytes,'base64'));
}
function deviceCache(){const rows=new Map();return {get:key=>{const value=rows.get(key);if(!value||Date.now()>value.until){rows.delete(key);return undefined;}return value.value;},set:(key,value)=>{if(rows.size>500)rows.clear();rows.set(key,{value,until:Date.now()+30000});},del:key=>rows.delete(key),flushAll:()=>rows.clear()};}
module.exports={ensureRetrySchema,saveMessage,getMessage,deviceCache};
