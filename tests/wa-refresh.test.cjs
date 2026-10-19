'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../public/assets/app.js'),'utf8');
for(const fail of [false,true])test(`WhatsApp refresh blocks duplicate clicks and restores control after ${fail?'error':'success'}`,async()=>{
 let settle,calls=0;const pending=new Promise((resolve,reject)=>{settle=()=>fail?reject(new Error('Offline')):resolve({status:'connected'});});
 const nodes=Object.fromEntries(['wa-refresh','wa-status','wa-qr'].map(id=>[id,{style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(){}}]));
 const box={document:{querySelector:()=>true,getElementById:id=>nodes[id]},api:()=>{calls++;return pending;},refreshWorkspace(){},cvLabel:(ar,en)=>en,window:{},waState:null};
 vm.runInNewContext(source.slice(source.indexOf('let waTimer = null;'),source.indexOf('async function connectWhatsApp()')),box);
 const first=box.loadWhatsAppStatus();assert.equal(nodes['wa-refresh'].disabled,true);assert.equal(nodes['wa-refresh'].attrs['aria-busy'],'true');assert.equal(nodes['wa-refresh'].textContent,'Refreshing…');
 await box.loadWhatsAppStatus();assert.equal(calls,1);settle();await first;
 assert.equal(nodes['wa-refresh'].disabled,false);assert.equal(nodes['wa-refresh'].attrs['aria-busy'],'false');assert.equal(nodes['wa-refresh'].textContent,'Refresh status');
});
