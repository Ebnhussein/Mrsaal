'use strict';
const {get,run}=require('./db');const {randomUUID}=require('crypto');
async function acquire(userId){const token=randomUUID(),row=await get(`INSERT INTO ai_leases(user_id,token,until) VALUES($1,$2,NOW()+INTERVAL '100 seconds') ON CONFLICT(user_id) DO UPDATE SET token=EXCLUDED.token,until=EXCLUDED.until WHERE ai_leases.until<NOW() RETURNING token`,[userId,token]);if(!row){const e=new Error('عندك طلب ذكاء اصطناعي شغال. انتظر لحد ما يخلص.');e.status=429;throw e;}return token;}
async function release(userId,token){await run('DELETE FROM ai_leases WHERE user_id=$1 AND token=$2',[userId,token]);}
module.exports={acquire,release};
