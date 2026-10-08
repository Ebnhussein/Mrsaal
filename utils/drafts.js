'use strict';
const {get,run}=require('./db');
async function load(userId,companyId,channel){return await get('SELECT subject,body,updated_at FROM message_drafts WHERE user_id=$1 AND company_id=$2 AND channel=$3',[userId,companyId,channel])||await get("SELECT subject,body FROM email_log WHERE user_id=$1 AND company_id=$2 AND channel=$3 AND body IS NOT NULL AND body<>'' ORDER BY sent_at DESC LIMIT 1",[userId,companyId,channel]);}
async function save(userId,companyId,channel,subject,body){
 if(!['email','whatsapp'].includes(channel)||typeof body!=='string'||body.length>14000||typeof subject!=='string'||subject.length>240||/[\r\n]/.test(subject)){const e=new Error('المسودة غير صالحة');e.status=400;throw e;}
 if(!await get('SELECT id FROM companies WHERE id=$1 AND user_id=$2',[companyId,userId])){const e=new Error('الشركة غير موجودة');e.status=404;throw e;}
 await run(`INSERT INTO message_drafts(user_id,company_id,channel,subject,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,company_id,channel) DO UPDATE SET subject=EXCLUDED.subject,body=EXCLUDED.body,updated_at=NOW()`,[userId,companyId,channel,subject,body]);
}
module.exports={load,save};
