'use strict';
// Editors and background workers claim work under the same user row lock.
// An editor can never open while a matching send is already processing/uncertain.
const {pool}=require('./db');const {randomUUID}=require('crypto');
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status,beforeSend:true});
async function transaction(userId,fn){const c=await pool.connect();try{await c.query('BEGIN');const u=await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);if(!u.rows.length)throw fail('EDIT_NOT_FOUND',404);const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function begin(userId,companyId,channel){
 if(typeof companyId!=='string'||!companyId||!['email','whatsapp'].includes(channel))throw fail('EDIT_INPUT',400);
 return transaction(userId,async c=>{
  const co=(await c.query('SELECT id,name FROM companies WHERE id=$1 AND user_id=$2',[companyId,userId])).rows[0];if(!co)throw fail('EDIT_NOT_FOUND',404);
  const inFlight=await c.query(`SELECT j.id FROM scheduled_jobs j JOIN email_log l ON l.id=j.log_id WHERE j.user_id=$1 AND j.company_id=$2 AND l.channel=$3 AND j.status IN ('processing','uncertain')
   UNION SELECT i.id FROM campaign_items i JOIN campaigns a ON a.id=i.campaign_id WHERE a.user_id=$1 AND i.company_id=$2 AND a.channel=$3 AND i.status IN ('processing','uncertain') LIMIT 1`,[userId,companyId,channel]);
  if(inFlight.rows.length)throw fail('EDIT_SEND_IN_PROGRESS');
  const jobs=(await c.query(`UPDATE scheduled_jobs j SET status='cancelled' FROM email_log l WHERE j.log_id=l.id AND j.user_id=$1 AND j.company_id=$2 AND l.channel=$3 AND j.status='pending' RETURNING j.id,j.log_id`,[userId,companyId,channel])).rows;
  for(const job of jobs){await c.query("UPDATE email_log SET status='cancelled',reason='SCHEDULE_CANCELLED_EDIT' WHERE id=$1 AND user_id=$2",[job.log_id,userId]);await notify(c,userId,'schedule-edit:'+job.id,{page:'report'},{company:co.name});}
  const campaigns=(await c.query(`UPDATE campaigns a SET status='paused',next_at=NULL WHERE a.user_id=$1 AND a.channel=$3 AND a.status='running' AND EXISTS(SELECT 1 FROM campaign_items i WHERE i.campaign_id=a.id AND i.company_id=$2 AND i.status IN ('draft','ready','generating')) RETURNING a.id`,[userId,companyId,channel])).rows;
  for(const campaign of campaigns){await c.query("UPDATE campaign_items SET status='draft',reason='SCHEDULE_CANCELLED_EDIT',updated_at=NOW() WHERE campaign_id=$1 AND company_id=$2 AND status='ready'",[campaign.id,companyId]);await notify(c,userId,'campaign-edit:'+campaign.id+':'+randomUUID(),{page:'campaigns',campaignId:campaign.id},{company:co.name});}
  // Editing a ready item in a paused campaign requires approval again, too.
  await c.query(`UPDATE campaign_items i SET status='draft',updated_at=NOW() FROM campaigns a WHERE i.campaign_id=a.id AND a.user_id=$1 AND i.company_id=$2 AND a.channel=$3 AND a.status IN ('draft','paused') AND i.status='ready'`,[userId,companyId,channel]);
  if(jobs.length)await c.query("UPDATE companies SET status='pending',scheduled_at=NULL WHERE id=$1 AND user_id=$2 AND status='scheduled'",[companyId,userId]);
  return {ok:true,cancelledJobs:jobs.length,cancelledCampaigns:campaigns.length};
 });
}
async function notify(c,userId,key,target,data){await c.query("SELECT mrsaal_notify($1,$2,'schedule_cancelled','messages',$3::jsonb,$4::jsonb)",[userId,key,JSON.stringify(target),JSON.stringify(data)]);}
async function claimSchedule(job){return transaction(job.user_id,async c=>(await c.query("UPDATE scheduled_jobs SET status='processing' WHERE id=$1 AND user_id=$2 AND status='pending' AND scheduled_at<=$3 RETURNING id",[job.id,job.user_id,Date.now()])).rows[0]||null);}
async function claimCampaign(campaign){return transaction(campaign.user_id,async c=>{
 const active=(await c.query("SELECT id FROM campaigns WHERE id=$1 AND user_id=$2 AND status='running' AND next_at<=NOW() FOR UPDATE",[campaign.id,campaign.user_id])).rows[0];if(!active)return {active:false,item:null};
 const item=(await c.query("UPDATE campaign_items SET status='processing',updated_at=NOW() WHERE id=(SELECT id FROM campaign_items WHERE campaign_id=$1 AND status='ready' ORDER BY company_name,id LIMIT 1) AND status='ready' RETURNING *",[campaign.id])).rows[0];return {active:true,item:item||null};
});}
module.exports={begin,claimSchedule,claimCampaign};
