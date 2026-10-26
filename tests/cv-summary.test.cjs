'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const summary=require('../utils/cv/summary');
test('extractive candidate never invents facts, is bounded, and never bypasses approval or source invalidation',()=>{
 const lines=Array.from({length:100},(_,i)=>'Experience '+i+': JavaScript project '+i);const content=lines.join('\n');const candidate=summary.propose(content);assert(candidate.length<=1800);assert(candidate.split('\n').every(line=>lines.includes(line)));
 const cv={content,ai_summary:candidate,ai_summary_source_hash:summary.hash(content)};assert.equal(summary.approved(cv),'');cv.ai_summary_approved_at=new Date();assert.equal(summary.approved(cv),candidate);cv.content+=' changed';assert.equal(summary.approved(cv),'');
 assert.throws(()=>summary.validate(candidate,false));assert.throws(()=>summary.validate('x'.repeat(1801),true));assert.equal(summary.validate('Confirmed CV facts: JavaScript developer.',true),'Confirmed CV facts: JavaScript developer.');
});
function load(file,deps,extra={}){const box={module:{exports:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:require(id),process:{env:{}},console,Buffer,...extra};vm.runInNewContext(fs.readFileSync(require.resolve('../'+file),'utf8'),box);return box.module.exports;}
test('summary routes bind owner/version and source hash, persist approval and reset without changing PDF',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),pg=new PGlite();
 const db={get:async(s,p)=>(await pg.query(s,p)).rows[0],all:async(s,p)=>(await pg.query(s,p)).rows,run:async(s,p)=>p?pg.query(s,p):pg.exec(s)};
 try{
  const base=fs.readFileSync(require.resolve('../utils/db'),'utf8').match(/await query\(`([\s\S]*?)`\);/)[1];await pg.exec(base);await load('utils/launch-schema.js',{'./db':db}).ensureLaunchSchema();await load('utils/launch-schema.js',{'./db':db}).ensureLaunchSchema();
  const source='Ahmed is a JavaScript developer. No other experience is listed.';await pg.exec("INSERT INTO users(id) VALUES('owner'),('other')");await pg.query('INSERT INTO cv_profiles(id,user_id,content,pdf_data) VALUES($1,$2,$3,$4)',['cv','owner',source,Buffer.from('%PDF-original')]);
  const store=load('utils/cv/store.js',{'../db':db,'../usage/resources':require('../utils/usage/resources')});const handlers={};const router={use(){},get(p,...h){handlers['GET '+p]=h.at(-1);},post(p,...h){handlers['POST '+p]=h.at(-1);},delete(){}};const multer=()=>({single:()=>()=>{}});multer.memoryStorage=()=>({});
  load('routes/cv.js',{express:{Router:()=>router},multer,'pdf-parse':{},'../utils/upload-files':{},'../middleware/auth':{requireAuth(){}},'../middleware/async-handler':f=>f,'../utils/db':db,'../utils/user-records':{},'../utils/cv/store':store,'../utils/cv/summary':summary});
  async function invoke(method,user,body={},query={}){const res={statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};await handlers[method]({session:{userId:user},body,query},res);return res;}
  const info=(await invoke('GET /summary','owner',{}, {cvId:'cv'})).body;assert.equal(info.approved,false);
  assert.equal((await invoke('GET /summary','other',{}, {cvId:'cv'})).statusCode,404);
  const payload={cvId:'cv',text:source,approved:true,sourceHash:info.sourceHash};assert.equal((await invoke('POST /summary','other',payload)).statusCode,404);
  assert.equal((await invoke('POST /summary','owner',{...payload,sourceHash:'stale'})).statusCode,409);
  await assert.rejects(invoke('POST /summary','owner',{...payload,approved:false}));await invoke('POST /summary','owner',payload);
  const row=await store.active('owner','cv');assert.equal(summary.approved(row),source);assert.equal(Buffer.from(row.pdf_data).toString(),'%PDF-original');assert.equal(row.content,source);
  await invoke('POST /summary/reset','other',{cvId:'cv'});assert.equal(summary.approved(await store.active('owner','cv')),source);
  await invoke('POST /summary/reset','owner',{cvId:'cv'});assert.equal(summary.approved(await store.active('owner','cv')),'');assert.equal(Buffer.from((await store.active('owner','cv')).pdf_data).toString(),'%PDF-original');
 }finally{await pg.close();}
});
test('local generation uses approved summary and puts variable company after stable facts, personal keeps original',async()=>{
 const traces=[];const deps={'./writing-profile':require('../utils/ai/writing-profile'),'./gemini-direct':{},'./local':{callLocalAI:async(p)=>{traces.push(p);return JSON.stringify({subject:'Hello',body:'Draft'});}}};
 const ai=load('utils/ai/index.js',deps,{process:{env:{LOCAL_AI_BASE_URL:'https://example.test/v1'}}});
 await ai.generateEmail({cv:'ORIGINAL FULL CV',cvSummary:'APPROVED FACTS',company:{name:'First Company'}});assert(traces[0].includes('APPROVED FACTS'));assert(!traces[0].includes('ORIGINAL FULL CV'));assert(traces[0].indexOf('APPROVED FACTS')<traces[0].indexOf('First Company'));
 await ai.generateEmail({cv:'ORIGINAL FULL CV',company:{name:'Second Company'}});assert(traces[1].includes('ORIGINAL FULL CV'));
 const calls=[];const personal=load('utils/ai/index.js',{'./writing-profile':require('../utils/ai/writing-profile'),'./gemini-direct':{},'./providers':{callUserAI:async(u,p)=>{calls.push(p);return JSON.stringify({subject:'Hello',body:'Draft'});}}},{process:{env:{LOCAL_AI_BASE_URL:'https://example.test/v1'}}});
 await personal.generateEmail({userId:'owner',cv:'ORIGINAL FULL CV',cvSummary:'APPROVED FACTS',company:{name:'Company'},_aiOperation:{source:'personal',deadline:Date.now()+90000}});assert(calls[0].includes('ORIGINAL FULL CV'));assert(!calls[0].includes('APPROVED FACTS'));
});
