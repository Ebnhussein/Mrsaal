'use strict';
const {PLANS}=require('./plan-catalog');
function number(value,fallback,min,max){const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
function limits(user={}){const plan=PLANS[user.plan_id]||PLANS.beta;return {cv:plan.cv||10,gmail:plan.gmail||5,storageBytes:number(user.storage_limit_mb,100,1,10000)*1048576,companies:number(user.company_limit,2000,1,100000)};}
function globalStorage(){return number(process.env.STORAGE_GLOBAL_LIMIT_MB,8192,100,100000)*1048576;}
function exceeded(message){const e=new Error(message);e.status=409;e.code='RESOURCE_LIMIT';throw e;}
module.exports={limits,globalStorage,exceeded};
async function usage(userId){const {get}=require('./db');const user=await get('SELECT plan_id,storage_limit_mb,company_limit FROM users WHERE id=$1',[userId]);if(!user)exceeded('الحساب غير موجود');const cv=await get('SELECT COUNT(*)::int AS count,COALESCE(SUM(octet_length(content)+COALESCE(octet_length(pdf_data),0)),0) AS bytes FROM cv_profiles WHERE user_id=$1',[userId]);const co=await get('SELECT COUNT(*)::int AS count FROM companies WHERE user_id=$1',[userId]);const gmail=await get('SELECT COUNT(*)::int AS count FROM gmail_accounts WHERE user_id=$1 AND connected=true',[userId]);return {limits:limits(user),used:{cv:cv.count,storageBytes:Number(cv.bytes),companies:co.count,gmail:gmail.count}};}
module.exports.usage=usage;
