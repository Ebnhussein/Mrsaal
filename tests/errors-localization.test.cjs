'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const errors=require('../utils/public-errors'),{gmailError}=require('../utils/gmail/errors');
const arabic=/[\u0600-\u06ff]/;
function request(lang,path='/api/email/send'){return {path,method:'POST',get:name=>name==='X-Mrsaal-Language'?lang:null};}
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},vary(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
test('all declared API validation translations round trip without changing user content',()=>{
 for(const [ar,en]of Object.entries(require('../utils/error-translations.json'))){assert(!arabic.test(en),en);assert.equal(errors.translate(ar,'en'),en);assert.equal(require('../utils/error-translations.json')[errors.translate(en,'ar')],en);}
 assert.equal(errors.language(request('en')),'en');assert.equal(errors.language(request('ar')),'ar');
});
test('Gmail refresh, disabled API, missing scopes, invalid request and quota have distinct safe causes',()=>{
 const samples=[['invalid_grant',400,'GMAIL_RECONNECT'],['invalid_client',400,'GMAIL_CONFIG'],[{errors:[{reason:'insufficientPermissions'}]},403,'GMAIL_PERMISSIONS'],[{errors:[{reason:'userRateLimitExceeded'}]},403,'GMAIL_LIMIT'],[{errors:[{reason:'invalidArgument'}]},400,'GMAIL_BAD_REQUEST']];
 for(const [data,status,code]of samples){const e=gmailError(Object.assign(new Error('private provider payload'),{response:{status,data:{error:data}}}));assert.equal(e.code,code);assert(!errors.describe(e,'en').error.includes('private'));assert(!arabic.test(errors.describe(e,'en').error));assert(arabic.test(errors.describe(e,'ar').error));}
 assert.equal(gmailError(new Error('Gmail API has not been used in project 123')).code,'GMAIL_API_DISABLED');
});
test('JSON interception localizes errors in protected dialogs and includes a correlation ID',()=>{
 const middleware=require('../middleware/api-errors'),req=request('en'),res=response();middleware.locale(req,res,()=>{});res.status(409).json({error:'اختار أو أعد ربط حساب Gmail من قنوات التواصل.',code:'GMAIL_ACCOUNT_REQUIRED'});
 assert.match(res.body.error,/reconnect a Gmail/);assert.equal(res.body.code,'GMAIL_ACCOUNT_REQUIRED');assert.match(res.body.requestId,/^[\da-f-]{36}$/);assert.equal(res.headers['X-Request-ID'],res.body.requestId);
 const draft='رسالة المستخدم لا يجب ترجمتها';res.status(200).json({subject:'بالعربي',body:draft,items:[{status:'skipped',reason:'تخطي: لا يوجد إيميل صالح للشركة',body:draft}]});assert.equal(res.body.body,draft);assert.equal(res.body.items[0].body,draft);assert.match(res.body.items[0].reason,/Skipped/);
});
test('unexpected exceptions never expose stack, SQL, keys or provider payloads',()=>{
 const source=fs.readFileSync(require.resolve('../middleware/api-errors'),'utf8'),logs=[];
 const box={module:{exports:{}},require:id=>id==='crypto'?require('crypto'):id==='../utils/public-errors'?errors:{gmailError},console:{error:(...a)=>logs.push(a)}};vm.runInNewContext(source,box);
 const req=request('en'),res=response();box.module.exports.locale(req,res,()=>{});box.module.exports.handler(new Error('password=secret SELECT * FROM users; sk-private'),req,res,()=>{});
 assert.equal(res.statusCode,500);assert.equal(res.body.code,'INTERNAL');assert(!JSON.stringify(res.body).includes('secret'));assert(!JSON.stringify(logs).includes('sk-private'));assert(!arabic.test(res.body.error));
});
test('provider failure chain preserves sanitized model reasons in both languages',()=>{
 const e={code:'AI_UNAVAILABLE',status:503,failures:[{provider:'openrouter',model:'model:free',code:'QUOTA'},{provider:'gemini',model:'fast',code:'TRUNCATED'},{provider:'attacker',model:'sk-secret',code:'AUTH'}]};
 const en=errors.describe(e,'en'),ar=errors.describe(e,'ar');assert.match(en.error,/quota is exhausted/);assert.match(en.error,/cut off/);assert(!en.error.includes('sk-secret'));assert(!arabic.test(en.error));assert(arabic.test(ar.error));
 const req=request('en'),res=response();require('../middleware/api-errors').locale(req,res,()=>{});res.status(503).json({...en});assert.match(res.body.error,/quota is exhausted/);
});
function ai(env,call){const file=require.resolve('../utils/ai/index'),box={module:{exports:{}},process:{env},console,require:id=>id==='./writing-profile'?require('../utils/ai/writing-profile'):id==='./gemini-direct'?{callGemini:call}:id==='./local'?{callLocalAI:call}:require(path.resolve(path.dirname(file),id))};vm.runInNewContext(fs.readFileSync(file,'utf8'),box);return box.module.exports;}
test('unapproved long CV fails before upstream generation; approved facts replace full CV',async()=>{
 const calls=[],engine=ai({LOCAL_AI_BASE_URL:'https://model.test/v1'},async prompt=>{calls.push(prompt);return JSON.stringify({subject:'Application',body:'I am interested in a suitable opportunity.'});});
 const args={cv:'FULL_PRIVATE_CV '.repeat(600),company:{name:'Company'}};
 await assert.rejects(engine.generateEmail(args),e=>e.code==='AI_CV_SUMMARY_REQUIRED'&&e.status===422);assert.equal(calls.length,0);
 await engine.generateEmail({...args,cvSummary:'Approved facts: JavaScript developer.'});assert.equal(calls.length,1);assert(!calls[0].includes('FULL_PRIVATE_CV'));assert(calls[0].includes('Approved facts'));assert(calls[0].length<=5500);
});
test('personal AI keeps full factual source, and local drafts do not run a second review request',async()=>{
 const calls=[],env={LOCAL_AI_BASE_URL:'https://model.test/v1',AI_SECOND_PASS:'true'};const engine=ai(env,async p=>{calls.push(p);return JSON.stringify({subject:'Application',body:'Reviewed message'});});
 await engine.generateEmail({cv:'Approved short facts',company:{name:'Company'}});assert.equal(calls.length,1);
 const p=require('../utils/ai/writing-profile').defaults();p.instructions='a'.repeat(4000);p.examples=['b'.repeat(3000),'c'.repeat(3000)];p.whatsapp.template='UNRELATED '.repeat(500);
 const compact=engine.compactContext(engine.context({cv:'FACT',company:{},instructions:require('../utils/ai/writing-profile').encode(p)},'email'));
 assert.equal(compact.facts.cv,'FACT');assert(compact.style.instructions.length<=500);assert.equal(compact.style.examples.length,1);assert(!JSON.stringify(compact).includes('UNRELATED'));
});
test('browser language travels with fetch, JSON and multipart but never external providers',async()=>{
 const calls=[],window={fetch:async(...args)=>calls.push(args)},document={documentElement:{lang:'en',dataset:{}}},location={href:'https://mrsaal.test/app',origin:'https://mrsaal.test',search:''};
 const context={window,document,location,localStorage:{getItem(){return null;}},matchMedia:()=>({matches:false}),Headers,Request,URL,URLSearchParams};vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/theme-init.js'),'utf8'),context);
 await window.fetch('/api/email/send',{method:'POST',headers:{'X-Test':'keep'}});assert.equal(calls[0][1].headers.get('X-Mrsaal-Language'),'en');assert.equal(calls[0][1].headers.get('X-Test'),'keep');
 document.documentElement.lang='ar';await window.fetch('/api/cv/upload',{method:'POST',body:'multipart'});assert.equal(calls[1][1].headers.get('X-Mrsaal-Language'),'ar');assert.equal(calls[1][1].headers.get('Content-Type'),null);
 await window.fetch('https://external.test/api',{headers:{'X-Test':'external'}});assert.equal(calls[2][1].headers['X-Mrsaal-Language'],undefined);
 assert(arabic.test(window.MrsaalErrors.network(true)));document.documentElement.lang='en';assert(!arabic.test(window.MrsaalErrors.network(true)));
});
test('reply failures back off and log safe reasons without repeated provider calls for every thread',async()=>{
 const filename=require.resolve('../utils/gmail/reply-tracker'),logs=[],writes=[];let requests=0;
 const oauthError=Object.assign(new Error('private token must never be logged'),{response:{status:400,data:{error:'invalid_grant'}}});
 const deps={googleapis:{google:{gmail:()=>({users:{threads:{get:async()=>{requests++;throw oauthError;}}}})}},'../db':{all:async()=>Array.from({length:20},(_,i)=>({id:'log'+i,user_id:'owner',thread_id:'thread'+i,sender_account_id:'account'})),run:async(sql,args)=>writes.push({sql,args})},'./client':{buildAuthClient:()=>({})},'./accounts':{resolveAccount:async()=>({email:'sender@example.test'})}};
 const box={module:{exports:{}},Buffer,console:{warn:(...args)=>logs.push(args)},require:id=>Object.hasOwn(deps,id)?deps[id]:require(path.resolve(path.dirname(filename),id))};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),box);const result=await box.module.exports.syncReplies('owner');assert.equal(result.failed,20);assert.deepEqual([...result.failureCodes],['GMAIL_RECONNECT']);assert(requests<=2);assert.equal(logs.length,1);assert(!JSON.stringify(logs).includes('private token'));assert(writes.every(w=>w.sql.includes('+300')));
});
