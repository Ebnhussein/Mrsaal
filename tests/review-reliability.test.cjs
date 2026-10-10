'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
function load(file,deps,env={}){const box={module:{exports:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:require(id),process:{env},Date,console,Buffer,setTimeout,clearTimeout,AbortController};vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),box);return box.module.exports;}
function router(){const handlers={};const r={use(){}};for(const method of ['get','post','patch','delete'])r[method]=(url,...args)=>handlers[method+url]=args.at(-1);return {r,handlers};}
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(value){this.data=value;return this;}};}
test('companies invalid input is rejected and asynchronous DB rejection reaches Express middleware',async()=>{
 const {r,handlers}=router(),err=new Error('database unavailable');
 load('routes/companies.js',{express:{Router:()=>r},multer:Object.assign(()=>({single:()=>()=>{}}),{memoryStorage:()=>({})}),xlsx:{},'../utils/upload-files':{},uuid:{v4:()=> 'id'},'../middleware/auth':{requireAuth(){}},'../middleware/async-handler':require('../middleware/async-handler'),'../utils/db':{all:async()=>{throw err;}}});
 let caught;await handlers['get/']({session:{userId:'owner'}},response(),e=>caught=e);assert.equal(caught,err);
 for(const [route,body]of [['post/',{name:42}],['delete/',{ids:'company'}],['patch/',{ids:[],selected:'false'}]]){const res=response();await handlers[route]({session:{userId:'owner'},body},res,e=>{throw e;});assert.equal(res.statusCode,400);}
});
test('CV scheduled or uncertain use blocks deletion and always releases its transaction',async()=>{
 for(const status of ['pending','processing','uncertain']){
  const {r,handlers}=router(),trace=[];let released=false;
  const client={query:async(sql)=>{trace.push(sql);return {rows:sql.includes('FROM scheduled_jobs')?[{id:status}]:[],rowCount:0};},release(){released=true;}};
  load('routes/cv.js',{express:{Router:()=>r},multer:Object.assign(()=>({single:()=>()=>{}}),{memoryStorage:()=>({})}),'pdf-parse':()=>{},'../utils/upload-files':{},'../middleware/auth':{requireAuth(){}},'../middleware/async-handler':require('../middleware/async-handler'),'../utils/db':{pool:{connect:async()=>client}},'../utils/user-records':{}});
  const res=response();await handlers['delete/:id']({session:{userId:'owner'},params:{id:'cv'}},res,e=>{throw e;});assert.equal(res.statusCode,409);assert(trace[1].includes('FOR UPDATE'));assert(!trace.some(s=>s.startsWith('DELETE')));assert.equal(trace.at(-1),'ROLLBACK');assert(released);
 }
});
test('report cleanup keeps scheduled/processing/uncertain logs and job drafts with real SQL',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),pg=new PGlite();
 try{
 await pg.exec(`CREATE TABLE email_log(id TEXT,user_id TEXT,status TEXT);CREATE TABLE scheduled_jobs(user_id TEXT,log_id TEXT,status TEXT);CREATE TABLE delivery_attempts(user_id TEXT,log_id TEXT,status TEXT);
 INSERT INTO email_log VALUES('sent','owner','sent'),('pending','owner','scheduled'),('sending','owner','processing'),('unknown','owner','uncertain'),('pinned','owner','failed'),('other','other','sent');INSERT INTO scheduled_jobs VALUES('owner','pinned','pending');`);
 const src=fs.readFileSync(path.join(root,'routes/email.js'),'utf8');const sql=src.match(/DELETE FROM email_log e[\s\S]*?d.status IN \('processing','uncertain'\)\)/)[0];
 await pg.query(sql,['owner']);assert.deepEqual((await pg.query('SELECT id FROM email_log ORDER BY id')).rows.map(r=>r.id),['other','pending','pinned','sending','unknown']);
 }finally{await pg.close();}
});
test('AI personal fallback and review share the original deadline',async()=>{
 const deadlines=[];const draft={subject:'Hello',body:'Honest draft',notes:[],needsUserInput:false};
 const ai=load('utils/ai.js',{'./ai-legacy':{callGemini:async(...args)=>{deadlines.push(args[5]);throw Error('busy');}},'./ai-providers':{callUserAI:async(...args)=>{deadlines.push(args[4]);return JSON.stringify(draft);}},'./writing-profile':require('../utils/writing-profile'),'./db':{get:async()=>({ai_personal_fallback:true})},'./usage-limits':{reserve:async()=>1,commit:async()=>{},release:async()=>{}},'./ai-leases':{acquire:async()=>1,release:async()=>{}}},{AI_SECOND_PASS:'true',AI_TOTAL_TIMEOUT_MS:'30000'});
 await ai.generateEmail({userId:'owner',cv:'Developer',company:{name:'Company'}});assert(deadlines.length>=3);assert(deadlines.every(d=>d===deadlines[0]));assert(deadlines[0]>Date.now());assert(deadlines[0]<=Date.now()+30000);
});
test('legacy daily quota cooldown keeps QUOTA and provider reset time; cached failure is explained',async()=>{
 const failed=[],key='test-key';let calls=0;
 const ai=load('utils/ai-legacy.js',{'@google/genai':{GoogleGenAI:class{constructor(){this.models={generateContent:async()=>{calls++;throw Object.assign(new Error('daily quota'),{status:429,code:'QUOTA',retryAfterMs:180000});}};}}},'./ai-retry':require('../utils/ai-retry'),'./ai-health':{available:()=>calls?{code:'QUOTA'}:null,success(){},failed:(...args)=>failed.push(args)}},{GEMINI_API_KEY:key,AI_MODEL_CHAIN:JSON.stringify([{provider:'gemini',model:'example'}])});
 await assert.rejects(ai.callGemini('prompt'));assert.equal(failed[0][3],'QUOTA');assert.equal(failed[0][4],180000);await assert.rejects(ai.callGemini('prompt'),/فترة انتظار/);assert.equal(calls,1);
});
test('expired AI budget starts no provider request',async()=>{
 let calls=0;const ai=load('utils/ai-legacy.js',{'@google/genai':{GoogleGenAI:class{constructor(){calls++;}}},'./ai-retry':require('../utils/ai-retry'),'./ai-health':{}},{GEMINI_API_KEY:'test'});
 await assert.rejects(ai.callGemini('prompt',1200,null,null,null,Date.now()-1),e=>e.code==='TIMEOUT');assert.equal(calls,0);
});
test('campaign AI failure returns the safe provider hint and restores editable draft',async()=>{
 const {r,handlers}=router(),updates=[];
 const error=Object.assign(new Error('انتهت مهلة الرد. جرّب موديلًا أسرع.'),{code:'AI_UNAVAILABLE'});
 load('routes/campaigns.js',{express:{Router:()=>r},'../middleware/auth':{requireAuth(){}},'../middleware/async-handler':require('../middleware/async-handler'),'../utils/db':{get:async(sql)=>sql.includes('FROM campaigns')?{id:'campaign',cv_id:'cv',channel:'email'}:sql.includes('FROM campaign_items')?{id:'item',company_id:'company'}:sql.includes('FROM companies')?{id:'company'}:null,run:async(sql)=>{updates.push(sql);return {rowCount:1};}},'../utils/cv-store':{active:async()=>({content:'Developer'})},'../utils/ai':{generate:async()=>{throw error;}}});
 const res=response();await handlers['post/:id/items/:item/generate']({params:{id:'campaign',item:'item'},session:{userId:'owner'}},res,e=>{throw e;});assert.equal(res.statusCode,503);assert.equal(res.data.code,'AI_UNAVAILABLE');assert.equal(res.data.error,error.message);assert(updates.at(-1).includes("status='draft'"));
});
