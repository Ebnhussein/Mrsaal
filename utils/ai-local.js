'use strict';
const {get,run}=require('./db');
const {randomUUID,createHash}=require('crypto');
function configured(){return !!process.env.LOCAL_AI_BASE_URL?.trim();}
function error(code,message,status=503){return Object.assign(new Error(message),{code,status});}
function integer(name,fallback,min,max){const n=Number(process.env[name]);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
function settings(){
 let base;
 try{base=new URL(process.env.LOCAL_AI_BASE_URL);}catch{throw error('AI_UNAVAILABLE','إعداد خدمة ذكاء مرسال المحلي غير صحيح.');}
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw error('AI_UNAVAILABLE','راجع عنوان خدمة ذكاء مرسال المحلي.');
 if(!process.env.LOCAL_AI_API_KEY?.trim())throw error('AI_UNAVAILABLE','مفتاح خدمة ذكاء مرسال المحلي لم يُضبط بعد.');
 return {url:base.href.replace(/\/$/,'')+'/chat/completions',scope:createHash('sha256').update(base.href.replace(/\/$/,'')).digest('hex'),model:process.env.LOCAL_AI_MODEL?.trim()||'local-ai',key:process.env.LOCAL_AI_API_KEY.trim(),concurrent:integer('LOCAL_AI_MAX_CONCURRENT',1,1,8),rate:integer('LOCAL_AI_REQUESTS_PER_MINUTE',3,1,30),tokens:integer('LOCAL_AI_MAX_OUTPUT_TOKENS',1600,128,8000),chars:integer('LOCAL_AI_MAX_PROMPT_CHARS',50000,1000,100000),jsonMode:process.env.LOCAL_AI_JSON_MODE!=='off'};
}
async function acquire(config,ttl){
 for(let slot=1;slot<=config.concurrent;slot++){
  const token=randomUUID();
  const row=await get(`INSERT INTO local_ai_slots(scope,slot,token,expires_at) VALUES($1,$2,$3,NOW()+($4::integer*INTERVAL '1 second')) ON CONFLICT(scope,slot) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at WHERE local_ai_slots.expires_at<NOW() RETURNING token`,[config.scope,slot,token,ttl]);
  if(row)return {slot,token};
 }
 throw error('AI_UNAVAILABLE','ذكاء مرسال مشغول بطلب آخر حاليًا. استنى قليلًا وجرب تاني.',429);
}
function number(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
async function record(userId,usage){
 if(!userId)return;
 const prompt=number(usage?.prompt_tokens),completion=number(usage?.completion_tokens),total=number(usage?.total_tokens);
 const reported=prompt!==null&&completion!==null;
 try{await run(`INSERT INTO local_ai_usage(user_id,requests,metered_requests,prompt_tokens,completion_tokens,total_tokens) VALUES($1,1,$2,$3,$4,$5) ON CONFLICT(user_id,day) DO UPDATE SET requests=local_ai_usage.requests+1,metered_requests=local_ai_usage.metered_requests+EXCLUDED.metered_requests,prompt_tokens=local_ai_usage.prompt_tokens+EXCLUDED.prompt_tokens,completion_tokens=local_ai_usage.completion_tokens+EXCLUDED.completion_tokens,total_tokens=local_ai_usage.total_tokens+EXCLUDED.total_tokens`,[userId,reported?1:0,prompt||0,completion||0,total??((prompt||0)+(completion||0))]);}catch{console.warn('Local AI usage recording failed');}
}
async function callLocalAI(prompt,maxTokens=1200,validate=null,deadline=Date.now()+45000,userId=null){
 const config=settings();
 if(typeof prompt!=='string'||prompt.length>config.chars)throw error('AI_UNAVAILABLE','المحتوى أطول من الحد المتاح للكتابة. قلّل الأمثلة أو النص وحاول مجددًا.',400);
 const timeout=deadline-Date.now();if(timeout<=0)throw error('TIMEOUT','انتهت مهلة الكتابة.');
 const lease=await acquire(config,Math.ceil(timeout/1000)+15);
 let knownFinished=false,started=false,metered=false;
 const began=Date.now(),requestedTokens=Math.min(Math.max(1,Number(maxTokens)||1200),config.tokens);
 let finishReason=null,usage=null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1,deadline-Date.now()));
 try{
  if(userId){const allowed=await get(`INSERT INTO local_ai_windows(user_id,minute,amount) VALUES($1,date_trunc('minute',NOW()),1) ON CONFLICT(user_id) DO UPDATE SET minute=EXCLUDED.minute,amount=CASE WHEN local_ai_windows.minute<>EXCLUDED.minute THEN 1 ELSE local_ai_windows.amount+1 END WHERE local_ai_windows.minute<>EXCLUDED.minute OR local_ai_windows.amount<$2 RETURNING amount`,[userId,config.rate]);if(!allowed)throw error('AI_UNAVAILABLE','طلبت الكتابة أكثر من مرة خلال دقيقة. استنى للدقيقة التالية.',429);}
  if(Date.now()>=deadline||controller.signal.aborted)throw error('TIMEOUT','انتهت مهلة الكتابة.');
  started=true;
  console.log('AI trying: local / '+config.model.replace(/[^a-zA-Z0-9_/:.\-]/g,'').slice(0,100));
  const response=await fetch(config.url,{method:'POST',redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:[{role:'system',content:'استخدم الحقائق المقدمة فقط والتزم بالتنسيق المطلوب. أرجع الإجابة النهائية فقط دون شرح التفكير.'+(validate?' الرد يجب أن يكون كائن JSON واحدًا صالحًا فقط، بكل الحقول المطلوبة في الطلب، بدون مقدمات أو Markdown أو تعليقات.':'')},{role:'user',content:prompt}],max_tokens:requestedTokens,temperature:0,...(validate&&config.jsonMode?{response_format:validate.schema&&process.env.LOCAL_AI_JSON_MODE!=='object'?{type:'json_schema',json_schema:{name:'mrsaal_response',strict:true,schema:validate.schema}}:{type:'json_object'}}:{}),stream:false})});
  const data=await response.json().catch(()=>null);if(controller.signal.aborted)throw error('TIMEOUT','انتهت مهلة كتابة المسودة.');
  knownFinished=true;usage=data?.usage;finishReason=data?.choices?.[0]?.finish_reason;await record(userId,usage);metered=true;
  if(!response.ok||data?.error){console.warn('Local AI request rejected; status='+response.status);throw error('AI_UNAVAILABLE',response.status===401||response.status===403?'ربط ذكاء مرسال المحلي محتاج مراجعة من الإدارة.':response.status===429?'خدمة ذكاء مرسال مشغولة حاليًا. حاول بعد قليل.':'خدمة ذكاء مرسال المحلي غير متاحة حاليًا.',response.status===429?429:503);}
  const choice=data?.choices?.[0],text=choice?.message?.content;
  if(choice?.finish_reason==='length')throw error('AI_UNAVAILABLE','رد ذكاء مرسال المحلي اتقطع. اختصر الطلب أو راجع سقف التوكنز من الإدارة.');
  if(typeof text!=='string'||!text.trim())throw error('AI_UNAVAILABLE','ذكاء مرسال المحلي لم يرجع نصًا صالحًا.');
  const cleaned=validate?cleanEnvelope(text):text.trim();
  if(validate&&!validate(cleaned)){
   let parsed;try{parsed=JSON.parse(cleaned);}catch{}
   const recognized=parsed&&typeof parsed==='object'?['subject','body','notes','needsUserInput','version','scope','text','topics','summary'].filter(key=>Object.hasOwn(parsed,key)):[];
   console.warn('Local AI output invalid:',JSON.stringify({jsonObject:!!parsed&&typeof parsed==='object'&&!Array.isArray(parsed),recognizedFields:recognized,characters:cleaned.length}));
   throw Object.assign(error('AI_UNAVAILABLE','المسودة رجعت بتنسيق غير صالح. جرّب مرة تانية أو اكتبها يدويًا.'),{reason:'FORMAT'});
  }
  console.log('AI succeeded: local');return cleaned;
 }catch(e){
  if(e.code==='AI_UNAVAILABLE'||e.code==='TIMEOUT')throw e;
  console.warn('Local AI connection failed; code='+ (controller.signal.aborted?'TIMEOUT':'NETWORK'));
  throw error(controller.signal.aborted?'TIMEOUT':'AI_UNAVAILABLE',controller.signal.aborted?'ذكاء مرسال المحلي استغرق وقتًا أطول من المهلة المتاحة.':'تعذر الاتصال بذكاء مرسال المحلي. تأكد أن جهاز تشغيل الموديل متصل.');
 }finally{
  clearTimeout(timer);
  console.log('Local AI timing:',JSON.stringify({elapsedMs:Date.now()-began,promptCharacters:prompt.length,requestedTokens,finishReason:['stop','length','content_filter'].includes(finishReason)?finishReason:null,promptTokens:number(usage?.prompt_tokens),completionTokens:number(usage?.completion_tokens),aborted:controller.signal.aborted}));
  if(started&&!metered)await record(userId,null);
  // A lost connection may leave the backend computing. Keep the slot until expiry.
  if(knownFinished||!started)await run('DELETE FROM local_ai_slots WHERE scope=$1 AND slot=$2 AND token=$3',[config.scope,lease.slot,lease.token]).catch(()=>console.warn('Local AI slot release deferred'));
 }
}
function cleanEnvelope(text){
 let result=text.trim().replace(/^\uFEFF/,'');
 while(/^<think>/i.test(result)){
  const end=result.toLowerCase().indexOf('</think>');
  if(end<0)return result; // Incomplete thinking is never treated as a finished answer.
  result=result.slice(end+8).trim();
 }
 return result.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
}
module.exports={configured,callLocalAI,settings,cleanEnvelope};
