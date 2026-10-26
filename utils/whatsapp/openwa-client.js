'use strict';
function fail(code,status=503){return Object.assign(new Error(code),{code,status});}
function config(env=process.env){
 let base;try{base=new URL(env.OPENWA_BASE_URL);}catch{throw fail('OPENWA_CONFIG');}
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||!env.OPENWA_API_KEY?.trim()||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(env.OPENWA_TRIAL_SESSION_ID||''))throw fail('OPENWA_CONFIG');
 const recipient=String(env.OPENWA_TRIAL_RECIPIENT||'').replace(/^\+/,'');if(!/^[1-9]\d{7,14}$/.test(recipient))throw fail('OPENWA_CONFIG');
 return {base:base.href.replace(/\/$/,'').replace(/\/api$/,''),key:env.OPENWA_API_KEY.trim(),session:env.OPENWA_TRIAL_SESSION_ID,recipient};
}
function createClient(settings,fetcher=globalThis.fetch){
 async function request(path,{method='GET',body,key}={}){
  let response;try{response=await fetcher(settings.base+'/api/sessions/'+encodeURIComponent(settings.session)+path,{method,redirect:'error',signal:AbortSignal.timeout(method==='POST'?45000:15000),headers:{'X-API-Key':settings.key,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw fail('OPENWA_TIMEOUT');}
  let text;try{text=await response.text();}catch{throw fail('OPENWA_TIMEOUT');}if(text.length>1024*1024)throw fail('OPENWA_RESPONSE');let data;try{data=JSON.parse(text);}catch{throw fail('OPENWA_RESPONSE');}
  if(!response.ok)throw fail(response.status===401||response.status===403?'OPENWA_AUTH':response.status===404?'OPENWA_SESSION':response.status===409?'OPENWA_CONFLICT':'OPENWA_REJECTED',response.status===409?409:503);
  return data;
 }
 return {
  async status(){const s=await request('');let qr=null;if(s.status==='qr_ready'){const q=await request('/qr');if(typeof q.qrCode==='string'&&/^data:image\/(png|jpeg);base64,[a-z0-9+/=]+$/i.test(q.qrCode)&&q.qrCode.length<200000)qr=q.qrCode;}return {status:String(s.status||'unknown').slice(0,40),phone:typeof s.phone==='string'?s.phone.slice(0,30):null,qr,engineLoaded:!!s.engineLoaded};},
  async start(){const s=await request('');if(!s.engineLoaded)await request('/start',{method:'POST'});return {ok:true};},
  async stop(){await request('/stop',{method:'POST'});return {ok:true};},
  async send({body,attachment,key}){const chatId=settings.recipient+'@c.us';const payload=attachment?{chatId,base64:attachment.data.toString('base64'),mimetype:'application/pdf',filename:attachment.fileName,caption:body}:{chatId,text:body,linkPreview:false};const result=await request('/messages/send-'+(attachment?'document':'text'),{method:'POST',body:payload,key});if(typeof result.messageId!=='string'||!result.messageId)throw fail('OPENWA_RESPONSE');return {messageId:result.messageId};},
  async history(){const data=await request('/messages?'+new URLSearchParams({chatId:settings.recipient+'@c.us',limit:'20',inlineMedia:'false',orderBy:'timestamp'}));if(!Array.isArray(data.messages))throw fail('OPENWA_RESPONSE');return data.messages.slice(0,20).map(m=>({id:String(m.waMessageId||m.id).slice(0,200),direction:m.direction==='incoming'?'incoming':'outgoing',status:['pending','sent','delivered','read','failed'].includes(m.status)?m.status:'unknown',body:typeof m.body==='string'?m.body.slice(0,2000):'',type:String(m.type||'').slice(0,40),timestamp:m.timestamp||null}));}
 };
}
module.exports={config,createClient,fail};
