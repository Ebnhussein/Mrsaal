'use strict';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function retryAfter(headers){const value=headers?.get?.('retry-after');if(!value)return null;const seconds=Number(value);const ms=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now();return Number.isFinite(ms)?Math.max(0,ms):null;}
function hardQuota(data){const message=String(data?.error?.message||'');return data?.error?.type==='insufficient_quota'||/daily limit|per day|daily quota|free-models-per-day/i.test(message);}
async function withRecovery(operation,deadline){
 try{return await operation();}catch(error){
  const transient=['NETWORK','TEMPORARY','RATE_LIMIT'].includes(error.code);
  const wait=error.retryAfterMs??800;
  // Never bypass provider reset times or retry exhausted daily quota / rejected keys.
  if(!transient||wait>2000||deadline-Date.now()<wait+3000)throw error;
  await pause(wait);return operation();
 }
}
module.exports={withRecovery,retryAfter,hardQuota};
