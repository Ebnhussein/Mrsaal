'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(lang='en'){
 const fields=new Map(),listeners=new Map();
 class El{
  constructor(id,type='text'){this.id=id;this.type=type;this.value='';this.required=false;this.disabled=false;this.dataset={};this.attrs={};this.validity={};this.minLength=-1;this.maxLength=-1;this.min='';this.max='';this.children=[];fields.set(id,this);}
  getAttribute(k){return this.attrs[k]??null;}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  closest(selector){if(selector==='[hidden]')return this.hiddenParent||null;if(selector==='label')return this.label||null;return null;}
  insertAdjacentElement(_,hint){this.hint=hint;}
  focus(){this.focused=true;}
  scrollIntoView(){this.scrolled=true;}
  dispatchEvent(){}
  matches(){return true;}
 }
 const doc={documentElement:{lang},getElementById:id=>fields.get(id),createElement:tag=>new El('generated-'+fields.size,tag),addEventListener:(type,fn)=>listeners.set(type,fn)},window={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/validation.js'),'utf8'),{document:doc,window,WeakMap,Set,Number,String,CustomEvent:function(){},queueMicrotask:fn=>fn()});
 return {ui:window.MrsaalValidation,fields,listeners,field:(id,type)=>new El(id,type),form:controls=>({tagName:'FORM',dataset:{},querySelectorAll:()=>controls})};
}
test('forms mark all missing fields, focus the first and stop submit; correction clears only the corrected field',()=>{
 const f=fixture(),email=f.field('email','email'),consent=f.field('terms','checkbox');email.required=consent.required=true;let stopped=0;
 f.listeners.get('submit')({target:f.form([email,consent]),preventDefault(){stopped++;},stopImmediatePropagation(){stopped++;}});
 assert.equal(stopped,2);assert.equal(email.attrs['aria-invalid'],'true');assert.equal(consent.attrs['aria-invalid'],'true');assert(email.focused&&email.scrolled);assert.match(email.hint.textContent,/required/);
 email.value='bad email';f.listeners.get('input')({target:email});assert.match(email.hint.textContent,/valid email/);
 email.value='me@example.com';f.listeners.get('input')({target:email});assert.equal(email.attrs['aria-invalid'],undefined);assert.equal(consent.attrs['aria-invalid'],'true');
 consent.checked=true;f.listeners.get('change')({target:consent});assert.equal(consent.attrs['aria-invalid'],undefined);assert(f.ui.validate(f.form([email,consent])));
});
test('global constraints cover contact detail, signup password matching, country code and administrator ranges',()=>{
 const f=fixture();const body=f.field('contact-message','textarea');body.value='short';assert.match(f.ui.message(body),/10 characters/);
 const password=f.field('account-password','password'),confirm=f.field('account-confirm-password','password');password.value='original-password';confirm.value='different-password';assert.match(f.ui.message(confirm),/do not match/);
 const phone=f.field('account-phone','tel');phone.value='01012345678';assert.match(f.ui.message(phone),/country code/);
 const limit=f.field('limit','number');limit.value='-1';limit.min='0';limit.max='99';assert.match(f.ui.message(limit),/minimum/);limit.value='100';assert.match(f.ui.message(limit),/maximum/);limit.value='0';assert.equal(f.ui.message(limit),'');
});
test('optional, disabled and hidden controls do not block a form; existing accessibility descriptions survive',()=>{
 const f=fixture('ar'),optional=f.field('optional'),disabled=f.field('disabled'),hidden=f.field('hidden');disabled.required=hidden.required=true;disabled.disabled=true;hidden.hiddenParent={};assert(f.ui.validate(f.form([optional,disabled,hidden])));
 optional.attrs['aria-describedby']='existing-hint';f.ui.error(optional,'رسالة توضيح');assert.match(optional.attrs['aria-describedby'],/^existing-hint mrsaal-field-error-/);f.ui.clear(optional);assert.equal(optional.hint.hidden,true);assert.match(optional.attrs['aria-describedby'],/existing-hint/);
});
test('custom business checks update on input and native validation messages use the selected language',()=>{
 const f=fixture('ar'),model=f.field('model','select-one');assert.equal(f.ui.check([{field:model,test:x=>!!x.value,message:'اختار موديل'}]),false);assert.equal(model.hint.textContent,'اختار موديل');model.value='local-ai';f.listeners.get('change')({target:model});assert.equal(model.hint.hidden,true);
 const name=f.field('name');name.required=true;let prevented=false;f.listeners.get('invalid')({target:name,preventDefault(){prevented=true;}});assert(prevented);assert.equal(name.hint.textContent,'الخانة دي مطلوبة.');assert(name.focused);
});
test('all render paths load shared validation, and primary website contact is covered in both languages',()=>{
 const {render}=require('../utils/site-template');for(const lang of ['ar','en'])for(const page of ['home','contact','login','signup','help','plans','admin']){const html=render(lang,page);assert(html.includes('/assets/validation.js'),lang+':'+page);assert(html.includes('/assets/validation.css'),lang+':'+page);}
 for(const path of ['../public/index.html','../public/account.html'])assert(fs.readFileSync(require.resolve(path),'utf8').includes('/assets/validation.js'));
});
