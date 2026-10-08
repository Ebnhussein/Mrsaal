'use strict';
const {get}=require('./db');
async function consume(userId,kind){
 if(!['send','ai'].includes(kind))throw new Error('Unknown usage kind');
 const row=await get(`INSERT INTO usage_daily(user_id,kind,amount) SELECT id,$2,1 FROM users WHERE id=$1 AND ${kind}_limit>0 ON CONFLICT(user_id,kind,day) DO UPDATE SET amount=usage_daily.amount+1 WHERE usage_daily.amount<(SELECT ${kind}_limit FROM users WHERE id=$1) RETURNING amount`,[userId,kind]);
 if(!row){const e=new Error('وصلت للحد اليومي لهذا الاستخدام. تواصل مع الدعم أو انتظر تجدد الحد.');e.status=429;throw e;}
 return row.amount;
}
module.exports={consume};
