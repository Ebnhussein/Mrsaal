'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(lang='en',send=async()=>({ok:true})){
 const elements=[],calls=[];
 class Node{
  constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.attrs={};this.listeners={};this.value='';this.disabled=false;this.classList={add:()=>{}};elements.push(this);}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,f){this.listeners[k]=f;}
  focus(){this.focused=true;}
  close(){this.closed=true;this.listeners.close?.();}
  querySelector(q){return this.parts[q];}
 }
 const opener={isConnected:true,focus(){this.focused=true;}};
 const context={document:{activeElement:opener,getElementById:()=>null},location:{href:'/app'},en:()=>lang==='en',tr:(a,b)=>lang==='en'?b:a,el:(tag,text)=>new Node(tag,text),button:(text,fn)=>{const b=new Node('button',text);b.onclick=fn;return b;},popup:title=>{const d=new Node('dialog');d.parts={h2:new Node('h2',title),'.launch-status':new Node('p'),'.launch-close':new Node('button','×')};return d;},request:async(...args)=>{calls.push(args);return send(...args);}};
 const source=fs.readFileSync(require.resolve('../public/assets/launch.js'),'utf8');const start=source.indexOf(' function deleteAccountDialog(){'),end=source.indexOf(' function init(){',start);vm.runInNewContext(source.slice(start,end)+'\ndeleteAccountDialog();',context);
 const find=tag=>elements.find(n=>n.tag===tag),input=find('input'),form=find('form'),dialog=find('dialog'),submit=elements.find(n=>n.type==='submit'),cancel=elements.find(n=>n.textContent===(lang==='en'?'Keep my account':'احتفظ بحسابي'));
 return {elements,calls,context,input,form,dialog,submit,cancel,opener};
}
test('account deletion dialog cannot send with empty or incorrect confirmation; cancellation makes no request',async()=>{
 const ui=setup();assert.equal(ui.submit.disabled,true);assert(ui.cancel.focused);ui.input.value='delete';ui.input.listeners.input();assert(ui.submit.disabled);await ui.form.listeners.submit({preventDefault(){}});assert.equal(ui.calls.length,0);
 ui.cancel.onclick();assert(ui.dialog.closed);assert(ui.opener.focused);assert.equal(ui.calls.length,0);
});
test('correct typed confirmation sends once; repeated clicks and Escape cannot interrupt an in-flight deletion',async()=>{
 let finish;const ui=setup('en',()=>new Promise(resolve=>finish=resolve));ui.input.value='DELETE';ui.input.listeners.input();assert.equal(ui.submit.disabled,false);
 const running=ui.form.listeners.submit({preventDefault(){}});await ui.form.listeners.submit({preventDefault(){}});assert.equal(ui.calls.length,1);assert.equal(ui.calls[0][0],'/api/launch/delete');assert.equal(ui.calls[0][2].confirm,'DELETE');assert(ui.input.disabled);assert(ui.cancel.disabled);let prevented=false;ui.dialog.listeners.cancel({preventDefault(){prevented=true;}});assert(prevented);finish({ok:true});await running;assert.equal(ui.context.location.href,'/');
});
test('server rejection remains inside the dialog; recent-auth failure offers sign-in instead of retrying deletion',async()=>{
 const ui=setup('en',async()=>{throw Object.assign(new Error('Sign in again to confirm your identity.'),{httpStatus:401,code:'REAUTH_REQUIRED'});});ui.input.value='DELETE';await ui.form.listeners.submit({preventDefault(){}});
 assert.equal(ui.context.location.href,'/app');assert.equal(ui.dialog.parts['.launch-status'].textContent,'Sign in again to confirm your identity.');assert.equal(ui.submit.disabled,true);assert.equal(ui.cancel.disabled,false);const link=ui.elements.find(n=>n.className==='account-delete-reauth');assert.equal(link.hidden,false);assert.equal(link.href,'/en/login?reauth=1');
});
test('Arabic dialog explains Google is not deleted and permits safe retry after a blocked active campaign',async()=>{
 const ui=setup('ar',async()=>{throw Object.assign(new Error('أوقف الحملات أولًا'),{httpStatus:409});});assert(ui.elements.some(n=>n.textContent.includes('حساب Google وبريدك نفسهم مش هيتحذفوا')));ui.input.value='DELETE';await ui.form.listeners.submit({preventDefault(){}});assert.equal(ui.dialog.parts['.launch-status'].textContent,'أوقف الحملات أولًا');assert.equal(ui.input.disabled,false);assert.equal(ui.submit.disabled,false);assert.equal(ui.calls.length,1);
});
