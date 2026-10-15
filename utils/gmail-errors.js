'use strict';
function gmailError(error){
 if(String(error?.code||'').startsWith('GMAIL_'))return error;
 const data=error?.response?.data;
 const oauth=typeof data?.error==='string'?data.error:'';
 const reason=data?.error?.errors?.[0]?.reason||'';
 const status=Number(error?.response?.status||error?.statusCode||error?.status||error?.code);
 const message=String(error?.message||'');
 let code;
 if(/Gmail API has not been used|gmail\.googleapis\.com.*disabled|SERVICE_DISABLED/i.test(message)||/accessNotConfigured|serviceDisabled/i.test(reason))code='GMAIL_API_DISABLED';
 else if(oauth==='invalid_grant'||/invalid_grant|Token has been expired or revoked/i.test(message)||status===401)code='GMAIL_RECONNECT';
 else if(oauth==='invalid_client'||/invalid_client|unauthorized_client/i.test(message))code='GMAIL_CONFIG';
 else if(/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(reason+' '+message))code='GMAIL_PERMISSIONS';
 else if(status===429||/rateLimitExceeded|userRateLimitExceeded|dailyLimitExceeded|mailRateLimitExceeded/.test(reason))code='GMAIL_LIMIT';
 else if(status===400&&(error?.response||/Bad Request|invalidArgument/i.test(message)))code='GMAIL_BAD_REQUEST';
 else if(status===404&&error?.response)code='GMAIL_THREAD_MISSING';
 else if(error?.response&&status===403)code='GMAIL_PERMISSIONS';
 else if(['ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN'].includes(error?.code))code='GMAIL_NETWORK';
 if(!code)return error;
 const texts=require('./public-errors').messages[code];
 const e=Object.assign(new Error(texts[0]),{code,status:code==='GMAIL_API_DISABLED'||code==='GMAIL_CONFIG'||code==='GMAIL_NETWORK'?503:code==='GMAIL_LIMIT'?429:code==='GMAIL_RECONNECT'?409:status||400});
 // Preserve the provider status for delivery certainty and sanitized diagnostics only.
 if(error.response)e.response=error.response;
 return e;
}
module.exports={gmailError};
