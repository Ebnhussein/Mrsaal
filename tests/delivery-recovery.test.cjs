'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../public/assets/app.js'),'utf8');
const confirmCode=source.slice(source.indexOf('async function confirmSend()'),source.indexOf('async function skipCo()'));
function preview({saveError,sendError,english=false}={}){
 const nodes=new Map(['btn-confirm','preview-channel','prev-send-status','prev-body','prev-subject'].map(id=>[id,{disabled:false,value:'Reviewed text',style:{}}]));
 const requests=[],toasts=[];let generated=0,reads=0;
 const context={window:{},document:{getElementById:id=>nodes.get(id)},crypto:{randomUUID:()=>`new-key-${++generated}`},cvLabel:(ar,en)=>english?en:ar,
  readPreviewSchedule:()=>({valid:true,scheduledAt:null}),previewChannel:'email',prevCompanyId:'co',previewSendKey:'original-key',previewBatchActive:false,
  companies:[{id:'co',status:'pending'}],flushPreviewDraft:async()=>{if(saveError)throw saveError;},
  api:async(path,method,body)=>{requests.push(body);if(sendError)throw sendError;return {ok:true};},
  renderCompanies(){},updateSendStats(){},closePrev(){},loadLog:async()=>{reads++;},toast:(...args)=>toasts.push(args)};
 vm.runInNewContext(confirmCode,context);
 return {context,nodes,requests,toasts,get reads(){return reads;}};
}
test('failed autosave never calls delivery, changes company state or blocks correcting the draft',async()=>{
 const h=preview({saveError:new Error('Offline'),english:true});await h.context.confirmSend();
 assert.equal(h.requests.length,0);assert.equal(h.reads,0);assert.equal(h.context.companies[0].status,'pending');
 assert.equal(h.context.previewSendKey,'original-key');assert.equal(h.nodes.get('btn-confirm').disabled,false);
 assert.match(h.nodes.get('prev-send-status').textContent,/sending was not requested/);assert(!/[\u0600-\u06ff]/.test(h.toasts[0][0]));
});
test('explicit delivery failure gets a fresh key only for the next user click',async()=>{
 const h=preview({sendError:Object.assign(new Error('Reconnect Gmail'),{httpStatus:409,deliveryStatus:'failed'})});
 await h.context.confirmSend();assert.equal(h.requests.length,1);assert.equal(h.requests[0].idempotencyKey,'original-key');
 assert.equal(h.context.previewSendKey,'new-key-1');assert.equal(h.nodes.get('btn-confirm').disabled,false);
 await h.context.confirmSend();assert.equal(h.requests.length,2);assert.equal(h.requests[1].idempotencyKey,'new-key-1');
});
test('uncertain or processing delivery and a lost send response retain the key and block duplicate clicks',async()=>{
 for(const error of [new Error('Offline'),...['uncertain','processing'].map(status=>Object.assign(new Error('Pending'),{httpStatus:409,deliveryStatus:status}))]){
  const h=preview({sendError:error,english:true});await h.context.confirmSend();await h.context.confirmSend();
  assert.equal(h.requests.length,1);assert.equal(h.context.previewSendKey,'original-key');assert.equal(h.nodes.get('btn-confirm').disabled,true);
  assert.match(h.nodes.get('prev-send-status').textContent,/Delivery is unconfirmed/);
 }
});
test('local sender switching failure before transport does not mark delivery uncertain',async()=>{
 const h=preview({sendError:Object.assign(new Error('Switching sender'),{beforeSend:true})});await h.context.confirmSend();
 assert.equal(h.context.companies[0].status,'pending');assert.equal(h.nodes.get('btn-confirm').disabled,false);assert.equal(h.context.previewSendKey,'original-key');
});
test('validation or authentication errors do not rotate the idempotency key',async()=>{
 const h=preview({sendError:Object.assign(new Error('Sign in again'),{httpStatus:401})});await h.context.confirmSend();assert.equal(h.context.previewSendKey,'original-key');
});
function reportHarness(english){
 const nodes=new Map();function element(){return {children:[],setAttribute(){},replaceChildren(...children){this.children=children;},remove(){nodes.delete(this.id);},before(node){nodes.set(node.id,node);}};}
 nodes.set('log-container',element());let fail=true,renders=0;
 const context={document:{getElementById:id=>nodes.get(id),createElement:element},cvLabel:(ar,en)=>english?en:ar,log:[{id:'old'}],activeLogId:null,
  api:async()=>{if(fail)throw new Error('Offline');return [{id:'updated'}];},renderLog(){renders++;},updateChannelSummary(){},refreshWorkspace(){}};
 vm.runInNewContext(source.slice(source.indexOf('async function loadLog()'),source.indexOf('function renderLog()')),context);
 return {context,nodes,set fail(value){fail=value;},get renders(){return renders;}};
}
test('reports keep existing records, show a localized retry, and remove the warning after successful refresh',async()=>{
 for(const english of [false,true]){
  const h=reportHarness(english);assert.equal(await h.context.loadLog(),false);assert.equal(h.context.log[0].id,'old');assert.equal(h.renders,0);
  const banner=h.nodes.get('log-load-error');assert.equal(banner.children.length,2);
  assert.match(banner.children[0].textContent,english?/outdated/:/قديمة/);
  const retry=banner.children[1];h.fail=false;const result=retry.onclick();assert.equal(retry.disabled,true);await result;
  assert.equal(h.nodes.has('log-load-error'),false);assert.equal(h.context.log[0].id,'updated');assert.equal(h.renders,1);
 }
});
