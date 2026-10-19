'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Node{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.className='';this.attrs={};this.dataset={};this.style={};this.disabled=false;this.isConnected=true;this.scrollTop=0;this.classList={add:(...c)=>{this.className+=' '+c.join(' ');}};}
 append(...items){this.children.push(...items);}setAttribute(k,v){this.attrs[k]=v;}addEventListener(){}
 replaceChildren(...items){this.children=items;}close(){this.closed=true;}
 querySelector(s){return this.querySelectorAll(s)[0];}
 querySelectorAll(s){const found=[];function visit(n){for(const c of n.children){if(s[0]==='.'?c.className.split(' ').includes(s.slice(1)):c.tag===s)found.push(c);visit(c);}}visit(this);return found;}
}
function harness(rows,english=true){
 const source=fs.readFileSync('public/assets/launch.js','utf8');const start=source.indexOf(' async function campaigns()'),end=source.indexOf('\n async function writeDraft',start);let dialog,reads=0,mutations=0,reviews=[];
 const globals={window:{MrsaalSmartScroll:{attach:()=>({refresh(){},destroy(){}})},MrsaalDialog:{confirm:async()=>true}},popup:title=>{dialog=new Node('dialog');const status=new Node('p');status.className='launch-status';dialog.append(new Node('h2',title),status);return dialog;},tr:(ar,en)=>english?en:ar,en:()=>english,el:(tag,text)=>new Node(tag,text),button:(text,fn)=>{const n=new Node('button',text);n.className='btn btn-secondary';n.onclick=fn;return n;},stateLabel:s=>s,request:async(path,method)=>{if(method==='POST'){mutations++;return {};}reads++;return rows;},review:async id=>reviews.push(id),Date,Number,Object};
 vm.runInNewContext(source.slice(start,end)+'\nglobalThis.run=campaigns;',globals);
 return {run:()=>globals.run(),dialog:()=>dialog,counts:()=>({reads,mutations}),reviews};
}
test('campaign modal offers status-appropriate actions and only resumes reviewed paused campaigns',async()=>{
 const h=harness([{id:'draft',channel:'email',status:'draft',counts:{draft:3}},{id:'running',channel:'whatsapp',status:'running',counts:{sent:2,ready:1}},{id:'done',channel:'email',status:'completed',counts:{sent:3}},{id:'unreviewed',channel:'email',status:'paused',counts:{draft:1}},{id:'reviewed',channel:'email',status:'paused',counts:{ready:2}}]);await h.run();
 const cards=h.dialog().querySelectorAll('.campaign-card');assert.equal(cards.length,5);
 const labels=i=>cards[i].querySelectorAll('button').map(b=>b.textContent);
 assert.deepEqual(labels(0),['Open and review','Cancel campaign']);
 assert.deepEqual(labels(1),['Open and review','Pause','Cancel campaign']);
 assert.deepEqual(labels(2),['Open and review']);
 assert(cards[3].querySelectorAll('button').find(b=>b.textContent==='Resume').disabled);
 assert(!cards[4].querySelectorAll('button').find(b=>b.textContent==='Resume').disabled);
 await cards[0].querySelector('button').onclick();assert(h.dialog().closed);assert.deepEqual(h.reviews,['draft']);assert.equal(h.counts().mutations,0);
});
test('campaign modal renders a useful empty state and refreshes the list in place',async()=>{
 const h=harness([],false);await h.run();const d=h.dialog();assert(d.querySelector('.campaigns-empty'));
 const refresh=d.querySelector('.campaign-refresh');await refresh.onclick();assert.equal(h.dialog(),d);assert.equal(h.counts().reads,2);assert.equal(h.counts().mutations,0);assert.equal(d.querySelector('.launch-status').textContent,'');
});
