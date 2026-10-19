'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('campaign creation snapshots unchecked skip and selected companies before waiting for draft autosave',async()=>{
 const source=fs.readFileSync(require.resolve('../public/assets/launch.js'),'utf8'),start=source.indexOf(' async function create('),end=source.indexOf('\n',start);let payload,reads=0,reviewed=0;const options={channel:'available',bothChannels:true,skipSent:false,preferredChannel:'email'};
 const box={window:{flushPreviewDraft:async()=>{options.skipSent=true;options.bothChannels=false;}},document:{getElementById:id=>({value:id==='delay-s'?'5':id==='sched-type'?'now':''})},gmailActiveId:'sender',deliveryOptions:()=>{reads++;return options;},request:async(_p,_m,data)=>{payload=data;return {id:'campaign'};},review:async()=>reviewed++};
 vm.runInNewContext(source.slice(start,end),box);await box.create(['co'],'available');assert.equal(payload.skipSent,false);assert.equal(payload.bothChannels,true);assert.equal(reads,1);assert.equal(payload.companyIds[0],'co');assert.equal(reviewed,1);
});
test('explicit options from queue planning are used unchanged even if current DOM options disagree',async()=>{
 const source=fs.readFileSync(require.resolve('../public/assets/launch.js'),'utf8'),start=source.indexOf(' async function create('),end=source.indexOf('\n',start);let payload;
 const box={window:{flushPreviewDraft:async()=>{}},document:{getElementById:()=>({value:'now'})},deliveryOptions:()=>{throw Error('must not reread controls');},request:async(_p,_m,p)=>{payload=p;return {id:'c'};},review:async()=>{}};
 vm.runInNewContext(source.slice(start,end),box);await box.create(['co'],'available',{skipSent:false,bothChannels:true,preferredChannel:'email'});assert.equal(payload.skipSent,false);assert.equal(payload.bothChannels,true);
});
test('preparation stays open on rejection, prevents simultaneous clicks, and only closes after success',async()=>{
 const source=fs.readFileSync(require.resolve('../public/assets/applications.js'),'utf8'),start=source.indexOf(' const start=startSend;'),end=source.indexOf(" document.addEventListener('mrsaal:language'",start);let finish,closes=0,calls=0;
 const box={startSend:()=>{calls++;return new Promise(resolve=>finish=resolve);},document:{getElementById:()=>({value:''})},close:()=>closes++};vm.runInNewContext(source.slice(start,end),box);
 const first=box.startSend();assert.equal(await box.startSend(),false);assert.equal(calls,1);assert.equal(closes,0);finish(false);await first;assert.equal(closes,0);
 const second=box.startSend();assert.equal(closes,0);finish(true);await second;assert.equal(closes,1);
});
test('explicit allow-repeat action clears only skip-sent without changing dual-channel selection or sending',()=>{
 const source=fs.readFileSync(require.resolve('../public/assets/applications.js'),'utf8'),start=source.indexOf(' function showError('),end=source.indexOf(' function open(',start);const nodes={'page-send':{prepend(node){nodes[node.id]=node;}},'opt-skip-sent':{checked:true},'opt-send-both':{checked:true}};let updates=0;
 const box={document:{documentElement:{lang:'en'},getElementById:id=>nodes[id],createElement:tag=>({tag,children:[],setAttribute(){},replaceChildren(...items){this.children=items;},append(item){this.children.push(item);}})},updateChannelSummary:()=>updates++};
 vm.runInNewContext(source.slice(start,end),box);box.showError({code:'CAMPAIGN_ALREADY_SENT',message:'Previously sent'});const panel=nodes['applications-send-error'];assert.equal(panel.hidden,false);assert.equal(nodes['opt-skip-sent'].checked,true);panel.children[1].onclick();assert.equal(nodes['opt-skip-sent'].checked,false);assert.equal(nodes['opt-send-both'].checked,true);assert.equal(panel.hidden,true);assert.equal(updates,1);
});
