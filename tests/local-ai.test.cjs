'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
function load(file,deps,extra={}){const box={module:{exports:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:require(id),process:{env:{}},console:{log(){},warn(){}},URL,AbortController,setTimeout,clearTimeout,...extra};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),box);return box.module.exports;}
const env={LOCAL_AI_BASE_URL:'https://ai.ebnhussein.co/v1',LOCAL_AI_API_KEY:'server-only-key',LOCAL_AI_MODEL:'local-ai'};
function gateway({busy=false,throttle=false,data={choices:[{message:{content:'valid draft'},finish_reason:'stop'}],usage:{prompt_tokens:40,completion_tokens:10,total_tokens:50}},status=200,fetchImpl}={}){
 const queries=[],requests=[];const db={get:async(sql,args)=>{queries.push([sql,args]);if(sql.includes('local_ai_slots'))return busy?null:{token:args[2]};if(sql.includes('local_ai_windows'))return throttle?null:{amount:1};},run:async(sql,args)=>queries.push([sql,args])};
 const api=load('utils/ai-local.js',{'./db':db},{process:{env},fetch:async(url,opts)=>{requests.push({url,opts});if(fetchImpl)return fetchImpl(url,opts);return {ok:status===200,status,json:async()=>data};}});return {api,queries,requests};
}
test('local adapter keeps key server-side, pins endpoint/model, caps tokens, validates output and meters usage',async()=>{
 const g=gateway();assert.equal(await g.api.callLocalAI('CV facts',2400,t=>t==='valid draft',Date.now()+10000,'owner'),'valid draft');const r=g.requests[0];assert.equal(r.url,'https://ai.ebnhussein.co/v1/chat/completions');assert.equal(r.opts.redirect,'error');assert.equal(r.opts.headers.Authorization,'Bearer server-only-key');const body=JSON.parse(r.opts.body);assert.equal(body.model,'local-ai');assert.equal(body.max_tokens,1600);assert.equal(body.stream,false);const meter=g.queries.find(([sql])=>sql.includes('INSERT INTO local_ai_usage'));assert.deepEqual(Array.from(meter[1]),['owner',1,40,10,50]);assert(g.queries.some(([sql])=>sql.startsWith('DELETE FROM local_ai_slots')));
});
test('busy global slot and per-user rate cap reject before sending any upstream request',async()=>{
 for(const opts of [{busy:true},{throttle:true}]){const g=gateway(opts);await assert.rejects(g.api.callLocalAI('p',50,null,Date.now()+10000,'owner'),e=>e.status===429);assert.equal(g.requests.length,0);}
});
test('provider errors are safe and failed/invalid/truncated replies do not emit a draft',async()=>{
 const g=gateway({status:401,data:{error:{message:'sensitive raw provider key'}}});await assert.rejects(g.api.callLocalAI('p',50,null,Date.now()+10000,'owner'),e=>!e.message.includes('sensitive')&&e.code==='AI_UNAVAILABLE');
 for(const data of [{choices:[{message:{content:''}}]},{choices:[{finish_reason:'length',message:{content:'unfinished'}}]}]){const a=gateway({data});await assert.rejects(a.api.callLocalAI('p',50,null,Date.now()+10000,'owner'));assert(a.queries.some(([sql])=>sql.startsWith('DELETE')));}
 const a=gateway();await assert.rejects(a.api.callLocalAI('p',50,()=>false,Date.now()+10000,'owner'));
});
test('network failure retains slot until lease expiry and records unmetered attempt',async()=>{
 const g=gateway({fetchImpl:async()=>{throw new Error('secret network detail');}});await assert.rejects(g.api.callLocalAI('p',50,null,Date.now()+10000,'owner'),e=>!e.message.includes('secret'));assert(!g.queries.some(([sql])=>sql.startsWith('DELETE')));const meter=g.queries.find(([sql])=>sql.includes('INSERT INTO local_ai_usage'));assert.equal(meter[1][1],0);
});
test('expired deadline and oversized prompt never reach the gateway',async()=>{
 const g=gateway();await assert.rejects(g.api.callLocalAI('p',50,null,Date.now()-1,'owner'),e=>e.code==='TIMEOUT');await assert.rejects(g.api.callLocalAI('x'.repeat(50001),50,null,Date.now()+1000,'owner'),e=>e.status===400);assert.equal(g.requests.length,0);
});
function engine({source='mrsaal',fail=false}={}){
 const trace=[];const ai=load('utils/ai.js',{'./ai-legacy':{callGemini:async()=>{throw Error('legacy must not run');}},'./ai-local':{callLocalAI:async(...args)=>{trace.push(['local',args[4]]);if(fail)throw Error('offline');return 'OK';}},'./ai-providers':{callUserAI:async()=>{trace.push(['personal']);return 'PERSONAL';}},'./db':{get:async()=>({ai_source:source,ai_personal_fallback:false})},'./ai-leases':{acquire:async()=>1,release:async()=>trace.push(['lease-release'])},'./usage-limits':{reserve:async(u,kind)=>{trace.push(['reserve',kind]);return 'credit';},commit:async()=>trace.push(['commit']),release:async()=>trace.push(['refund'])},'./writing-profile':require('../utils/writing-profile')},{process:{env}});return {ai,trace};
}
test('default users use local platform with existing quota, while explicit personal choice is respected',async()=>{
 const e=engine();assert.equal(await e.ai.callGemini('p',100,null,null,null,'owner'),'OK');assert.deepEqual(e.trace,[['reserve','ai'],['local','owner'],['commit'],['lease-release']]);const personal=engine({source:'personal'});assert.equal(await personal.ai.callGemini('p',100,null,null,null,'owner'),'PERSONAL');assert(!personal.trace.some(t=>t[0]==='local'));assert(personal.trace.some(t=>t[0]==='reserve'&&t[1]==='personal_ai'));
});
test('failed local operation refunds draft credit and never silently falls back to external platform',async()=>{
 const e=engine({fail:true});await assert.rejects(e.ai.callGemini('p',100,null,null,null,'owner'));assert(e.trace.some(t=>t[0]==='refund'));assert(!e.trace.some(t=>t[0]==='commit'||t[0]==='personal'));
});
test('real PostgreSQL slots work across app instances, rate limits bind to owner and usage survives restart',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),pg=new PGlite();const db={get:async(s,p)=>(await pg.query(s,p)).rows[0],run:async(s,p)=>p?pg.query(s,p):pg.exec(s)};
 try{
 const schema=fs.readFileSync(require.resolve('../utils/db'),'utf8').match(/await query\(`([\s\S]*?)`\);/)[1];await pg.exec(schema);await load('utils/launch-schema.js',{'./db':db}).ensureLaunchSchema();await load('utils/launch-schema.js',{'./db':db}).ensureLaunchSchema();await pg.exec("INSERT INTO users(id) VALUES('owner'),('other')");
 let unblock,start;const started=new Promise(r=>start=r);const output={choices:[{message:{content:'OK'},finish_reason:'stop'}],usage:{prompt_tokens:20,completion_tokens:5,total_tokens:25}};
 const first=load('utils/ai-local.js',{'./db':db},{process:{env},fetch:async()=>{start();return new Promise(r=>unblock=()=>r({ok:true,json:async()=>output}));}});
 const other=load('utils/ai-local.js',{'./db':db},{process:{env},fetch:async()=>({ok:true,json:async()=>output})});
 const pending=first.callLocalAI('p',60,null,Date.now()+15000,'owner');await started;await assert.rejects(other.callLocalAI('p',60,null,Date.now()+15000,'other'),e=>e.status===429);unblock();assert.equal(await pending,'OK');
 await other.callLocalAI('p',60,null,Date.now()+15000,'owner');await other.callLocalAI('p',60,null,Date.now()+15000,'owner');await assert.rejects(other.callLocalAI('p',60,null,Date.now()+15000,'owner'),e=>e.status===429);
 await other.callLocalAI('p',60,null,Date.now()+15000,'other');assert.equal(Number((await db.get("SELECT requests FROM local_ai_usage WHERE user_id='owner'")).requests),3);assert.equal(Number((await db.get("SELECT total_tokens FROM local_ai_usage WHERE user_id='owner'")).total_tokens),75);assert.equal(Number((await db.get("SELECT requests FROM local_ai_usage WHERE user_id='other'")).requests),1);
 await pg.exec("DELETE FROM users WHERE id='owner'");assert.equal((await pg.query("SELECT * FROM local_ai_usage WHERE user_id='owner'")).rows.length,0);
 }finally{await pg.close();}
});
test('validated local output requests JSON mode and strips only complete thinking and Markdown envelope',async()=>{
 const g=gateway({data:{choices:[{message:{content:'<think>private reasoning</think>\n```json\n{"subject":"Hello","body":"Draft","notes":[],"needsUserInput":false}\n```'},finish_reason:'stop'}]}});
 const result=await g.api.callLocalAI('p',1200,text=>JSON.parse(text).body==='Draft',Date.now()+10000,'owner');assert.equal(JSON.parse(result).subject,'Hello');assert(!result.includes('think'));assert.equal(JSON.parse(g.requests[0].opts.body).response_format.type,'json_object');
 assert.equal(g.api.cleanEnvelope('<think>not complete'),'<think>not complete');
 const invalid=gateway({data:{choices:[{message:{content:'{"subject":"Only subject"}'},finish_reason:'stop'}]}});await assert.rejects(invalid.api.callLocalAI('p',100,t=>!!JSON.parse(t).body,Date.now()+10000,'owner'),e=>e.reason==='FORMAT');
});
test('local format retry stays within one quota reservation and preserves user content',async()=>{
 const calls=[],credits=[],draft={subject:'Hello',body:'Honest draft',notes:[],needsUserInput:false};
 const ai=load('utils/ai.js',{'./ai-legacy':{callGemini:async()=>{throw Error('legacy');}},'./ai-local':{callLocalAI:async(prompt)=>{calls.push(prompt);if(calls.length===1)throw Object.assign(new Error('format'),{reason:'FORMAT',code:'AI_UNAVAILABLE'});return JSON.stringify(draft);}},'./db':{get:async()=>({})},'./ai-leases':{acquire:async()=>1,release:async()=>{}},'./usage-limits':{reserve:async()=>{credits.push('reserve');return 'credit';},commit:async()=>credits.push('commit'),release:async()=>credits.push('refund')},'./writing-profile':require('../utils/writing-profile')},{process:{env}});
 const result=await ai.generateEmail({userId:'owner',cv:'Real CV facts',company:{name:'Company'}});assert.equal(result.body,'Honest draft');assert.equal(calls.length,2);assert(calls.every(p=>p.includes('Real CV facts')));assert(calls[1].includes('الحقلين المطلوبين'));assert(!calls[0].includes('المطلوب JSON فقط {"subject":"...","body":"..."}'));assert.deepEqual(credits,['reserve','commit']);
});
