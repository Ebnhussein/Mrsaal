'use strict';
const {all}=require('./db');const {unseal}=require('./connection-secrets');
const PROVIDERS={gemini:{name:'Google Gemini',base:'https://generativelanguage.googleapis.com/v1beta'},openrouter:{name:'OpenRouter',base:'https://openrouter.ai/api/v1'},openai:{name:'OpenAI',base:'https://api.openai.com/v1'},groq:{name:'Groq',base:'https://api.groq.com/openai/v1'}};
function provider(id){if(!Object.hasOwn(PROVIDERS,id)){const e=new Error('منصة غير مدعومة');e.status=400;throw e;}return PROVIDERS[id];}
async function request(id,key,path,body,timeout=30000){const p=provider(id);const headers=id==='gemini'?{'x-goog-api-key':key}:{Authorization:`Bearer ${key}`};headers['Content-Type']='application/json';let response;try{response=await fetch(p.base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)});}catch{throw new Error('تعذر الاتصال بالمنصة أو انتهت مهلة الطلب.');}const data=await response.json().catch(()=>null);if(!response.ok||data?.error){const e=new Error(`المنصة رفضت الطلب (${response.status}). راجع المفتاح والصلاحيات والرصيد والموديل.`);e.status=response.status;throw e;}if(!data)throw new Error('رد غير صالح من المنصة');return data;}
function usable(id,m){if(id==='gemini')return m.supportedGenerationMethods?.includes('generateContent');if(id==='openrouter')return !m.architecture?.output_modalities||m.architecture.output_modalities.includes('text');if(id==='openai')return /^(gpt-|chatgpt-|o[134](?:-|$))/.test(m.id)&&!/audio|realtime|transcrib|tts|image|codex|search|pro|deep-research/.test(m.id);return !/whisper|tts|guard|embedding/.test(m.id)&&m.active!==false;}
async function listModels(id,key,freeOnly=true){
 provider(id);if(typeof key!=='string'||!key.trim())throw new Error('أضف مفتاح المنصة أولًا');let rows=[];
 if(id==='gemini'){let next='';for(let page=0;page<20;page++){const data=await request(id,key,'/models?pageSize=100'+(next?'&pageToken='+encodeURIComponent(next):''));rows.push(...(data.models||[]));next=data.nextPageToken;if(!next)break;}}
 else{if(id==='openrouter')await request(id,key,'/key');const data=await request(id,key,'/models');rows=data.data||[];}
 const result=rows.filter(m=>usable(id,m)).map(m=>({id:id==='gemini'?m.name.replace(/^models\//,''):m.id,name:m.displayName||m.name||m.id,free:id==='openrouter'?(Number(m.pricing?.prompt)===0&&Number(m.pricing?.completion)===0):null})).filter(m=>m.id&&(!freeOnly||id!=='openrouter'||m.free));
 if(id==='openrouter'&&!result.some(m=>m.id==='openrouter/free'))result.push({id:'openrouter/free',name:'اختيار تلقائي من الموديلات المجانية',free:true});
 return result.sort((a,b)=>a.id.localeCompare(b.id));
}
async function generate(id,key,model,prompt,maxTokens=1200,timeout=30000){
 let text,finish;
 if(id==='gemini'){const data=await request(id,key,'/models/'+encodeURIComponent(model)+':generateContent',{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:maxTokens}},timeout);const c=data.candidates?.[0];text=c?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('');finish=c?.finishReason;}
 else if(id==='openai'){const data=await request(id,key,'/responses',{model,input:prompt,max_output_tokens:maxTokens,store:false},timeout);text=data.output?.filter(o=>o.type==='message').flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');finish=data.status==='incomplete'?'length':data.status;}
 else{const data=await request(id,key,'/chat/completions',{model,messages:[{role:'user',content:prompt}],max_tokens:maxTokens,stream:false},timeout);text=data.choices?.[0]?.message?.content;finish=data.choices?.[0]?.finish_reason;}
 if(finish==='length'||finish==='MAX_TOKENS'||typeof text!=='string'||!text.trim())throw new Error('الموديل لم يرجع نصًا مكتملًا. جرّب موديلًا آخر.');return text.trim();
}
async function callUserAI(userId,prompt,maxTokens,validate){
 const rows=await all('SELECT * FROM ai_connections WHERE user_id=$1 AND enabled=true ORDER BY priority,provider',[userId]);
 const chain=rows.flatMap(r=>(Array.isArray(r.selected_models)?r.selected_models:[]).map(model=>({row:r,model}))).slice(0,12);
 if(!chain.length)return null;const end=Date.now()+90000;
 for(const {row,model}of chain){if(Date.now()>=end)break;try{const text=await generate(row.provider,unseal(row.credentials).key,model,prompt,maxTokens,Math.min(30000,end-Date.now()));if(validate&&!validate(text))continue;return text;}catch(e){console.warn('User AI provider failed:',row.provider,e.status||0);}}
 throw new Error('الموديلات المختارة لم تنجح. راجع اختبار الاتصال والموديل والرصيد أو اختر بديلًا.');
}
module.exports={PROVIDERS,provider,listModels,generate,callUserAI,usable};
