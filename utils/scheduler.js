const {checkToolAccess}=require('./access-control');
const cron=require('node-cron');
const {v4:uuidv4}=require('uuid');
const {all,get,run}=require('./db');
const {generateEmail,generateWhatsAppMessage}=require('./ai');
const {sendEmail}=require('./gmail');
const {resolveAccount}=require('./gmail-accounts');
const {sendWhatsAppMessage}=require('./whatsapp');
const {syncReplies}=require('./replyTracker');
const BASE_URL=(process.env.BASE_URL||'https://mrsaal.ebnhussein.co').replace(/\/$/,'');
let busy=false,syncBusy=false;
const tasks=[];
const {chooseChannel,skipReason}=require('../utils/delivery-channel');
async function ensureSchedulerSchema(){await run('ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS log_id TEXT');}
async function tick(){
 if(busy)return;busy=true;try{
 const jobs=await all("SELECT * FROM scheduled_jobs WHERE status='pending' AND scheduled_at<=$1 ORDER BY scheduled_at LIMIT 50",[Date.now()]);
 for(const job of jobs){try{await checkToolAccess(job.user_id);}catch{continue;}
 const claim=await run("UPDATE scheduled_jobs SET status='processing' WHERE id=$1 AND status='pending' RETURNING id",[job.id]);if(!claim.rowCount)continue;
 try{const draft=await get('SELECT * FROM email_log WHERE id=$1 AND user_id=$2',[job.log_id,job.user_id]);if(!draft?.body?.trim()){await run("UPDATE scheduled_jobs SET status='failed' WHERE id=$1",[job.id]);if(job.log_id)await run("UPDATE email_log SET status='failed',reason='المسودة تحتاج المراجعة؛ لم يتم توليد أو إرسال نص تلقائيًا' WHERE id=$1",[job.log_id]);continue;}
 const result=await require('./delivery').deliver(job.user_id,{companyId:job.company_id,channel:draft.channel,subject:draft.subject||'',body:draft.body,senderAccountId:job.sender_account_id,cvId:job.cv_id,idempotencyKey:'schedule:'+job.id,existingLogId:job.log_id});await run('UPDATE scheduled_jobs SET status=$1 WHERE id=$2',[result.status,job.id]);
 }catch(e){await run("UPDATE scheduled_jobs SET status='uncertain' WHERE id=$1",[job.id]);console.warn('Scheduled delivery requires review',job.id);}
 }
 }catch(e){console.warn('Scheduler unavailable',e.code||e.name);}finally{busy=false;}
}
function startScheduler(){
  if(tasks.length)return;
  tasks.push(cron.schedule('* * * * *',tick));
  tasks.push(cron.schedule('*/1 * * * *',async()=>{
    if(syncBusy)return;syncBusy=true;
    try{await syncReplies();}catch(err){console.error('Gmail sync failed:',err.message);}finally{syncBusy=false;}
  }));
  console.log('Scheduler started');
}
function stopScheduler(){for(const task of tasks)task.stop();}
module.exports={ensureSchedulerSchema,startScheduler,stopScheduler};
