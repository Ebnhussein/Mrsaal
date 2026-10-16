'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('crypto');
const plan=JSON.stringify([{provider:'groq',model:'auto'},{provider:'gemini',model:'auto'},{provider:'openrouter',model:'openrouter/free'},{provider:'local',model:'local-ai'}]);
function setup({generate,local,models,env:extra={}}={}){
 const calls=[],discovery=[],cache=new Map();let now=1000;
 const env={MRSAAL_AI_MODEL_CHAIN:plan,GROQ_API_KEY:'groq-secret',GEMINI_API_KEY:'google-secret',OPENROUTER_API_KEY:'router-secret',LOCAL_AI_API_KEY:'local-secret',LOCAL_AI_BASE_URL:'https://local.test/v1',...extra};
 const box={module:{exports:{}},process:{env},Date:{now:()=>now},console:{log(){},warn(){}},require:id=>{
  if(id==='crypto')return {createHash};
  if(id==='./ai-health')return {available:(p,k,m)=>cache.get(p+m),failed:(p,k,m,c)=>cache.set(p+m,{code:c}),success:(p,k,m)=>cache.delete(p+m)};
  if(id==='./ai-providers')return {listModels:async(p,k,free,timeout)=>{discovery.push({p,timeout});return models?models(p):[{id:p==='groq'?'openai/gpt-oss-20b':'gemini-3.1-flash-lite'}];},generate:async(...a)=>{calls.push(a);return generate?generate(...a):'{"body":"OK"}';}};
  if(id==='./ai-local')return {cleanEnvelope:t=>t.trim(),callLocalAI:async(...a)=>{calls.push(['local',...a]);return local?local(...a):'{"body":"LOCAL"}';}};
  throw Error(id);
 }};vm.runInNewContext(fs.readFileSync(require.resolve('../utils/ai-platform'),'utf8'),box);return {api:box.module.exports,calls,discovery,env,cache,tick:n=>now+=n};
}
const valid=t=>!!JSON.parse(t).body;
test('platform chain discovers a real model once, reuses it and never touches personal credentials',async()=>{
 const g=setup();assert.equal(await g.api.callPlatformAI('facts',1200,valid,50000,'user'),'{"body":"OK"}');assert.equal(g.calls[0][0],'groq');assert.equal(g.calls[0][2],'openai/gpt-oss-20b');assert.equal(g.calls[0][5],10000);assert.equal(g.calls[0][6].json,true);await g.api.callPlatformAI('facts2',1200,valid,50000,'user');assert.equal(g.discovery.length,1);
});
test('rate limits and invalid output move directly to a different provider; cooldown skips failed models',async()=>{
 const g=setup({generate:async p=>{if(p==='groq')throw Object.assign(Error('RAW SECRET'),{code:'RATE_LIMIT',status:429,retryAfterMs:60000});if(p==='gemini')return '{}';return '{"body":"router draft"}';}});
 assert.match(await g.api.callPlatformAI('facts',1000,valid,50000,'user'),/router draft/);assert.deepEqual(g.calls.map(a=>a[0]),['groq','gemini','openrouter']);g.calls.length=0;
 await g.api.callPlatformAI('facts',1000,valid,50000,'user');assert.deepEqual(g.calls.map(a=>a[0]),['openrouter']);
});
test('one shared deadline bounds provider attempts and preserves the original local adapter',async()=>{
 let g;g=setup({generate:async()=>{g.tick(10000);throw Object.assign(Error('slow'),{code:'TIMEOUT'});}});
 assert.match(await g.api.callPlatformAI('short facts',1200,valid,35000,'owner'),/LOCAL/);const call=g.calls.at(-1);assert.equal(call[0],'local');assert.equal(call[4],35000);assert.equal(call[5],'owner');
 const expired=setup();await assert.rejects(expired.api.callPlatformAI('facts',100,valid,900,'owner'),e=>e.code==='AI_UNAVAILABLE');assert.equal(expired.calls.length,0);
});
test('cancelled local requests never restart on another provider; long prompts are not sent to CPU fallback',async()=>{
 const g=setup({env:{MRSAAL_AI_MODEL_CHAIN:JSON.stringify([{provider:'local',model:'local-ai'},{provider:'groq',model:'auto'}])},local:async()=>{throw Object.assign(Error('cancelled'),{code:'AI_CANCELLED'});}});
 await assert.rejects(g.api.callPlatformAI('facts',100,valid,50000,'owner'),e=>e.code==='AI_CANCELLED');assert.equal(g.calls.length,1);
 const big=setup({env:{GROQ_API_KEY:'',GEMINI_API_KEY:'',OPENROUTER_API_KEY:''}});await assert.rejects(big.api.callPlatformAI('x'.repeat(5501),100,valid,50000,'owner'),e=>e.failures[0].code==='AI_PROMPT_TOO_LONG');assert.equal(big.calls.length,0);
});
test('missing keys skip providers; malformed or paid OpenRouter chains fail before a request',async()=>{
 const g=setup({env:{GROQ_API_KEY:'',GEMINI_API_KEY:'',OPENROUTER_API_KEY:''}});assert.match(await g.api.callPlatformAI('facts',100,valid,50000,'owner'),/LOCAL/);
 for(const value of ['no json','[]',JSON.stringify([{provider:'evil',model:'auto'}]),JSON.stringify([{provider:'openrouter',model:'paid/model'}]),JSON.stringify([{provider:'groq',model:'auto',timeoutMs:999999}])]){const b=setup({env:{MRSAAL_AI_MODEL_CHAIN:value}});await assert.rejects(b.api.callPlatformAI('p',10,null,50000),e=>e.code==='AI_UNAVAILABLE');assert.equal(b.calls.length,0);}
});
test('automatic Gemini selection excludes image, live and preview models and prefers stable Flash Lite',()=>{
 const g=setup();assert.equal(g.api.chooseModel('gemini',[{id:'gemini-3.1-flash-image'},{id:'gemini-4-pro'},{id:'gemini-3.1-flash-lite-preview'},{id:'gemini-2.5-flash-lite'},{id:'gemini-3.1-flash-lite'}]),'gemini-3.1-flash-lite');
});
test('platform chain respects existing one-credit operation and explicit personal source selection',async()=>{
 for(const source of ['mrsaal','personal']){
  const events=[],env={MRSAAL_AI_MODEL_CHAIN:plan,LOCAL_AI_BASE_URL:'https://local.test'};
  const deps={'./ai-legacy':{},'./writing-profile':require('../utils/writing-profile'),'./ai-platform':{callPlatformAI:async()=>{events.push('platform');return 'OK';}},'./ai-providers':{callUserAI:async()=>{events.push('personal');return 'OK';}},'./db':{get:async()=>({ai_source:source})},'./usage-limits':{reserve:async(u,k)=>{events.push(k);return 'credit';},commit:async()=>events.push('commit'),release:async()=>events.push('refund')},'./ai-leases':{acquire:async()=>1,release:async()=>events.push('released')}};
  const box={module:{exports:{}},process:{env},console,require:id=>deps[id]};vm.runInNewContext(fs.readFileSync(require.resolve('../utils/ai'),'utf8'),box);
  assert.equal(await box.module.exports.callGemini('facts',1200,null,null,null,'owner'),'OK');assert.deepEqual(events,source==='mrsaal'?['ai','platform','commit','released']:['personal_ai','personal','commit','released']);
 }
});

test('cloud transport sends JSON mode and low-reasoning options only when requested',async()=>{
 const requests=[];
 const box={module:{exports:{}},AbortSignal,process:{env:{}},require:id=>id==='./db'?{all:async()=>[]}:id==='./connection-secrets'?{}:require(path.resolve(__dirname,'../utils',id)),fetch:async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});return {ok:true,json:async()=>url.includes('googleapis')?{candidates:[{content:{parts:[{text:'{"body":"OK"}'}]},finishReason:'STOP'}]}:{choices:[{message:{content:'{"body":"OK"}'},finish_reason:'stop'}]}};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../utils/ai-providers'),'utf8'),box);
 await box.module.exports.generate('groq','secret','openai/gpt-oss-20b','JSON facts',1200,1000,{json:true,fast:true});assert.equal(requests[0].body.response_format.type,'json_object');assert.equal(requests[0].body.reasoning_effort,'low');
 await box.module.exports.generate('gemini','secret','gemini-test','JSON facts',1200,1000,{json:true});assert.equal(requests[1].body.generationConfig.responseMimeType,'application/json');
 await box.module.exports.generate('openrouter','secret','openrouter/free','JSON facts',1200,1000,{json:true,fast:true});assert.equal(requests[2].body.reasoning.enabled,false);
 await box.module.exports.generate('groq','secret','custom-model','facts',1200,1000);assert.equal(requests[3].body.response_format,undefined);assert.equal(requests[3].body.reasoning_effort,undefined);
});
