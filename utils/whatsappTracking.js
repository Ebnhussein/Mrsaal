const {get,run}=require('./db');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ensureTrackingSchema(){
  await run(`ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_delivered_at BIGINT;
    ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_read_at BIGINT;
    ALTER TABLE email_log ADD COLUMN IF NOT EXISTS whatsapp_reply_at BIGINT;`);
}
function seconds(value){const n=Number(value);return Number.isFinite(n)&&n>0?Math.floor(n):Math.floor(Date.now()/1000);}
async function receipt(userId,key,{read=false,time=null}={}){
  if(!key?.id || key.fromMe===false)return;
  const at=seconds(time);
  for(let attempt=0;attempt<4;attempt++){
    const result=await run(`UPDATE email_log SET
      whatsapp_delivered_at=COALESCE(whatsapp_delivered_at,$3),
      whatsapp_read_at=CASE WHEN $4 THEN COALESCE(whatsapp_read_at,$3) ELSE whatsapp_read_at END,
      open_count=CASE WHEN $4 THEN GREATEST(open_count,1) ELSE open_count END,
      last_opened_at=CASE WHEN $4 THEN COALESCE(last_opened_at,$3) ELSE last_opened_at END
      WHERE user_id=$1 AND message_id=$2 AND channel='whatsapp' AND status='sent'`,[userId,key.id,at,read]);
    if(result.rowCount)return;
    // إشعار القراءة قد يصل قبل اكتمال INSERT لسجل الإرسال.
    if(attempt<3)await pause([150,600,1800][attempt]);
  }
}
function unwrap(message){
  for(let i=0;i<5;i++){
    const inner=message?.ephemeralMessage?.message||message?.viewOnceMessage?.message||message?.viewOnceMessageV2?.message||message?.documentWithCaptionMessage?.message;
    if(!inner)break;message=inner;
  }
  return message||{};
}
function senderJids(message){
  return [...new Set([message.key?.remoteJid,message.key?.remoteJidAlt,message.key?.senderPn,message.senderPn].filter(j=>typeof j==='string' && /@(s\.whatsapp\.net|lid)$/.test(j)))];
}
async function reply(userId,message){
  if(!message?.key?.id || message.key.fromMe)return;
  const jids=senderJids(message);if(!jids.length)return;
  const body=unwrap(message.message);
  if(body.protocolMessage || body.reactionMessage || body.senderKeyDistributionMessage)return;
  const content=body.extendedTextMessage||body.imageMessage||body.videoMessage||body.documentMessage||body.audioMessage||body.stickerMessage;
  const text=body.conversation||body.extendedTextMessage?.text||content?.caption||
    (body.audioMessage?'[رسالة صوتية]':body.imageMessage?'[صورة]':body.videoMessage?'[فيديو]':body.documentMessage?'[مستند]':body.stickerMessage?'[ملصق]':'');
  if(!text)return;
  const quote=content?.contextInfo?.stanzaId||null;
  const numbers=jids.filter(j=>j.endsWith('@s.whatsapp.net')).map(j=>j.split('@')[0].split(':')[0]);
  const at=Number(message.messageTimestamp);
  if(!Number.isFinite(at)||at<=0)return;
  // الرد المقتبس يربط بالرسالة نفسها. الرد العادي يربط بأحدث إرسال لنفس المحادثة قبل الرد.
  const log=await get(`SELECT id FROM email_log WHERE user_id=$1 AND channel='whatsapp'
    AND status='sent' AND sent_at <= $4
    AND (thread_id=ANY($2::text[]) OR regexp_replace(company_email,'[^0-9]','','g')=ANY($3::text[]))
    AND ($5::text IS NULL OR message_id=$5)
    ORDER BY sent_at DESC LIMIT 1`,[userId,jids,numbers,at,quote]);
  if(!log)return;
  await run(`UPDATE email_log SET replied=1,reply_text=$3,whatsapp_reply_at=$4
    WHERE id=$1 AND user_id=$2 AND (whatsapp_reply_at IS NULL OR whatsapp_reply_at <= $4)`,[log.id,userId,String(text).slice(0,10000),at]);
}
function attachTracking(sock,userId,entry){
  const active=()=>!entry.cancelled && entry.sock===sock;
  const handle=task=>task.catch(err=>console.error('WhatsApp tracking failed:',err.code||err.name));
  sock.ev.on('messages.update',updates=>{
    if(!active())return;
    handle((async()=>{
      for(const {key,update} of updates){
        const value=Number(update?.status);
        // WAMessageStatus: DELIVERY_ACK=3, READ=4, PLAYED=5.
        if(value>=3 && value<=5)await receipt(userId,key,{read:value>=4});
      }
    })());
  });
  sock.ev.on('message-receipt.update',updates=>{
    if(!active())return;
    handle((async()=>{
      for(const {key,receipt:data} of updates){
        if(data?.readTimestamp||data?.playedTimestamp)await receipt(userId,key,{read:true,time:data.readTimestamp||data.playedTimestamp});
        else if(data?.receiptTimestamp)await receipt(userId,key,{time:data.receiptTimestamp});
      }
    })());
  });
  sock.ev.on('messages.upsert',event=>{
    if(!active()||event.type!=='notify')return;
    handle((async()=>{for(const message of event.messages||[])await reply(userId,message);})());
  });
}
module.exports={ensureTrackingSchema,attachTracking,receipt,reply};
