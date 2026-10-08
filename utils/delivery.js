'use strict';
const {get,run}=require('./db');const {randomUUID,createHash}=require('crypto');
async function deliver(userId,{companyId,channel,subject='',body,senderAccountId=null,cvId=null,idempotencyKey,existingLogId=null}){
 if(!['email','whatsapp'].includes(channel)||typeof body!=='string'||!body.trim()||body.length>14000||typeof subject!=='string'||subject.length>240||/[\r\n]/.test(subject)){const e=new Error('راجع القناة ونص الرسالة والعنوان');e.status=400;throw e;}
 if(typeof idempotencyKey!=='string'||! /^[a-zA-Z0-9:_-]{8,160}$/.test(idempotencyKey)){const e=new Error('مفتاح الإرسال مطلوب. حدّث الصفحة قبل الإرسال.');e.status=400;throw e;}
 const company=await get('SELECT * FROM companies WHERE id=$1 AND user_id=$2',[companyId,userId]);if(!company){const e=new Error('الشركة غير موجودة');e.status=404;throw e;}
 const hash=createHash('sha256').update(JSON.stringify({companyId,channel,subject,body,senderAccountId,cvId})).digest('hex');
 const attempt=await get(`INSERT INTO delivery_attempts(id,user_id,request_key,payload_hash) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,request_key) DO NOTHING RETURNING id`,[randomUUID(),userId,idempotencyKey,hash]);
 if(!attempt){const old=await get('SELECT * FROM delivery_attempts WHERE user_id=$1 AND request_key=$2',[userId,idempotencyKey]);if(old.payload_hash!==hash){const e=new Error('تغيّر محتوى الطلب بنفس مفتاح الإرسال');e.status=409;throw e;}return old.result||{ok:false,status:old.status,error:'الإرسال قيد التنفيذ أو نتيجته غير مؤكدة. راجع التقارير قبل المحاولة.'};}
 const logId=existingLogId||randomUUID();let enteredProvider=false,delivered=false;
 try{
 const reason=require('./delivery-channel').skipReason(company,channel);
 if(reason){const result={ok:true,status:'skipped',skipped:true,channel,reason};await run('UPDATE delivery_attempts SET status=$1,result=$2 WHERE id=$3',['skipped',JSON.stringify(result),attempt.id]);return result;}
 await require('./access-control').checkToolAccess(userId);await require('./usage-limits').consume(userId,'send');
 const user=await get('SELECT * FROM users WHERE id=$1',[userId]);
 const account=channel==='email'?await require('./gmail-accounts').resolveAccount(userId,senderAccountId):null;
 const cv=await require('./cv-store').active(userId,cvId);if(cvId&&!cv)throw new Error('السيرة المحددة لم تعد متاحة');
 const attachment=cv?.pdf_data?{data:cv.pdf_data,filename:cv.filename||'CV.pdf',mimeType:'application/pdf'}:null;
 if(channel==='whatsapp')await require('./whatsapp').requireConnected(userId);
 const to=channel==='email'?company.email:company.phone;
 await run(`INSERT INTO email_log(id,user_id,company_id,company_name,company_email,subject,body,status,channel,sender_account_id,sender_email) VALUES($1,$2,$3,$4,$5,$6,$7,'processing',$8,$9,$10) ON CONFLICT(id) DO UPDATE SET status='processing',subject=EXCLUDED.subject,body=EXCLUDED.body`,[logId,userId,companyId,company.name,to,subject,body,channel,account?.gmail_account_id||null,account?.email||null]);
 await run('UPDATE delivery_attempts SET log_id=$1 WHERE id=$2',[logId,attempt.id]);
 enteredProvider=true;
 const sent=channel==='email'?await require('./gmail').sendEmail({user,account,to,subject,body,attachment,trackingPixelUrl:(process.env.BASE_URL||'https://mrsaal.ebnhussein.co').replace(/\/$/,'')+'/track/open/'+logId+'.gif'}):await require('./whatsapp').sendWhatsAppMessage(userId,to,body,attachment);
 delivered=true;
 await run("UPDATE email_log SET status='sent',message_id=$1,thread_id=$2 WHERE id=$3 AND user_id=$4",[sent.messageId,sent.threadId,logId,userId]);
 await run("UPDATE companies SET status='sent' WHERE id=$1 AND user_id=$2",[companyId,userId]);
 const result={ok:true,status:'sent',channel,logId,messageId:sent.messageId};await run("UPDATE delivery_attempts SET status='sent',result=$1 WHERE id=$2",[JSON.stringify(result),attempt.id]);return result;
 }catch(e){
 // A timeout or lost provider acknowledgement may already represent a delivered message.
 const uncertain=delivered||enteredProvider&&!Number.isInteger(Number(e.response?.status||e.statusCode||e.status))||enteredProvider&&Number(e.response?.status||e.statusCode||e.status)>=500;
 const status=uncertain?'uncertain':'failed',message=uncertain?'قد تكون الرسالة وصلت. راجع Gmail أو واتساب قبل إعادة الإرسال.':e.message;
 const result={ok:false,status,channel,logId,error:message};
 try{await run('UPDATE email_log SET status=$1,reason=$2 WHERE id=$3 AND user_id=$4',[status,message,logId,userId]);await run('UPDATE delivery_attempts SET status=$1,result=$2 WHERE id=$3',[status,JSON.stringify(result),attempt.id]);}catch{console.warn('Delivery persistence failed; request remains blocked',attempt.id);}
 return result;
 }
}
module.exports={deliver};
