'use strict';
// WhatsApp can ban numbers that send bursts of unsolicited messages. These server-side limits apply on top of plan quotas.
const {get}=require('./db');
function setting(name,fallback,minimum,maximum){const value=Number(process.env[name]);return Number.isInteger(value)&&value>=minimum&&value<=maximum?value:fallback;}
const dailyCap=()=>setting('WHATSAPP_DAILY_CAP',100,1,1000);
const minDelay=()=>setting('WHATSAPP_MIN_DELAY_SECONDS',45,5,300);
// Campaign pacing in seconds: email keeps the old 5..300 range, WhatsApp is never faster than minDelay().
function delayFor(channel,requested){const floor=channel==='whatsapp'?minDelay():5;return Math.floor(Math.min(300,Math.max(floor,Number(requested)||floor)));}
async function assertWithinDailyCap(userId){
 const cap=dailyCap();
 const used=(await get("SELECT COUNT(*)::integer AS n FROM email_log WHERE user_id=$1 AND channel='whatsapp' AND status IN ('processing','sent','uncertain') AND sent_at>EXTRACT(EPOCH FROM NOW())-86400",[userId])).n;
 if(used>=cap){const e=new Error(`وصلت للحد اليومي الآمن لواتساب (${cap} رسالة في 24 ساعة) لحماية رقمك من الحظر. كمّل بكرة أو استخدم Gmail.`);e.code='WA_DAILY_CAP';e.status=429;e.beforeSend=true;throw e;}
}
module.exports={dailyCap,minDelay,delayFor,assertWithinDailyCap};
