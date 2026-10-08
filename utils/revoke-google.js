'use strict';
async function revoke(account){if(!account.credentials)return;const tokens=require('./connection-secrets').unseal(account.credentials),token=tokens.refresh_token||tokens.access_token;if(!token)return;const response=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}),signal:AbortSignal.timeout(15000)});if(!response.ok&&response.status!==400)throw new Error('تعذر إلغاء صلاحيات Google الآن. حاول لاحقًا.');}
module.exports={revoke};
