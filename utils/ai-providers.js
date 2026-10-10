'use strict';
const health=require('./ai-health');
const {withRecovery,retryAfter,hardQuota}=require('./ai-retry');
const {all}=require('./db');const {unseal}=require('./connection-secrets');
const PROVIDERS={gemini:{name:'Google Gemini',base:'https://generativelanguage.googleapis.com/v1beta'},openrouter:{name:'OpenRouter',base:'https://openrouter.ai/api/v1'},openai:{name:'OpenAI',base:'https://api.openai.com/v1'},groq:{name:'Groq',base:'https://api.groq.com/openai/v1'}};
function provider(id){if(!Object.hasOwn(PROVIDERS,id)){const e=new Error('منصة غير مدعومة');e.status=400;throw e;}return PROVIDERS[id];}
// Runtime settings in Coolify. Bounds keep requests below the UI deadline.
function timeoutSetting(name, fallback, minimum, maximum) {
 const value=Number(process.env[name]);
 return Number.isFinite(value)&&value>=minimum&&value<=maximum?Math.floor(value):fallback;
}
const MODEL_TIMEOUT_MS=timeoutSetting('AI_MODEL_TIMEOUT_MS',20000,5000,60000);
const TOTAL_TIMEOUT_MS=timeoutSetting('AI_TOTAL_TIMEOUT_MS',45000,MODEL_TIMEOUT_MS,90000);
const DISCOVERY_TIMEOUT_MS=20000;
const ERROR_HINTS = {
 AUTH: 'المفتاح مرفوض. احفظ المفتاح الجديد ثم اختبره.',
 CREDITS: 'الرصيد أو حد الإنفاق غير كافٍ. راجع رصيد الحساب وحد المفتاح.',
 RATE_LIMIT: 'المنصة قيّدت عدد الطلبات مؤقتًا. انتظر موعد إعادة المحاولة أو اختر بديلًا.',
 QUOTA: 'وصل الحساب للحد اليومي. انتظر تجدد الحصة أو استخدم منصة أخرى.',
 TEMPORARY: 'الموديل مزدحم أو المنصة غير متاحة مؤقتًا؛ جرّب بديلًا.',
 FORBIDDEN: 'الطلب محظور. راجع صلاحيات المفتاح وإعدادات الخصوصية وسياسة المنصة.',
 MODEL_UNAVAILABLE: 'الموديل غير متاح. حدّث قائمة الموديلات واختر بديلًا.',
 BAD_REQUEST: 'المنصة رفضت إعدادات الطلب. جرّب موديلًا آخر أو قلّل حجم المحتوى.',
 TIMEOUT: 'انتهت مهلة الرد. جرّب موديلًا أسرع أو بديلًا.',
 NETWORK: 'تعذر الاتصال بالمنصة من السيرفر.',
 TRUNCATED: 'الرد انتهى قبل اكتماله. جرّب موديلًا آخر؛ قد يستهلك التفكير ميزانية الرد.',
 EMPTY: 'الموديل لم يرجع نصًا. جرّب موديلًا آخر.',
 FORMAT: 'وصل رد لكن تنسيقه لا يصلح لمسودة الرسالة. جرّب موديلًا آخر.',
 INVALID_RESPONSE: 'وصل رد غير صالح من المنصة.',
 UNKNOWN: 'تعذر تنفيذ الطلب. اختبر الموديل أو اختر بديلًا.'
};
function aiError(code, status=0) {
 const e=new Error(ERROR_HINTS[code]||ERROR_HINTS.UNKNOWN);
 e.code=Object.hasOwn(ERROR_HINTS,code)?code:'UNKNOWN';e.status=status;return e;
}
function statusCode(status) {
 if(status===401)return 'AUTH';if(status===402)return 'CREDITS';
 if(status===403)return 'FORBIDDEN';if(status===429)return 'RATE_LIMIT';
 if(status===408||status===504)return 'TIMEOUT';
 if(status===404)return 'MODEL_UNAVAILABLE';if(status>=500)return 'TEMPORARY';
 if(status===400||status===413||status===422)return 'BAD_REQUEST';return 'UNKNOWN';
}
async function request(id,key,path,body,timeout=DISCOVERY_TIMEOUT_MS){
 const p=provider(id);
 const headers=id==='gemini'?{'x-goog-api-key':key}:{Authorization:`Bearer ${key}`};
 headers['Content-Type']='application/json';
 const signal=AbortSignal.timeout(Math.max(1,Math.ceil(timeout)));
 let response,data;
 try {
  response=await fetch(p.base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal});
  // The deadline also applies while reading the response body.
  data=await response.json();
 } catch(e) {
  if(signal.aborted||e.name==='TimeoutError'||e.name==='AbortError')throw aiError('TIMEOUT');
  if(response)throw aiError('INVALID_RESPONSE');
  throw aiError('NETWORK');
 }
 if(!response.ok||data?.error){
  const embedded=Number(data?.error?.code);
  const status=embedded>=400&&embedded<=599?embedded:Number(response.status);
  const code=status===429&&hardQuota(data)?'QUOTA':data?.error?.metadata?.reason==='in_flight_budget_exhausted'?'TEMPORARY':statusCode(status);const error=aiError(code,status);error.retryAfterMs=retryAfter(response.headers);throw error;
 }
 if(!data)throw aiError('INVALID_RESPONSE');return data;
}
function usable(id,m){if(id==='gemini')return m.supportedGenerationMethods?.includes('generateContent');if(id==='openrouter')return !m.architecture?.output_modalities||m.architecture.output_modalities.includes('text');if(id==='openai')return /^(gpt-|chatgpt-|o[134](?:-|$))/.test(m.id)&&!/audio|realtime|transcrib|tts|image|codex|search|pro|deep-research/.test(m.id);return !/whisper|tts|guard|embedding/.test(m.id)&&m.active!==false;}
async function listModels(id,key,freeOnly=true){
 provider(id);if(typeof key!=='string'||!key.trim())throw new Error('أضف مفتاح المنصة أولًا');let rows=[];
 if(id==='gemini'){let next='';for(let page=0;page<20;page++){const data=await request(id,key,'/models?pageSize=100'+(next?'&pageToken='+encodeURIComponent(next):''));rows.push(...(data.models||[]));next=data.nextPageToken;if(!next)break;}}
 else{if(id==='openrouter')await request(id,key,'/key');const data=await request(id,key,'/models');rows=data.data||[];}
 const result=rows.filter(m=>usable(id,m)).map(m=>({id:id==='gemini'?m.name.replace(/^models\//,''):m.id,name:m.displayName||m.name||m.id,free:id==='openrouter'?(Number(m.pricing?.prompt)===0&&Number(m.pricing?.completion)===0):null})).filter(m=>m.id&&(!freeOnly||id!=='openrouter'||m.free));
 if(id==='openrouter'&&!result.some(m=>m.id==='openrouter/free'))result.push({id:'openrouter/free',name:'اختيار تلقائي من الموديلات المجانية',free:true});
 return result.sort((a,b)=>a.id.localeCompare(b.id));
}
async function generate(id,key,model,prompt,maxTokens=1200,timeout=MODEL_TIMEOUT_MS){
 let text,finish;
 if(id==='gemini'){const data=await request(id,key,'/models/'+encodeURIComponent(model)+':generateContent',{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:maxTokens}},timeout);const c=data.candidates?.[0];text=c?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('');finish=c?.finishReason;}
 else if(id==='openai'){const data=await request(id,key,'/responses',{model,input:prompt,max_output_tokens:maxTokens,store:false},timeout);text=data.output?.filter(o=>o.type==='message').flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');finish=data.status==='incomplete'?'length':data.status;}
 else{const data=await request(id,key,'/chat/completions',{model,messages:[{role:'user',content:prompt}],max_tokens:maxTokens,stream:false},timeout);text=data.choices?.[0]?.message?.content;finish=data.choices?.[0]?.finish_reason;}
 if(finish==='length'||finish==='MAX_TOKENS')throw aiError('TRUNCATED');
 if(typeof text!=='string'||!text.trim())throw aiError('EMPTY');return text.trim();
}
async function callUserAI(userId,prompt,maxTokens,validate,operationDeadline=null){
 const rows=await all('SELECT * FROM ai_connections WHERE user_id=$1 AND enabled=true ORDER BY priority,provider',[userId]);
 const chain=rows.flatMap(r=>(Array.isArray(r.selected_models)?r.selected_models:[]).map(model=>({row:r,model}))).slice(0,12);
 if(!chain.length)return null;
 const end=Math.min(operationDeadline||Infinity,Date.now()+TOTAL_TIMEOUT_MS),failed=[],blocked=new Set();
 for(const {row,model}of chain){
  if(blocked.has(row.provider))continue;
  if(Date.now()>=end)break;
  const key=unseal(row.credentials).key;const unavailable=health.available(row.provider,key,model);
  if(unavailable){failed.push(`${PROVIDERS[row.provider]?.name} / ${model}: ${ERROR_HINTS[unavailable.code]||ERROR_HINTS.TEMPORARY}`);continue;}
  try {
   const text=await withRecovery(()=>generate(row.provider,key,model,prompt,maxTokens,Math.min(MODEL_TIMEOUT_MS,Math.max(1,end-Date.now()))),end);
   if(validate&&!validate(text))throw aiError('FORMAT');
   health.success(row.provider,key,model);return text;
  } catch(e) {
   const code=Object.hasOwn(ERROR_HINTS,e.code)?e.code:'UNKNOWN';
   health.failed(row.provider,key,model,code,e.retryAfterMs);
   const safeModel=String(model).replace(/[^a-zA-Z0-9_/:.\-]/g,'').slice(0,100);
   const label=PROVIDERS[row.provider]?.name||'AI';
   failed.push(`${label} / ${safeModel}: ${ERROR_HINTS[code]}`);
   // No key, prompt, CV or raw provider response is logged or returned.
   console.warn('User AI provider failed:',JSON.stringify({provider:row.provider,model:safeModel,code,status:e.status||0}));
   // A rejected key cannot be fixed by choosing another model with that key.
   if(['AUTH','QUOTA','CREDITS'].includes(code))blocked.add(row.provider);
  }
 }
 throw new Error('تعذر تنفيذ طلب الذكاء الاصطناعي. '+(failed.slice(0,3).join(' | ')||ERROR_HINTS.TIMEOUT));
}

module.exports={PROVIDERS,provider,listModels,generate,callUserAI,usable};
