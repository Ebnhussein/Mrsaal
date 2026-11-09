'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness({changed=false,cancelled=false,defer=false}={}){
 const state={sourceTabId:4,account:{id:'owner',email:'owner@example.test'}},calls=[],badges=[];let handler,releaseExtraction,stopped=false;const paused=new Promise(resolve=>{releaseExtraction=resolve;});
 const row={kind:'company',name:'Public Company',phone:'+201000000000'};
 const chrome={runtime:{id:'extension-id',getURL:p=>'chrome-extension://extension-id/'+p,onMessage:{addListener(fn){handler=fn;}}},action:{onClicked:{addListener(){}},setBadgeText:async data=>badges.push(data.text),setBadgeBackgroundColor:async()=>{}},sidePanel:{open:async()=>{}},tabs:{query:async()=>[{id:8}],get:async()=>({id:4,url:'https://maps.example.test/results'}),create:async()=>({id:8})},storage:{session:{get:async keys=>typeof keys==='string'?{[keys]:state[keys]}:{...state},set:async data=>Object.assign(state,data)}},scripting:{executeScript:async options=>{
  calls.push(options);
  if(options.files)return [{}];
  if(options.args?.[1]==='/api/discovery/import')return [{result:{ok:!changed,data:changed?{error:'Account changed'}:{companiesAdded:1,jobsAdded:0,duplicates:0}}}];
  if(options.args?.[1]==='/api/discovery/session')return [{result:{ok:true,data:{user:{id:'owner',email:'owner@example.test'}}}}];
  if(options.args?.[0]?.runId&&defer)await paused;
  if(!options.args){stopped=true;return [{}];}
  return [{result:{rows:cancelled?[]:[row],source:{url:'https://maps.example.test/results',adapter:'maps'},cancelled:cancelled||stopped}}];
 }}};
 const box={chrome,console,crypto:require('node:crypto').webcrypto};vm.runInNewContext(fs.readFileSync(require.resolve('../extensions/mrsaal-scraper/background.js'),'utf8'),box);
 const send=(message,sender={id:'extension-id',url:'chrome-extension://extension-id/panel.html'})=>new Promise(resolve=>{const result=handler(message,sender,resolve);if(result===false)resolve(null);});
 return {send,state,calls,badges,release:releaseExtraction};
}
test('worker only accepts its panel, imports to the connected session and stores a resumable result',async()=>{
 const h=harness();assert.equal(await h.send({action:'collect'},{id:'extension-id',url:'https://attacker.test/'}),null);assert.equal(h.calls.length,0);
 const r=await h.send({action:'collect',limit:50,country:'EG'});assert(r.ok);assert.equal(h.state.phase,'complete');assert.equal(h.state.lastResult.companiesAdded,1);
 const upload=h.calls.find(c=>c.args?.[1]==='/api/discovery/import');assert.equal(upload.args[3].expectedUserId,'owner');assert.equal(upload.target.tabId,8);assert.equal(upload.args[3].source.country,'EG');
 assert(!JSON.stringify(h.calls).includes('/api/email'));assert(!JSON.stringify(h.calls).includes('/api/campaigns'));
});
test('cancellation does not import partial results and changed sessions fail without silent reconnect',async()=>{
 const stopped=harness({cancelled:true});assert((await stopped.send({action:'collect'})).data.stopped);assert(!stopped.calls.some(c=>c.args?.[1]==='/api/discovery/import'));
 const changed=harness({changed:true});assert.equal((await changed.send({action:'collect'})).ok,false);assert.equal(changed.state.phase,'failed');assert.equal(changed.state.account.id,'owner');
});

test('live progress is bound to the active run and source tab, never accepts stale or decreasing counters',async()=>{
 const h=harness({defer:true});
 assert.equal(await h.send({event:'collection-progress',progress:{stage:'scanning',count:1}}),null);
 const work=h.send({action:'collect',limit:10});
 while(!h.calls.some(c=>c.args?.[0]?.runId))await new Promise(setImmediate);
 const run=h.calls.find(c=>c.args?.[0]?.runId).args[0];
 assert.equal(run.autoScroll,true);
 const progress={event:'collection-progress',runId:run.runId,progress:{stage:'scrolling',count:1,limit:999,latest:['Company']}};
 assert.equal(await h.send(progress,{id:'extension-id',tab:{id:99}}),null);
 assert.equal(await h.send({...progress,runId:'stale'},{id:'extension-id',tab:{id:4}}),null);
 assert((await h.send(progress,{id:'extension-id',tab:{id:4}})).ok);
 assert.equal(h.state.progress.count,1);assert.equal(h.state.progress.limit,10);assert.equal(h.badges.at(-1),'1');
 assert.equal(await h.send({...progress,progress:{stage:'waiting',count:0}},{id:'extension-id',tab:{id:4}}),null);
 assert.equal((await h.send({action:'collect'})).ok,false);
 h.release();assert((await work).ok);
 assert.equal(await h.send(progress,{id:'extension-id',tab:{id:4}}),null);
});
test('stop targets the running source even if the selected source changes, and cancellation saves nothing',async()=>{
 const h=harness({defer:true});const work=h.send({action:'collect'});
 while(!h.calls.some(c=>c.args?.[0]?.runId))await new Promise(setImmediate);
 h.state.sourceTabId=99;await h.send({action:'stop'});assert.equal(h.calls.at(-1).target.tabId,4);
 h.release();assert((await work).data.stopped);assert(!h.calls.some(c=>c.args?.[1]==='/api/discovery/import'));
});
