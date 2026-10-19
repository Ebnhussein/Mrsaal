'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class N{
 constructor(){this.children=[];this.attrs={};this.events={};this.style={};this.classList={add(){},contains:()=>true};this.disabled=false;this.hidden=false;this.textContent='';}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 prepend(n){n.parent=this;this.children.unshift(n);}
 insertBefore(n){this.prepend(n);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,cb){this.events[k]=cb;}
 removeEventListener(k){delete this.events[k];}
 getBoundingClientRect(){return {top:0};}
 getClientRects(){return [{}];}
}
class Observer{observe(){}disconnect(){this.disconnected=true;}}
test('smart scroll moves inside its region, honours reduced motion, disables boundaries and cleans up',()=>{
 const frames=[],document={documentElement:{lang:'en'},createElement:()=>new N()},window={};
 vm.runInNewContext(fs.readFileSync('public/assets/smart-scroll.js','utf8'),{window,document,WeakMap,MutationObserver:Observer,ResizeObserver:Observer,requestAnimationFrame:cb=>(frames.push(cb),frames.length),cancelAnimationFrame(){},matchMedia:()=>({matches:true})});
 const root=new N(),scroll=new N(),host=new N();scroll.scrollTop=0;scroll.scrollHeight=900;scroll.clientHeight=300;scroll.scrollTo=options=>{scroll.lastMove=options;scroll.scrollTop=options.top;};
 const items=[0,300,600].map((y,i)=>{const n=new N();n.name='Section '+i;n.getBoundingClientRect=()=>({top:y-scroll.scrollTop});return n;});
 const api=window.MrsaalSmartScroll.attach({root,scroller:scroll,host,items:()=>items,label:n=>n.name});
 const bar=host.children[0],row=bar.children[1],position=row.children[0],[prev,next]=row.children[1].children;
 assert.equal(prev.disabled,true);assert.equal(next.disabled,false);assert.match(position.textContent,/1 \/ 3/);
 next.events.click();assert.equal(scroll.lastMove.top,292);assert.equal(scroll.lastMove.behavior,'auto');
 scroll.scrollTop=600;api.refresh();while(frames.length)frames.shift()();assert(next.disabled);assert(!prev.disabled);assert.match(position.textContent,/3 \/ 3/);
 api.destroy();assert.equal(host.children.length,0);assert.equal(scroll.events.scroll,undefined);
});
function previewHarness(fail=false){
 const ids=Object.fromEntries(['preview-overlay','prev-company','preview-channel','btn-write','prev-subject','prev-body','prev-send-status'].map(id=>[id,new N()]));
 const root=new N(),scroller=new N(),footer=new N(),actions=new N();
 root.querySelector=s=>s==='.compose-scroll'?scroller:footer;root.querySelectorAll=()=>[];footer.querySelector=()=>actions;
 ids['preview-overlay'].querySelector=()=>root;scroller.querySelectorAll=()=>[];let saves=0,moves=0;
 const context={document:{getElementById:id=>ids[id],createElement:()=>new N(),documentElement:{lang:'en'}},window:{MrsaalSmartScroll:{attach:()=>({refresh(){}})}},MutationObserver:Observer,companies:[{id:'a'},{id:'b'}],prevCompanyId:'a',previewChannel:'email',previewBatchActive:false,async flushPreviewDraft(){saves++;if(fail)throw new Error('SAVE_FAILED');},async previewOne(){assert.equal(saves,1);moves++;},previewEdited(){}};
 vm.runInNewContext(fs.readFileSync('public/assets/preview-scroll.js','utf8'),context);
 const nav=footer.children[0],next=nav.children[1].children[1];
 return {next,status:ids['prev-send-status'],counts:()=>({saves,moves})};
}
test('preview company navigation waits for draft saving and never navigates if saving fails',async()=>{
 const ok=previewHarness();await ok.next.events.click();assert.deepEqual(ok.counts(),{saves:1,moves:1});
 const failed=previewHarness(true);await failed.next.events.click();assert.deepEqual(failed.counts(),{saves:1,moves:0});assert.match(failed.status.textContent,/Could not save your draft.*SAVE_FAILED/);
});
