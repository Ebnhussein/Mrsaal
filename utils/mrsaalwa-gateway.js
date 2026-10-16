'use strict';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function fail(code,status=503){return Object.assign(new Error(code),{code,status,beforeSend:true});}
function config(env=process.env){
 let u;try{u=new URL(env.MRSAALWA_BASE_URL||env.OPENWA_BASE_URL);}catch{throw fail('MRSAALWA_CONFIG');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||!env.MRSAALWA_API_KEY?.trim())throw fail('MRSAALWA_CONFIG');
 return {base:u.href.replace(/\/$/,'').replace(/\/api$/,''),key:env.MRSAALWA_API_KEY.trim()};
}
function createGateway(settings,fetcher=globalThis.fetch){
 async function request(path,method='GET',body){
  let r;try{r=await fetcher(settings.base+'/api'+path,{method,redirect:'error',signal:AbortSignal.timeout(method==='GET'?15000:45000),headers:{'X-API-Key':settings.key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}catch{throw fail('MRSAALWA_TIMEOUT');}
  if(!r.ok)throw fail(r.status===401||r.status===403?'MRSAALWA_AUTH':r.status===404?'MRSAALWA_SESSION':r.status===409?'MRSAALWA_BUSY':'MRSAALWA_REJECTED');
  if(r.status===204)return {};
  const text=await r.text();if(text.length>2*1024*1024)throw fail('MRSAALWA_RESPONSE');
  try{return JSON.parse(text);}catch{throw fail('MRSAALWA_RESPONSE');}
 }
 function path(id){if(!UUID.test(id||''))throw fail('MRSAALWA_SESSION');return '/sessions/'+id;}
 return {
  list:()=>request('/sessions'),
  async create(name){const s=await request('/sessions','POST',{name,config:{maxReconnectAttempts:5,reconnectBaseDelay:5000}});if(!UUID.test(s.id||''))throw fail('MRSAALWA_RESPONSE');return s;},
  session:id=>request(path(id)),
  start:id=>request(path(id)+'/start','POST',{}),
  stop:id=>request(path(id)+'/stop','POST',{}),
  remove:id=>request(path(id),'DELETE'),
  logout:id=>request(path(id)+'/logout','POST',{}),
  async qr(id){const q=await request(path(id)+'/qr');if(typeof q.qrCode!=='string'||q.qrCode.length>200000||!/^data:image\/(png|jpeg);base64,[a-z0-9+/=]+$/i.test(q.qrCode))throw fail('MRSAALWA_RESPONSE');return q.qrCode;},
  async pair(id,phone){if(!/^[1-9]\d{7,14}$/.test(phone||''))throw fail('MRSAALWA_PHONE',400);const p=await request(path(id)+'/pairing-code','POST',{phoneNumber:phone});if(!/^[A-Z0-9-]{8,12}$/i.test(p.pairingCode||''))throw fail('MRSAALWA_RESPONSE');return p.pairingCode;},
  async send(id,number,content){
   const document=!!content.document;
   try{const r=await request(path(id)+'/messages/send-'+(document?'document':'text'),'POST',document?{chatId:number+'@c.us',base64:content.document.toString('base64'),mimetype:'application/pdf',filename:content.fileName,caption:content.caption}:{chatId:number+'@c.us',text:content.text,linkPreview:false});
    if(typeof r.messageId!=='string'||!r.messageId)throw fail('MRSAALWA_RESPONSE');
    return {messageId:r.messageId,threadId:r.messageId.match(/^(?:true|false)_(.+)_([^_]+)$/)?.[1]||number+'@c.us'};
   }catch{throw Object.assign(new Error('WA_SEND_UNCERTAIN'),{code:'WA_SEND_UNCERTAIN',status:502,deliveryUncertain:true});}
  },
  async messages(id,filters){const r=await request(path(id)+'/messages?'+new URLSearchParams({limit:'50',inlineMedia:'false',orderBy:'timestamp',...filters}));if(!Array.isArray(r.messages))throw fail('MRSAALWA_RESPONSE');return r.messages;}
 };
}
module.exports={config,createGateway,fail,UUID};
