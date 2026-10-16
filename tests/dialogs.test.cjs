'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(lang='ar'){
 const created=[];let returnedFocus=0;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.dataset={};this.textContent='';created.push(this);}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this[k]=v;}
  addEventListener(k,fn){this.handlers[k]=fn;}
  showModal(){this.open=true;}
  close(){this.open=false;this.handlers.close?.();}
  remove(){this.removed=true;}
  focus(){this.focused=true;}
 }
 const document={documentElement:{lang},activeElement:{focus:()=>returnedFocus++},createElement:tag=>new Element(tag),body:{append(){}}};
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/dialogs.js'),'utf8'),{window,document});
 return {confirm:window.MrsaalDialog.confirm,created,get focusCount(){return returnedFocus;}};
}
test('designed confirmation defaults to cancel, escapes safely and resolves only once',async()=>{
 const f=fixture(),p=f.confirm('<img src=x onerror=bad()>'),d=f.created.find(n=>n.tag==='dialog');
 assert.equal(d.open,true);assert.equal(f.created.find(n=>n.tag==='p').textContent,'<img src=x onerror=bad()>');
 const cancel=f.created.find(n=>n.textContent==='إلغاء');assert(cancel.focused);assert.equal(await f.confirm('duplicate'),false);
 let prevented=false;d.handlers.cancel({preventDefault(){prevented=true;}});assert.equal(await p,false);assert(prevented);assert(d.removed);assert.equal(f.focusCount,1);
});
test('English confirmation localises legacy text and only explicit approval returns true',async()=>{
 const f=fixture('en'),p=f.confirm('حذف مفتاح هذه المنصة واختياراتها؟');
 assert.equal(f.created.find(n=>n.tag==='p').textContent,'Delete this provider key and its model selections?');
 f.created.find(n=>n.textContent==='Confirm').onclick();assert.equal(await p,true);assert.equal(f.focusCount,1);
 const second=f.confirm('Second');f.created.filter(n=>n.textContent==='×').at(-1).onclick();assert.equal(await second,false);
});
