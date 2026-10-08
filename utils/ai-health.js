'use strict';
const {createHash}=require('crypto');
// No raw credentials or prompts are retained. Cache is scoped by key fingerprint.
const health=new Map();const ttl={AUTH:900000,CREDITS:900000,QUOTA:3600000,MODEL_UNAVAILABLE:900000,FORBIDDEN:300000,RATE_LIMIT:60000,TIMEOUT:120000,TEMPORARY:60000,NETWORK:30000,TRUNCATED:30000,FORMAT:15000};
function identity(provider,key,model='*'){return provider+':'+createHash('sha256').update(key).digest('hex')+':'+model;}
function available(provider,key,model){for(const m of ['*',model]){const id=identity(provider,key,m),item=health.get(id);if(item&&item.until>Date.now())return item;health.delete(id);}return null;}
function failed(provider,key,model,code,retryAfterMs){if(health.size>2000)health.clear();const scope=['AUTH','CREDITS','QUOTA'].includes(code)?'*':model;health.set(identity(provider,key,scope),{code,until:Date.now()+Math.max(ttl[code]||10000,Math.min(Number(retryAfterMs)||0,3600000))});}
function success(provider,key,model){health.delete(identity(provider,key,model));health.delete(identity(provider,key));}
module.exports={available,failed,success};
