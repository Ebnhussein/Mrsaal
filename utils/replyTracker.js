'use strict';
const {google}=require('googleapis');
const {all,run}=require('./db');
const {buildAuthClient}=require('./gmail');
const {resolveAccount}=require('./gmail-accounts');
const active=new Map();
async function ensureReplySchema(){
 await run('ALTER TABLE email_log ADD COLUMN IF NOT EXISTS reply_checked_at BIGINT');
 await run('ALTER TABLE email_log ADD COLUMN IF NOT EXISTS reply_message_id TEXT');
 await run('ALTER TABLE email_log ADD COLUMN IF NOT EXISTS reply_received_at BIGINT');
}
function decodeEntities(text){return String(text).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,v)=>{
 if(v[0]==='#'){const n=v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
 return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[v.toLowerCase()];
});}
function cleanReply(text){
 text=decodeEntities(text).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\r\n?/g,'\n');
 // Stop at the conventional quotation separator, preserving the user's new paragraphs.
 const lines=text.split('\n'),out=[];
 for(const line of lines){
  if(/^\s*(?:On .{3,300}wrote:|في .{3,300}(?:كتب|تمت كتابة).*:|[-_]{3,}\s*(?:Original Message|Forwarded message)|From:.*@)/i.test(line))break;
  if(/^\s*>/.test(line))continue;
  out.push(line);
 }
 return out.join('\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,12000);
}
function htmlText(html){
 // Gmail replies usually put the prior message in a final blockquote/gmail_quote.
 html=html.replace(/<(?:blockquote)\b[\s\S]*$/i,'').replace(/<[^>]+class=["'][^"']*gmail_quote[^"']*["'][\s\S]*$/i,'');
 return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|li|tr|h[1-6])\s*>/gi,'\n').replace(/<[^>]*>/g,'');
}
async function extractReply(message,gmail){
 const parts=[];
 function visit(part){if(!part||part.filename)return;parts.push(part);for(const child of part.parts||[])visit(child);}
 visit(message.payload);
 const chosen=parts.find(p=>p.mimeType==='text/plain'&&(p.body?.data||p.body?.attachmentId))||parts.find(p=>p.mimeType==='text/html'&&(p.body?.data||p.body?.attachmentId));
 if(!chosen)return cleanReply(message.snippet||'رد جديد وصل');
 let data=chosen.body.data;
 if(!data){const r=await gmail.users.messages.attachments.get({userId:'me',messageId:message.id,id:chosen.body.attachmentId});data=r.data.data;}
 const text=Buffer.from(data||'','base64url').toString('utf8');
 return cleanReply(chosen.mimeType==='text/html'?htmlText(text):text)||'وصل رد بدون نص قابل للعرض';
}
async function performSync(userId){
 const params=userId?[userId]:[];const deadline=Date.now()+(userId?20000:50000);
 // Check each thread no more than every 30 seconds, including threads already replied to.
 const logs=await all(`SELECT * FROM email_log WHERE thread_id IS NOT NULL AND channel='email' AND status='sent'
 AND sent_at >= EXTRACT(EPOCH FROM NOW())-2592000
 AND (reply_checked_at IS NULL OR reply_checked_at < EXTRACT(EPOCH FROM NOW())-30)
 ${userId?'AND user_id=$1':''} ORDER BY reply_checked_at ASC NULLS FIRST LIMIT ${userId?12:60}`,params);
 const clients=new Map();let checked=0,updated=0,failed=0,index=0;
 async function worker(){while(index<logs.length&&Date.now()<deadline){const log=logs[index++];try{
  const key=log.user_id+':'+log.sender_account_id;
  if(!clients.has(key))clients.set(key,resolveAccount(log.user_id,log.sender_account_id).then(account=>({account,gmail:google.gmail({version:'v1',auth:buildAuthClient(account)})})));
  const {gmail,account}=await clients.get(key);
  const result=await gmail.users.threads.get({userId:'me',id:log.thread_id,format:'full'},{timeout:12000});
  const replies=(result.data.messages||[]).filter(m=>m.id!==log.message_id&&!m.labelIds?.includes('SENT')&&Number(m.internalDate)>=Number(log.sent_at)*1000).filter(m=>{
   const from=m.payload?.headers?.find(h=>h.name.toLowerCase()==='from')?.value||'';
   const addresses=from.match(/[^\s<>"(),;]+@[^\s<>"(),;]+/g)||[];
   return !addresses.some(x=>x.toLowerCase()===account.email.toLowerCase());
  }).sort((a,b)=>Number(a.internalDate)-Number(b.internalDate));
  const latest=replies.at(-1);
  if(latest&&latest.id!==log.reply_message_id){
   const text=await extractReply(latest,gmail);
   await run('UPDATE email_log SET replied=1,reply_text=$1,reply_message_id=$2,reply_received_at=$3 WHERE id=$4 AND user_id=$5',[text,latest.id,Math.floor(Number(latest.internalDate)/1000),log.id,log.user_id]);updated++;
  }
  checked++;
 }catch(error){failed++;console.warn('Reply sync failed for account:',error.code||error.status||0);}
 finally{await run('UPDATE email_log SET reply_checked_at=EXTRACT(EPOCH FROM NOW()) WHERE id=$1 AND user_id=$2',[log.id,log.user_id]).catch(()=>{});}
 }}
 await Promise.all([worker(),worker()]);return {checked,updated,failed};
}
function syncReplies(userId=null){
 const key=userId||'*';if(active.has(key))return active.get(key);
 const promise=performSync(userId).finally(()=>active.delete(key));active.set(key,promise);return promise;
}
module.exports={syncReplies,ensureReplySchema,cleanReply,extractReply,htmlText};
