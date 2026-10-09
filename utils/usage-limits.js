'use strict';
const {get,pool}=require('./db');const {randomUUID}=require('crypto');const {PLANS}=require('./plan-catalog');
function limitError(){const e=new Error('وصلت لحد الاستخدام المتاح. راجع الرصيد في الإعدادات أو تواصل مع الدعم.');e.status=429;return e;}
async function consume(userId,kind){
 if(!['send','ai'].includes(kind))throw new Error('Unknown usage kind');
 const row=await get(`INSERT INTO usage_daily(user_id,kind,amount) SELECT id,$2,1 FROM users WHERE id=$1 AND ${kind}_limit>0 ON CONFLICT(user_id,kind,day) DO UPDATE SET amount=usage_daily.amount+1 WHERE usage_daily.amount<(SELECT ${kind}_limit FROM users WHERE id=$1) RETURNING amount`,[userId,kind]);
 if(!row)throw limitError();return row.amount;
}
function cycle(start,now=new Date()){const anchor=new Date(start),span=30*86400000;return new Date(anchor.getTime()+Math.max(0,Math.floor((now-anchor)/span))*span);}
async function reserve(userId,kind){
 if(!['send','ai','personal_ai','assistant','style'].includes(kind))throw new Error('Unknown usage kind');
 const client=await pool.connect();try{
 await client.query('BEGIN');
 const user=(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!user)throw limitError();
 // Reclaim abandoned generation, never an ambiguous send. Lock also serialises quota checks.
 const expired=await client.query(`UPDATE usage_reservations SET status='released' WHERE user_id=$1 AND kind<>'send' AND status='reserved' AND created_at<NOW()-INTERVAL '10 minutes' RETURNING kind,day`,[userId]);
 for(const row of expired.rows)await client.query('UPDATE usage_daily SET amount=GREATEST(0,amount-1) WHERE user_id=$1 AND kind=$2 AND day=$3',[userId,row.kind,row.day]);
 const plan=PLANS[user.plan_id]||PLANS.beta,start=cycle(user.plan_started_at),max=kind==='send'?plan.send:kind==='ai'?plan.ai:null;
 if(max!==null){const used=(await client.query(`SELECT COUNT(*)::integer AS n FROM usage_reservations WHERE user_id=$1 AND kind=$2 AND period_start=$3 AND status IN ('reserved','committed')`,[userId,kind,start])).rows[0].n;if(used>=max)throw limitError();}
 const dailyMax=kind==='send'?user.send_limit:kind==='assistant'?Math.min(user.ai_limit,50):user.ai_limit;
 const daily=(await client.query(`INSERT INTO usage_daily(user_id,kind,amount) SELECT $1,$2,1 WHERE $3::integer>0 ON CONFLICT(user_id,kind,day) DO UPDATE SET amount=usage_daily.amount+1 WHERE usage_daily.amount<$3 RETURNING amount`,[userId,kind,dailyMax])).rows[0];if(!daily)throw limitError();
 const id=randomUUID();await client.query('INSERT INTO usage_reservations(id,user_id,kind,period_start) VALUES($1,$2,$3,$4)',[id,userId,kind,start]);await client.query('COMMIT');return id;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function commit(userId,id){await get("UPDATE usage_reservations SET status='committed' WHERE id=$1 AND user_id=$2 AND status='reserved' RETURNING id",[id,userId]);}
async function release(userId,id){
 const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
 const row=(await client.query("UPDATE usage_reservations SET status='released' WHERE id=$1 AND user_id=$2 AND status='reserved' RETURNING kind,day",[id,userId])).rows[0];
 if(row)await client.query('UPDATE usage_daily SET amount=GREATEST(0,amount-1) WHERE user_id=$1 AND kind=$2 AND day=$3',[userId,row.kind,row.day]);await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function summary(userId){const user=await get('SELECT plan_id,plan_started_at,ai_limit,send_limit FROM users WHERE id=$1',[userId]);const plan=PLANS[user?.plan_id]||PLANS.beta,start=cycle(user?.plan_started_at||new Date());
 const counts=(await pool.query(`SELECT kind,COUNT(*)::integer AS used FROM usage_reservations WHERE user_id=$1 AND period_start=$2 AND status IN ('reserved','committed') GROUP BY kind`,[userId,start])).rows;
 const daily=(await pool.query('SELECT kind,amount FROM usage_daily WHERE user_id=$1 AND day=CURRENT_DATE',[userId])).rows;
 return {plan,billingEnabled:false,dailyRemaining:{ai:Math.max(0,(user?.ai_limit||0)-(daily.find(r=>r.kind==='ai')?.amount||0)),personalAI:Math.max(0,(user?.ai_limit||0)-(daily.find(r=>r.kind==='personal_ai')?.amount||0))},periodStart:start,periodEnd:new Date(start.getTime()+30*86400000),credits:['ai','send'].map(kind=>{const used=counts.find(r=>r.kind===kind)?.used||0;return {kind,used,limit:plan[kind],remaining:plan[kind]===null?null:Math.max(0,plan[kind]-used)};}),dailyLimits:{ai:user?.ai_limit,send:user?.send_limit}};
}
module.exports={consume,reserve,commit,release,summary,cycle};
