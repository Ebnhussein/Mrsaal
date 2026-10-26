'use strict';
// Platform-owned providers. Never reads users' saved provider credentials.
const {createHash}=require('crypto');
const health=require('./health');
const adapters=require('./providers');
const discovered=new Map();
const keyNames={groq:'GROQ_API_KEY',gemini:'GEMINI_API_KEY',openrouter:'OPENROUTER_API_KEY',local:'LOCAL_AI_API_KEY'};
const enabled=()=>!!process.env.MRSAAL_AI_MODEL_CHAIN?.trim();
function setting(name,fallback,min,max){const n=Number(process.env[name]);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
function configError(){return Object.assign(new Error('راجع إعداد MRSAAL_AI_MODEL_CHAIN في إعدادات الخادم.'),{code:'AI_UNAVAILABLE',status:503});}
function chain(){
 let rows;try{rows=JSON.parse(process.env.MRSAAL_AI_MODEL_CHAIN);}catch{throw configError();}
 if(!Array.isArray(rows)||!rows.length||rows.length>8)throw configError();
 const seen=new Set();return rows.map(row=>{
  if(!row||!Object.hasOwn(keyNames,row.provider)||typeof row.model!=='string'||!row.model.trim()||row.model.length>160||!/^[a-zA-Z0-9_/:.\-]+$/.test(row.model))throw configError();
  if(row.provider==='openrouter'&&row.model!=='openrouter/free'&&!row.model.endsWith(':free'))throw configError();
  if(row.timeoutMs!==undefined&&(!Number.isInteger(row.timeoutMs)||row.timeoutMs<3000||row.timeoutMs>30000))throw configError();
  return {provider:row.provider,model:row.model,timeoutMs:row.timeoutMs|| (row.provider==='local'?12000:10000)};
 }).filter(row=>{const id=row.provider+':'+row.model;if(seen.has(id))return false;seen.add(id);return true;});
}
function chooseModel(provider,rows){
 const ids=rows.map(row=>row.id);
 if(provider==='groq')return ['openai/gpt-oss-20b','llama-3.3-70b-versatile','llama-3.1-8b-instant'].find(id=>ids.includes(id));
 if(provider==='gemini')return ids.filter(id=>/flash/i.test(id)&&!/image|tts|live|audio|preview|experimental|exp-|thinking/i.test(id)).sort((a,b)=>(/lite/i.test(b)?1:0)-(/lite/i.test(a)?1:0)||b.localeCompare(a,undefined,{numeric:true}))[0];
 return null;
}
async function resolveModel(provider,key,model,deadline){
 if(model!=='auto')return model;
 const id=provider+':'+createHash('sha256').update(key).digest('hex');const cached=discovered.get(id);
 if(cached?.until>Date.now())return cached.model;
 const remaining=deadline-Date.now();if(remaining<1000)throw Object.assign(new Error('timeout'),{code:'TIMEOUT'});
 const rows=await adapters.listModels(provider,key,true,Math.min(4000,remaining));
 const selected=chooseModel(provider,rows);if(!selected)throw Object.assign(new Error('No suitable model'),{code:'MODEL_UNAVAILABLE'});
 if(discovered.size>100)discovered.clear();discovered.set(id,{model:selected,until:Date.now()+600000});return selected;
}
const safe=value=>String(value||'').replace(/[^a-zA-Z0-9_/:.\-]/g,'').slice(0,100);
async function callPlatformAI(prompt,maxTokens,validate,operationDeadline,userId){
 const rows=chain(),deadline=Math.min(operationDeadline||Infinity,Date.now()+setting('MRSAAL_AI_TOTAL_TIMEOUT_MS',45000,5000,90000));
 const failures=[];
 for(const row of rows){
  if(Date.now()>=deadline)break;
  const {provider}=row,key=process.env[keyNames[provider]]?.trim();let model=row.model;
  if(!key||(provider==='local'&&!process.env.LOCAL_AI_BASE_URL?.trim()))continue;
  const cooldown=health.available(provider,key,model);if(cooldown){failures.push({provider,model:safe(model),code:cooldown.code});continue;}
  const start=Date.now(),attemptDeadline=Math.min(deadline,start+row.timeoutMs);
  try{
   let text;
   if(provider==='local'){
    // CPU fallback must not re-process a huge cloud prompt for over a minute.
    if(prompt.length>5500)throw Object.assign(new Error('Local prompt too long'),{code:'AI_PROMPT_TOO_LONG'});
    text=await require('./local').callLocalAI(prompt,Math.min(maxTokens,1200),validate,attemptDeadline,userId);
   }else{
    model=await resolveModel(provider,key,model,attemptDeadline);
    const unavailable=health.available(provider,key,model);if(unavailable){failures.push({provider,model:safe(model),code:unavailable.code});continue;}
    const remaining=attemptDeadline-Date.now();if(remaining<=0)throw Object.assign(new Error('timeout'),{code:'TIMEOUT'});
    console.log('Mrsaal AI trying:',provider,safe(model));
    text=await adapters.generate(provider,key,model,prompt,Math.min(maxTokens,1600),remaining,{json:!!validate,fast:true});
    if(validate)text=require('./local').cleanEnvelope(text);
    if(typeof text!=='string'||!text.trim())throw Object.assign(new Error('empty'),{code:'EMPTY'});
    if(validate&&!validate(text))throw Object.assign(new Error('invalid format'),{code:'FORMAT'});
   }
   health.success(provider,key,model);console.log('Mrsaal AI succeeded:',JSON.stringify({provider,model:safe(model),elapsedMs:Date.now()-start}));return text;
  }catch(error){
   if(error.code==='AI_CANCELLED')throw error;
   const code=error.reason==='FORMAT'?'FORMAT':String(error.code||'UNKNOWN');
   health.failed(provider,key,model,code,error.retryAfterMs);
   if(row.model==='auto')discovered.delete(provider+':'+createHash('sha256').update(key).digest('hex'));
   failures.push({provider,model:safe(model),code});
   console.warn('Mrsaal AI failed:',JSON.stringify({provider,model:safe(model),code,elapsedMs:Date.now()-start}));
  }
 }
 throw Object.assign(new Error('تعذر تشغيل موديلات مرسال AI المتاحة. راجع حالة المنصات أو حاول لاحقًا.'),{code:'AI_UNAVAILABLE',status:503,failures});
}
module.exports={enabled,chain,chooseModel,callPlatformAI};
