'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness({changed=false,cancelled=false,defer=false,verifyFails=false,autoSearch=false,details=false,permissionGranted=true,panelFails=false}={}){
 const state={sourceTabId:4,account:{id:'owner',email:'owner@example.test'}},calls=[],badges=[],requests=[],opened=[],panelCalls=[];let handler,releaseExtraction,stopped=false;const paused=new Promise(resolve=>{releaseExtraction=resolve;});
 const local={};let rejectProof=verifyFails;
 const row={kind:'company',name:'Public Company',phone:'+201000000000'};
 const chrome={runtime:{id:'extension-id',getManifest:()=>({version:'0.5.0'}),getURL:p=>'chrome-extension://extension-id/'+p,onMessage:{addListener(fn){handler=fn;}}},action:{onClicked:{addListener(){}},setBadgeText:async data=>badges.push(data.text),setBadgeBackgroundColor:async()=>{}},permissions:{contains:async()=>true,request:async p=>{requests.push(p);return permissionGranted;}},sidePanel:{open:async p=>{panelCalls.push(p);if(panelFails)throw new Error('gesture not available');}},tabs:{query:async()=>[{id:8}],get:async id=>({id,url:details?'https://careers.example/jobs/1':autoSearch&&id===14?'https://www.google.com/search?q=jobs':'https://maps.example.test/results',status:'complete',active:false}),create:async data=>{opened.push(data);return {id:14,url:data.url,status:'complete',active:data.active!==false};},remove:async()=>{}},storage:{local:{get:async key=>({[key]:local[key]}),set:async data=>Object.assign(local,data),remove:async key=>{delete local[key];}},session:{get:async keys=>typeof keys==='string'?{[keys]:state[keys]}:{...state},set:async data=>Object.assign(state,data)}},scripting:{executeScript:async options=>{
  calls.push(options);
  if(options.files)return [{}];
  if(options.args?.[1]==='/api/discovery/import')return [{result:{ok:!changed,data:changed?{error:'Account changed'}:{companiesAdded:1,jobsAdded:0,duplicates:0,receiptId:'receipt-1',confirmed:true}}}];
  if(options.args?.[1]?.startsWith('/api/discovery/imports/'))return [{result:{ok:!rejectProof,data:rejectProof?{error:'Network interrupted'}:{verified:true,receipt:{id:'receipt-1',result:{companiesAdded:1,jobsAdded:0,duplicates:0,receiptId:'receipt-1',confirmed:true}}}}}];
  if(options.args?.[1]==='/api/discovery/session')return [{result:{ok:true,data:{user:{id:'owner',email:'owner@example.test'}}}}];
  if(options.args?.[0]?.runId&&defer)await paused;
  if(!options.args){if(details&&String(options.func).includes('.blocked(document)'))return [{result:{rows:[{kind:'job',title:'Developer',jobUrl:'https://careers.example/jobs/1',description:'Real posting content',entryType:'details'}]}}];stopped=true;return [{}];}
  return [{result:{rows:cancelled?[]:[row],source:{url:'https://maps.example.test/results',adapter:'maps'},cancelled:cancelled||stopped}}];
 }}};
 const box={chrome,console,URL,crypto:require('node:crypto').webcrypto};vm.runInNewContext(fs.readFileSync(require.resolve('../extensions/mrsaal-scraper/background.js'),'utf8'),box);
 const send=(message,sender={id:'extension-id',url:'chrome-extension://extension-id/panel.html'})=>new Promise(resolve=>{const result=handler(message,sender,resolve);if(result===false)resolve(null);});
 return {send,state,calls,badges,local,requests,opened,panelCalls,allowProof(){rejectProof=false;},release:releaseExtraction};
}
test('worker only accepts its panel, imports to the connected session and stores a resumable result',async()=>{
 const h=harness();assert.equal(await h.send({action:'collect'},{id:'extension-id',url:'https://attacker.test/'}),null);assert.equal(h.calls.length,0);
 const r=await h.send({action:'collect',limit:50,country:'EG'});assert(r.ok);assert.equal(h.state.phase,'complete');assert.equal(h.state.lastResult.companiesAdded,1);
 const upload=h.calls.find(c=>c.args?.[1]==='/api/discovery/import');assert.equal(upload.args[3].expectedUserId,'owner');assert.equal(upload.target.tabId,8);assert.equal(upload.args[3].source.country,'EG');
 assert(!JSON.stringify(h.calls).includes('/api/email'));assert(!JSON.stringify(h.calls).includes('/api/campaigns'));
});
test('cancellation does not import partial results and changed sessions fail without silent reconnect',async()=>{
 const stopped=harness({cancelled:true});assert((await stopped.send({action:'collect'})).data.stopped);assert(!stopped.calls.some(c=>c.args?.[1]==='/api/discovery/import'));
 const changed=harness({changed:true});assert.equal((await changed.send({action:'collect'})).ok,false);assert.equal(changed.state.phase,'save-pending');assert.equal(changed.state.account.id,'owner');
});

test('live progress is bound to the active run and source tab, never accepts stale or decreasing counters',async()=>{
 const h=harness({defer:true});
 assert.equal(await h.send({event:'collection-progress',progress:{stage:'scanning',count:1}}),null);
 const work=h.send({action:'collect',limit:10});
 for(let i=0;i<100&&!h.calls.some(c=>c.args?.[0]?.runId);i++)await new Promise(setImmediate);
 assert(h.calls.some(c=>c.args?.[0]?.runId),'collector started');
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
 for(let i=0;i<100&&!h.calls.some(c=>c.args?.[0]?.runId);i++)await new Promise(setImmediate);
 assert(h.calls.some(c=>c.args?.[0]?.runId),'collector started');
 h.state.sourceTabId=99;await h.send({action:'stop'});assert.equal(h.calls.at(-1).target.tabId,4);
 h.release();assert((await work).data.stopped);assert(!h.calls.some(c=>c.args?.[1]==='/api/discovery/import'));
});

test('a lost verification response keeps a durable batch and retry reuses the request key without scraping again',async()=>{
 const h=harness({verifyFails:true});assert.equal((await h.send({action:'collect'})).ok,false);assert.equal(h.state.phase,'save-pending');assert(h.local.pendingImport);assert(!h.state.lastResult?.confirmed);
 const key=h.local.pendingImport.requestKey,extractions=h.calls.filter(c=>c.files).length;h.allowProof();assert((await h.send({action:'retryImport'})).ok);assert.equal(h.state.phase,'complete');assert(h.state.lastResult.confirmed);assert.equal(h.local.pendingImport,undefined);assert.equal(h.calls.filter(c=>c.files).length,extractions);
 assert(h.calls.filter(c=>c.args?.[1]==='/api/discovery/import').every(c=>c.args[3].requestKey===key));
});

test('job search auto-collects the newly opened result tab without a toolbar click',async()=>{
 const h=harness({autoSearch:true});assert((await h.send({action:'search',url:'https://www.google.com/search?q=jobs',options:{country:'EG'}})).ok);assert.equal(h.state.phase,'complete');assert(h.calls.some(c=>c.files&&c.target.tabId===14));
});
test('posting details visit only saved candidate links, save extracted details and keep a confirmed receipt',async()=>{
 const h=harness({details:true});h.state.lastRows=[{kind:'job',title:'Developer',jobUrl:'https://careers.example/jobs/1',entryType:'link_only'}];h.state.lastSource={url:'https://www.google.com/search?q=jobs',adapter:'search',country:'EG'};const outcome=await h.send({action:'details'});assert(outcome.ok,JSON.stringify(outcome));const body=h.calls.find(c=>c.args?.[1]==='/api/discovery/import').args[3];assert.equal(body.rows[0].description,'Real posting content');assert.equal(body.rows[0].entryType,'details');assert(h.state.lastResult.confirmed);
});

const appSender={id:'extension-id',url:'https://mrsaal.ebnhussein.co/app#discovery',frameId:0,tab:{id:8,windowId:2}};
const launch={action:'launchFromApp',mode:'maps',query:'Media Buyer',country:'KW',city:'Kuwait City',workMode:'remote',limit:17,autoScroll:true,expectedAccountId:'owner',language:'en'};
test('website click binds its own account, requests Google, opens the panel and auto-collects Maps with all options',async()=>{
 const h=harness();const work=h.send(launch,appSender);
 assert.equal(h.panelCalls.length,1);assert.equal(h.requests.length,1); // before any awaited API lookup
 const r=await work;assert(r.ok,JSON.stringify(r));assert(r.data.panelOpened);
 assert(h.opened[0].url.startsWith('https://www.google.com/maps/search/'));assert(h.opened[0].url.includes('Kuwait%20City'));
 const run=h.calls.find(c=>c.args?.[0]?.runId).args[0];assert.equal(run.limit,17);assert.equal(run.language,'en');assert.equal(run.autoScroll,true);
 assert.equal(h.state.searchOptions.country,'KW');assert.equal(h.state.searchOptions.workMode,'remote');assert.equal(h.state.phase,'complete');assert(h.state.lastResult.confirmed);
 assert.equal(h.calls.find(c=>c.args?.[1]==='/api/discovery/session').target.tabId,8);
});
test('website launch rejects frames, other origins, account changes, invalid inputs and denied Google access',async()=>{
 const h=harness();for(const sender of [{...appSender,frameId:1},{...appSender,url:'https://attacker.example/app'},{...appSender,url:'https://mrsaal.ebnhussein.co/en/'}])assert.equal(await h.send(launch,sender),null);
 assert.equal(h.requests.length,0);assert.equal((await h.send({...launch,country:'XX'},appSender)).ok,false);assert.equal(h.requests.length,0);
 assert.equal((await h.send({...launch,expectedAccountId:'other'},appSender)).ok,false);assert.equal(h.opened.length,0);
 const denied=harness({permissionGranted:false});assert.equal((await denied.send(launch,appSender)).ok,false);assert.equal(denied.opened.length,0);assert.equal(denied.calls.length,0);
 const pending=harness();pending.local.pendingImport={requestKey:'existing'};assert.equal((await pending.send(launch,appSender)).ok,false);assert.equal(pending.opened.length,0);
});
test('panel-open failure still permits confirmed collection and tells the website; status hides other-account progress',async()=>{
 const h=harness({panelFails:true});const r=await h.send(launch,appSender);assert(r.ok);assert.equal(r.data.panelOpened,false);assert(h.state.lastResult.confirmed);
 const same=await h.send({action:'appState',expectedAccountId:'owner'},appSender);assert.equal(same.data.phase,'complete');assert.equal(same.data.version,'0.5.0');
 const other=await h.send({action:'appState',expectedAccountId:'other'},appSender);assert.equal(other.data.phase,'idle');assert.equal(other.data.count,0);assert(!other.data.account);assert(!other.data.lastRows);
});
