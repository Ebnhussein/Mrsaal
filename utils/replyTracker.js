'use strict';
const {google}=require('googleapis');const {all,run}=require('./db');const {buildAuthClient}=require('./gmail');const {resolveAccount}=require('./gmail-accounts');
async function syncReplies(){
 const logs=await all("SELECT * FROM email_log WHERE thread_id IS NOT NULL AND replied=0 AND channel='email' AND status='sent'");
 const clients=new Map();
 for(const log of logs){try{
  const key=log.user_id+':'+log.sender_account_id;
  if(!clients.has(key)){const account=await resolveAccount(log.user_id,log.sender_account_id);clients.set(key,{gmail:google.gmail({version:'v1',auth:buildAuthClient(account)}),account});}
  const {gmail,account}=clients.get(key);const data=await gmail.users.threads.get({userId:'me',id:log.thread_id});
  const replies=(data.data.messages||[]).filter(m=>m.id!==log.message_id&&!m.labelIds?.includes('SENT')&&Number(m.internalDate)>=Number(log.sent_at)*1000).filter(m=>{const from=m.payload?.headers?.find(h=>h.name.toLowerCase()==='from')?.value||'';return !from.toLowerCase().includes(account.email.toLowerCase());});
  if(replies.length)await run('UPDATE email_log SET replied=1,reply_text=$1 WHERE id=$2 AND user_id=$3',[replies.at(-1).snippet||'رد جديد وصل',log.id,log.user_id]);
 }catch(e){console.warn('Reply sync failed for account:',e.code||e.status||0);}}
}
module.exports={syncReplies};
