'use strict';
const {randomUUID}=require('crypto');
const errors=require('../utils/public-errors');
function locale(req,res,next){
 req.mrsaalLanguage=errors.language(req);req.requestId=randomUUID();
 res.setHeader('X-Request-ID',req.requestId);res.vary('X-Mrsaal-Language');res.vary('Accept-Language');
 const send=res.json.bind(res);
 res.json=function(payload){
  if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&typeof payload.error==='string'){
   const info=errors.describe({message:payload.error,code:payload.code,reason:payload.reason,failures:payload.failures,status:res.statusCode>=400?res.statusCode:400},req.mrsaalLanguage);
   payload={...payload,error:info.error,code:info.code,requestId:req.requestId,...(info.failures?{failures:info.failures}:{})};
   if(info.code==='INTERNAL')console.error('API response failed:',req.requestId,req.method,req.path,'INTERNAL');
  }
  // Historical delivery reasons are application messages, never the user's draft or reply body.
  function localizeReasons(value,depth=0){
   if(!value||typeof value!=='object'||depth>6)return value;
   if(Array.isArray(value))return value.map(v=>localizeReasons(v,depth+1));
   if(value.status&&typeof value.reason==='string'){
    const known=errors.known(value.reason,req.mrsaalLanguage);
    value={...value,reason:known||errors.translate(value.reason,req.mrsaalLanguage,400,value.code)};
   }
   for(const key of ['items','campaign','result'])if(value[key])value={...value,[key]:localizeReasons(value[key],depth+1)};
   return value;
  }
  return send(localizeReasons(payload));
 };
 next();
}
function handler(error,req,res,next){
 if(res.headersSent)return next(error);
 let normalized=error;
 if(/\/(?:email|accounts|campaigns)(?:\/|$)/.test(req.path||'')||/^\/auth\/google/.test(req.path||''))normalized=require('../utils/gmail-errors').gmailError(error);
 const info=errors.describe(normalized,req.mrsaalLanguage||errors.language(req));
 console.error('Request failed:',req.requestId,req.method,req.path,JSON.stringify({code:info.code,...errors.diagnostic(normalized)}));
 // The locale interceptor uses this catalog code; no raw error/stack/provider payload is sent.
 res.status(info.status).json({error:info.error,code:info.code,requestId:req.requestId,...(info.failures?{failures:info.failures}:{})});
}
module.exports={locale,handler};
