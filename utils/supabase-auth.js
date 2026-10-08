'use strict';
const {get,run}=require('./db');const {randomUUID}=require('crypto');
function configured(){return !!(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY);}
async function request(path,body,token=null,method=null){
 if(!configured()){const e=new Error('تسجيل البريد غير مفعّل بعد. استخدم Google أو تواصل مع الدعم.');e.status=503;throw e;}
 const url=new URL(process.env.SUPABASE_URL);if(url.protocol!=='https:')throw new Error('SUPABASE_URL must use HTTPS');
 const response=await fetch(url.origin+'/auth/v1'+path,{method:method||(body?'POST':'GET'),headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>null);if(!response.ok){const e=new Error('تعذر تنفيذ طلب الحساب. راجع بيانات الدخول أو رسالة تأكيد البريد وحاول لاحقًا.');e.status=response.status===429?429:400;throw e;}return data;
}
async function identity(token){const user=await request('/user',null,token);if(!user?.id||!user.email||!user.email_confirmed_at){const e=new Error('أكد بريدك الإلكتروني أولًا');e.status=403;throw e;}return user;}
async function localUser(user){let row=await get('SELECT id FROM users WHERE supabase_id=$1',[user.id]);if(!row){
 // Explicitly keep existing Google accounts separate: no automatic merge by email.
 if(await get('SELECT id FROM users WHERE lower(email)=lower($1) AND supabase_id IS NULL',[user.email])){const e=new Error('عندك حساب سابق بهذا البريد. ادخل باستخدام Google واربط تسجيل البريد من إعدادات الحساب.');e.status=409;throw e;}
 row=await get(`INSERT INTO users(id,supabase_id,email,name) VALUES($1,$2,$3,$4) ON CONFLICT(supabase_id) DO UPDATE SET email=EXCLUDED.email RETURNING id`,[randomUUID(),user.id,user.email,String(user.user_metadata?.name||user.email.split('@')[0]).slice(0,120)]);
 }return row.id;}
module.exports={configured,request,identity,localUser};
