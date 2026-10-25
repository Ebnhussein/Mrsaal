'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const parse=require('../utils/delivery/schedule-time').parse;
const frozen=Date.now();
function fixedDate(now){return class extends Date{static now(){return now();}};}
function browser({lang='ar',now=()=>frozen,value=new Date(frozen+60000).toISOString()}={}){
 const f={value},reported=[],window={MrsaalValidation:{check(rules){reported.push(rules[0]);return rules[0].test(f);},error(field,msg){reported.push({field,message:msg});},focus(){}}},box={window,document:{documentElement:{lang},getElementById:()=>f},Date:fixedDate(now)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/schedule-time.js'),'utf8'),box);return {api:window.MrsaalSchedule,f,reported};
}
test('server distinguishes expired/malformed dates, permits only future schedules and preserves explicit offsets',()=>{
 assert.throws(()=>parse(new Date(Date.now()-1).toISOString()),e=>e.status===400&&e.code==='SCHEDULE_TIME_PAST');
 for(const value of ['bad-date',false,0,{},[]])assert.throws(()=>parse(value),e=>e.code==='SCHEDULE_TIME_INVALID');
 assert.equal(parse(null),null);assert.equal(parse(''),null);
 const future=new Date(Date.now()+60000).toISOString();assert.equal(parse(future),future);
});
test('date that was valid when editing began is rejected at submission, and correcting it preserves the form',()=>{
 let now=frozen;const b=browser({now:()=>now});assert(b.api.read(b.f).valid);now+=120000;assert.equal(b.api.read(b.f).valid,false);assert.match(b.reported.at(-1).message,/موعد الجدولة عدى/);b.f.value=new Date(now+60000).toISOString();assert(b.api.read(b.f).valid);
 const en=browser({lang:'en',value:new Date(frozen-1000).toISOString()});assert.equal(en.api.read(en.f).valid,false);assert.match(en.reported[0].message,/scheduled time has passed/);assert(!/[\u0600-\u06ff]/.test(en.reported[0].message));
 assert.equal(browser({value:''}).api.read({value:''},{required:true}).valid,false);
});
test('browser sends an unambiguous UTC instant for a Cairo datetime-local value',()=>{
 const {execFileSync}=require('node:child_process');const source=fs.readFileSync(require.resolve('../public/assets/schedule-time.js'),'utf8');
 const code=`const vm=require('node:vm');const window={};vm.runInNewContext(${JSON.stringify(source)},{window,Date:class extends Date{static now(){return Date.parse('2026-10-16T10:00:00Z')}},document:{documentElement:{lang:'en'}}});console.log(window.MrsaalSchedule.read({value:'2026-10-16T19:00'},{report:false}).scheduledAt)`;
 assert.equal(execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:'Africa/Cairo'},encoding:'utf8'}).trim(),'2026-10-16T16:00:00.000Z');
});
test('single-message confirmation does not send or mark a company failed if time passes during autosave',async()=>{
 const source=fs.readFileSync(require.resolve('../public/assets/app.js'),'utf8'),code=source.slice(source.indexOf('async function confirmSend()'),source.indexOf('async function skipCo()'));
 let valid=true,sends=0,flushes=0;const nodes=new Map(['btn-confirm','preview-channel','prev-send-status','prev-body','prev-subject'].map(id=>[id,{disabled:false,value:'text',style:{}}]));
 const context={window:{MrsaalValidation:{check:()=>true}},document:{getElementById:id=>nodes.get(id)},readPreviewSchedule:()=>({valid,scheduledAt:new Date(frozen+60000).toISOString()}),cvLabel:a=>a,previewChannel:'email',previewCompanyId:'co',flushPreviewDraft:async()=>{flushes++;valid=false;},api:async()=>{sends++;},companies:[{id:'co',status:'pending'}],previewBatchActive:false};
 vm.runInNewContext(code,context);await context.confirmSend();assert.equal(flushes,1);assert.equal(sends,0);assert.equal(nodes.get('btn-confirm').disabled,false);assert.equal(context.companies[0].status,'pending');
 await context.confirmSend();assert.equal(flushes,1);assert.equal(sends,0);
});
test('scheduler revalidates after waiting for the user lock and creates no rows when the time expires',async()=>{
 let now=frozen;const statements=[];const filename=require.resolve('../utils/delivery/schedule-send');
 const scheduleTime={parse(value){const ts=Date.parse(value);if(ts<=now)throw Object.assign(new Error('Expired'),{code:'SCHEDULE_TIME_PAST',status:400});return new Date(ts).toISOString();}};
 const client={async query(sql){statements.push(sql);if(sql.startsWith('SELECT id FROM users'))now+=120000;return {rows:[]};},release(){}};
 const box={module:{exports:{}},require:id=>id==='../db'?{pool:{connect:async()=>client}}:id==='./schedule-time'?scheduleTime:createRequire(filename)(id),Date:fixedDate(()=>now)};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),box);
 await assert.rejects(box.module.exports.schedule('u',{company:{id:'c'},channel:'email',body:'Draft',scheduledAt:new Date(frozen+60000).toISOString(),idempotencyKey:'valid-key'}),e=>e.code==='SCHEDULE_TIME_PAST');
 assert(statements.includes('ROLLBACK'));assert(!statements.some(s=>s.startsWith('INSERT')));
});
test('expired schedule error is clear and retains its machine code in both languages',()=>{
 const errors=require('../utils/public-errors');for(const lang of ['ar','en']){const e=errors.describe({code:'SCHEDULE_TIME_PAST',status:400},lang);assert.equal(e.code,'SCHEDULE_TIME_PAST');assert.match(e.error,lang==='en'?/scheduled time has passed/:/موعد الجدولة عدى/);}
});
