'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {withOutputRecovery,compactPrompt}=require('../utils/ai-retry');
function view(){
 class Node{constructor(tag,text){this.tag=tag;this.textContent=text||'';this.children=[];this.attrs={};this.dataset={};this.disabled=false;this.classList={add(){},remove(){}};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}querySelector(selector){if(selector==='p')return this.paragraph;return this.children.find(n=>n.className==='draft-generation-status');}}
 const src=fs.readFileSync(require.resolve('../public/assets/launch.js'),'utf8');const fragment=src.slice(src.indexOf(' async function writeDraft('),src.indexOf(' async function review('));const box={el:(tag,text)=>new Node(tag,text),tr:(a)=>a};vm.createContext(box);vm.runInContext(fragment+';this.writeDraft=writeDraft;',box);
 const card=new Node('section');card.paragraph=new Node('p','Old state');return {writeDraft:box.writeDraft,card,subject:{value:'Old subject'},body:{value:'Old draft'},write:new Node('button'),approve:new Node('button')};
}
test('generation loading is local, prevents parallel writes, and updates editable draft on success',async()=>{
 const v=view();let resolve,calls=0;const waiting=new Promise(r=>resolve=r);const generate=()=>{calls++;return waiting;};
 const pending=v.writeDraft(v.card,v.subject,v.body,v.write,v.approve,generate);assert.equal(v.card.getAttribute('aria-busy'),'true');assert(v.write.disabled&&v.approve.disabled&&v.body.disabled);assert.equal(v.body.value,'Old draft');assert(v.card.children[0].children.some(n=>n.className==='draft-spinner'));
 await v.writeDraft(v.card,v.subject,v.body,v.write,v.approve,generate);assert.equal(calls,1);resolve({subject:'New subject',body:'New draft'});await pending;assert.equal(v.body.value,'New draft');assert.equal(v.card.getAttribute('aria-busy'),'false');assert(!v.approve.disabled&&!v.body.disabled);assert.equal(v.write.textContent,'إعادة الكتابة');
});
test('failed rewrite preserves text, reports error inside its own card, and unlocks controls',async()=>{
 const v=view();await v.writeDraft(v.card,v.subject,v.body,v.write,v.approve,async()=>{throw new Error('Provider unavailable');});assert.equal(v.body.value,'Old draft');assert.equal(v.subject.value,'Old subject');assert.equal(v.card.children[0].children[0].textContent,'Provider unavailable');assert.equal(v.card.getAttribute('aria-busy'),'false');assert(!v.write.disabled&&!v.approve.disabled);
});
test('incomplete output retries only once with compact request within shared deadline',async()=>{
 for(const code of ['EMPTY','TRUNCATED']){const flags=[];const result=await withOutputRecovery(async compact=>{flags.push(compact);if(!compact)throw Object.assign(new Error('incomplete'),{code});return 'complete';},Date.now()+10000);assert.equal(result,'complete');assert.deepEqual(flags,[false,true]);}
 assert(compactPrompt('original CV facts').startsWith('original CV facts'));
 let count=0;await assert.rejects(withOutputRecovery(async()=>{count++;throw Object.assign(new Error('empty'),{code:'EMPTY'});},Date.now()+10000));assert.equal(count,2);
});
test('quota, throttling and exhausted budget never trigger compact retry',async()=>{
 for(const [code,time]of [['QUOTA',10000],['RATE_LIMIT',10000],['EMPTY',1000]]){let count=0;await assert.rejects(withOutputRecovery(async()=>{count++;throw Object.assign(new Error('fail'),{code});},Date.now()+time));assert.equal(count,1);}
});
