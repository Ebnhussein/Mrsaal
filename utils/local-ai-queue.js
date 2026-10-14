'use strict';
const {get,run,pool}=require('./db');const {randomUUID}=require('crypto');
function bounded(name,fallback,min,max){const n=Number(process.env[name]);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
function fail(message,code='AI_UNAVAILABLE',status=429){return Object.assign(new Error(message),{code,status});}
async function first(scope){return get("SELECT id,user_id FROM local_ai_queue WHERE scope=$1 AND status='waiting' AND expires_at>NOW() ORDER BY created_at,id LIMIT 1",[scope]);}
async function enqueue(scope,userId,deadline){
 const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[scope+':queue']);
 await client.query("DELETE FROM local_ai_queue WHERE expires_at<NOW() OR status='cancelled'");
 const limit=bounded('LOCAL_AI_QUEUE_LIMIT',5,0,20);const count=(await client.query("SELECT COUNT(*)::int AS n FROM local_ai_queue WHERE scope=$1 AND status='waiting'",[scope])).rows[0].n;
 if(count>=limit)throw fail('طابور الذكاء الاصطناعي ممتلئ. حاول بعد قليل.');
 const id=randomUUID();await client.query("INSERT INTO local_ai_queue(id,scope,user_id,status,expires_at) VALUES($1,$2,$3,'waiting',$4)",[id,scope,userId,new Date(deadline)]);await client.query('COMMIT');return id;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function wait(config,userId,deadline,claim){
 const ms=bounded('LOCAL_AI_QUEUE_WAIT_MS',45000,0,45000),until=Math.min(deadline-5000,Date.now()+ms);
 if(!userId||until<=Date.now())throw fail('ذكاء مرسال مشغول حاليًا. حاول بعد قليل.');
 const id=await enqueue(config.scope,userId,until);
 try{while(Date.now()<until){
  const row=await get('SELECT status FROM local_ai_queue WHERE id=$1 AND user_id=$2',[id,userId]);if(!row||row.status==='cancelled')throw fail('اتلغى طلب الذكاء الاصطناعي.','AI_CANCELLED',409);
  const head=await first(config.scope);if(head?.id===id){const slot=await claim();if(slot)return slot;}
  await new Promise(resolve=>setTimeout(resolve,500));
 }throw fail('انتهت مهلة الانتظار في الطابور. حاول بعد قليل.');
 }finally{await run('DELETE FROM local_ai_queue WHERE id=$1 AND user_id=$2',[id,userId]).catch(()=>{});}
}
async function status(userId,scope){
 const slot=await get('SELECT token,cancel_requested FROM local_ai_slots WHERE user_id=$1 AND scope=$2 AND expires_at>NOW()',[userId,scope]);if(slot)return {state:slot.cancel_requested?'cancelling':'running',id:slot.token};
 const row=await get("SELECT id,created_at FROM local_ai_queue WHERE user_id=$1 AND scope=$2 AND status='waiting' AND expires_at>NOW()",[userId,scope]);if(!row)return {state:'idle'};
 const ahead=await get("SELECT COUNT(*)::int AS n FROM local_ai_queue WHERE scope=$1 AND status='waiting' AND expires_at>NOW() AND (created_at,id)<=($2::timestamptz,$3)",[scope,row.created_at,row.id]);return {state:'waiting',position:ahead.n,id:row.id};
}
async function cancel(userId,scope,id=null){const waiting=await run("UPDATE local_ai_queue SET status='cancelled' WHERE user_id=$1 AND scope=$2 AND ($3::text IS NULL OR id=$3)",[userId,scope,id]);const running=await run('UPDATE local_ai_slots SET cancel_requested=true WHERE user_id=$1 AND scope=$2 AND expires_at>NOW() AND ($3::text IS NULL OR token=$3)',[userId,scope,id]);return {ok:true,cancelled:(waiting.rowCount||0)+(running.rowCount||0)>0};}
async function globalAllowance(scope,userId=null){
 if(userId){const user=await get('SELECT ai_limit FROM users WHERE id=$1',[userId]);const used=await get('SELECT requests FROM local_ai_usage WHERE user_id=$1 AND day=CURRENT_DATE',[userId]);if(!user||Number(used?.requests||0)>=user.ai_limit)throw fail('وصلت لحد تشغيل ذكاء مرسال المحلي اليومي لحسابك. جرّب الكتابة اليدوية أو منصة شخصية.');}

 const minute=await get(`INSERT INTO local_ai_global_windows(scope,minute,amount) VALUES($1,date_trunc('minute',NOW()),1) ON CONFLICT(scope) DO UPDATE SET minute=EXCLUDED.minute,amount=CASE WHEN local_ai_global_windows.minute<>EXCLUDED.minute THEN 1 ELSE local_ai_global_windows.amount+1 END WHERE local_ai_global_windows.minute<>EXCLUDED.minute OR local_ai_global_windows.amount<$2 RETURNING amount`,[scope,bounded('LOCAL_AI_GLOBAL_REQUESTS_PER_MINUTE',6,1,60)]);if(!minute)throw fail('ذكاء مرسال وصل لحد الطلبات الحالي. حاول بعد دقيقة.');
 const day=await get(`INSERT INTO local_ai_global_usage(scope,day,amount) VALUES($1,CURRENT_DATE,1) ON CONFLICT(scope,day) DO UPDATE SET amount=local_ai_global_usage.amount+1 WHERE local_ai_global_usage.amount<$2 RETURNING amount`,[scope,bounded('LOCAL_AI_GLOBAL_DAILY_REQUESTS',300,1,10000)]);if(!day)throw fail('وصل ذكاء مرسال لحد التشغيل اليومي. الكتابة اليدوية والمنصات الشخصية متاحة.');
}
module.exports={first,wait,status,cancel,globalAllowance,bounded};
