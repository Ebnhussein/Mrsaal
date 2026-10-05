const cron=require('node-cron');
const {v4:uuidv4}=require('uuid');
const {all,get,run}=require('./db');
const {generateEmail,generateWhatsAppMessage}=require('./ai');
const {sendEmail}=require('./gmail');
const {resolveAccount}=require('./gmail-accounts');
const {sendWhatsAppMessage}=require('./whatsapp');
const {syncReplies}=require('./replyTracker');
const BASE_URL=process.env.BASE_URL||`http://localhost:${process.env.PORT||3000}`;
let busy=false,syncBusy=false;
const tasks=[];
async function ensureSchedulerSchema(){await run('ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS log_id TEXT');}
async function tick(){
  if(busy)return;busy=true;
  try{
    const jobs=await all(`SELECT sj.*, c.name AS company_name,c.email AS company_email,c.phone,c.field,c.location
      FROM scheduled_jobs sj JOIN companies c ON c.id=sj.company_id AND c.user_id=sj.user_id
      WHERE sj.status='pending' AND sj.scheduled_at <= $1 ORDER BY sj.scheduled_at LIMIT 50`,[Date.now()]);
    for(const job of jobs){
      const claimed=await run("UPDATE scheduled_jobs SET status='processing' WHERE id=$1 AND status='pending' RETURNING id",[job.id]);
      if(!claimed.rowCount)continue;
      const logId=job.log_id||uuidv4();
      let delivered=false;
      try{
        const user=await get('SELECT * FROM users WHERE id=$1',[job.user_id]);
        const cv=await get('SELECT * FROM cv_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[job.user_id]);
        const tpl=await get('SELECT * FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[job.user_id]);
        const saved=job.log_id?await get('SELECT * FROM email_log WHERE id=$1 AND user_id=$2',[job.log_id,job.user_id]):null;
        if(!user||!cv)throw new Error('المستخدم أو السيرة الذاتية غير موجود');
        const company={name:job.company_name,email:job.company_email,phone:job.phone,field:job.field,location:job.location};
        const channel=company.email?.includes('@')?'email':company.phone?'whatsapp':null;
        if(!channel)throw new Error('لا توجد وسيلة تواصل');
        const account=channel==='email'?await resolveAccount(job.user_id,job.sender_account_id):null;
        const params={userId:job.user_id,cv:cv.content,company,instructions:tpl?.instructions,subjectTemplate:tpl?.subject_template,apiKey:user.gemini_key||null,modelName:user.gemini_model||null};
        let subject=saved?.subject||'',body=saved?.body||'';
        if(!body.trim()){
          if(channel==='email'){const email=await generateEmail(params);subject=email.subject;body=email.body;}
          else body=await generateWhatsAppMessage(params);
        }
        const attachment=cv.pdf_data?{data:cv.pdf_data,filename:cv.filename||'CV.pdf',mimeType:'application/pdf'}:null;
        const result=channel==='email'
          ? await sendEmail({user,account,to:company.email,subject,body,trackingPixelUrl:`${BASE_URL}/track/open/${logId}.gif`,attachment})
          : await sendWhatsAppMessage(job.user_id,company.phone,body,attachment);
        delivered=true;
        await run(`INSERT INTO email_log(id,user_id,company_id,company_name,company_email,subject,body,status,message_id,thread_id,channel)
          VALUES($1,$2,$3,$4,$5,$6,$7,'sent',$8,$9,$10)
          ON CONFLICT(id) DO UPDATE SET subject=EXCLUDED.subject,body=EXCLUDED.body,status='sent',message_id=EXCLUDED.message_id,thread_id=EXCLUDED.thread_id,channel=EXCLUDED.channel,sent_at=EXTRACT(EPOCH FROM NOW()),reason=NULL`,
          [logId,job.user_id,job.company_id,company.name,channel==='email'?company.email:company.phone,subject,body,result.messageId,result.threadId||null,channel]);
        if(account)await run('UPDATE email_log SET sender_account_id=$1,sender_email=$2 WHERE id=$3 AND user_id=$4',[account.gmail_account_id,account.email,logId,job.user_id]);
        await run("UPDATE scheduled_jobs SET status='sent' WHERE id=$1",[job.id]);
        await run("UPDATE companies SET status='sent',scheduled_at=NULL WHERE id=$1 AND user_id=$2",[job.company_id,job.user_id]);
        console.log(`Scheduled ${channel} sent`);
      }catch(err){
        // لا نعيد تلقائيًا رسالة قد تكون وصلت بالفعل.
        const status=delivered?'uncertain':'failed';
        await run('UPDATE scheduled_jobs SET status=$1 WHERE id=$2',[status,job.id]);
        await run('UPDATE companies SET status=$1 WHERE id=$2 AND user_id=$3',[delivered?'sent':'failed',job.company_id,job.user_id]);
        if(job.log_id)await run('UPDATE email_log SET status=$1,reason=$2 WHERE id=$3 AND user_id=$4',[status,delivered?'تم الإرسال لكن تعذر تسجيل النتيجة بالكامل':err.message,job.log_id,job.user_id]);
        console.error('Scheduled send failed:',err.message);
      }
    }
  }catch(err){console.error('Scheduler error:',err.message);}
  finally{busy=false;}
}
function startScheduler(){
  if(tasks.length)return;
  tasks.push(cron.schedule('* * * * *',tick));
  tasks.push(cron.schedule('*/5 * * * *',async()=>{
    if(syncBusy)return;syncBusy=true;
    try{await syncReplies();}catch(err){console.error('Gmail sync failed:',err.message);}finally{syncBusy=false;}
  }));
  console.log('Scheduler started');
}
function stopScheduler(){for(const task of tasks)task.stop();}
module.exports={ensureSchedulerSchema,startScheduler,stopScheduler};
