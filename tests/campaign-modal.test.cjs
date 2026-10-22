'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Node{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.className='';this.attrs={};this.dataset={};this.style={};this.disabled=false;this.isConnected=true;this.scrollTop=0;this.classList={add:(...c)=>{this.className+=' '+c.join(' ');}};}
 append(...items){for(const item of items)item.parentElement=this;this.children.push(...items);}setAttribute(k,v){this.attrs[k]=v;}addEventListener(){}
 replaceChildren(...items){this.children=items;}close(){this.closed=true;}
 querySelector(s){return this.querySelectorAll(s)[0];}
 querySelectorAll(s){const found=[];function visit(n){for(const c of n.children){if(s.split(',').some(selector=>selector[0]==='.'?c.className.split(' ').includes(selector.slice(1)):c.tag===selector))found.push(c);visit(c);}}visit(this);return found;}
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

test('campaign review keeps editable cards inside the scroll region and sending actions outside it',async()=>{
 const source=fs.readFileSync('public/assets/launch.js','utf8');const start=source.indexOf(' async function review('),end=source.indexOf('\n async function create(',start);let dialog,attached,reads=0;
 const globals={window:{MrsaalSmartScroll:{attach:options=>{attached=options;return {refresh(){},destroy(){}};}}},popup:()=>{dialog=new Node('dialog');const status=new Node('p');status.className='launch-status';dialog.append(new Node('h2'),status);return dialog;},tr:(a,b)=>b,el:(tag,text)=>new Node(tag,text),button:(text,fn)=>{const b=new Node('button',text);b.onclick=fn;return b;},stateLabel:s=>s,field:(container,label,value='',type='text')=>{const wrap=new Node('label',label),input=new Node(type==='textarea'?'textarea':'input');input.value=value;wrap.append(input);container.append(wrap);return input;},request:async()=>{reads++;return {campaign:{status:'draft',channel:'email'},items:[{id:'one',company_id:'a',company_name:'Afaq',recipient:'a@example.com',status:'draft',subject:'Hello',body:'Saved message'},{id:'two',company_id:'b',company_name:'Madar',status:'sent'}]};}};
 vm.runInNewContext(source.slice(start,end)+'\nglobalThis.run=review;',globals);await globals.run('campaign');
 assert.equal(reads,1);assert.equal(dialog.querySelectorAll('.review-card').length,2);
 const content=dialog.querySelector('.review-content'),footer=dialog.querySelector('.review-footer');
 assert.equal(content.querySelectorAll('.review-card').length,2);assert(content.querySelector('.review-schedule'));
 assert.equal(footer.querySelectorAll('button').length,2);assert.equal(footer.querySelectorAll('textarea').length,0);
 assert.equal(content.querySelector('textarea').value,'Saved message');assert.equal(content.querySelector('textarea').readOnly,true);
 assert.equal(attached.scroller,content);assert.equal(attached.host,footer);assert.equal(attached.items().length,3);
});
test('mixed-channel chooser opens the chosen review with sibling navigation and never starts either campaign',async()=>{
 const source=fs.readFileSync('public/assets/launch.js','utf8'),start=source.indexOf(' async function channelBatches('),end=source.indexOf(' async function create(',start);let dialog;const opened=[];
 const box={popup:()=>dialog=new Node('dialog'),tr:(_a,b)=>b,el:(tag,text)=>new Node(tag,text),button:(text,fn)=>{const b=new Node('button',text);b.onclick=fn;return b;},review:async(...args)=>opened.push(args)};
 vm.runInNewContext(source.slice(start,end),box);const batches=[{id:'mail',channel:'email',count:2},{id:'wa',channel:'whatsapp',count:2}];await box.channelBatches(batches,'2026-10-21T09:00');
 assert.deepEqual(dialog.querySelectorAll('h3').map(n=>n.textContent),['Email','WhatsApp']);assert.equal(opened.length,0);
 await dialog.querySelectorAll('button')[1].onclick();assert.equal(dialog.closed,true);assert.equal(opened[0][0],'wa');assert.equal(opened[0][1],'2026-10-21T09:00');assert.strictEqual(opened[0][2],batches);
});
test('campaign outcome popup is localized, dismissible and opens campaigns only on an explicit click',async()=>{
 const source=fs.readFileSync('public/assets/launch.js','utf8'),start=source.indexOf(' function campaignNotice('),end=source.indexOf(' function field(',start);
 for(const english of [false,true]){
  let dialog,opened=0,other=0;const box={tr:(ar,en)=>english?en:ar,el:(tag,text)=>new Node(tag,text),popup:title=>{dialog=new Node('dialog');dialog.append(new Node('h2',title));return dialog;},button:(text,fn)=>{const n=new Node('button',text);n.onclick=fn;return n;}};
  vm.runInNewContext(source.slice(start,end),box);box.campaignNotice('start',{onView:async()=>opened++,onOther:async()=>other++});assert.equal(opened,0);assert.equal(other,0);assert.match(dialog.querySelector('h2').textContent,english?/Campaign started/:/الحملة بدأت/);
  const buttons=dialog.querySelectorAll('button');assert.equal(buttons.length,3);await buttons[0].onclick();assert.equal(opened,1);assert(dialog.closed);
  box.campaignNotice('scheduled');assert.match(dialog.querySelector('h2').textContent,english?/scheduled/:/جدولة/);await dialog.querySelector('button').onclick();assert(dialog.closed);
 }
});

test('starting a campaign shows its outcome after acknowledgement, and a failed request stays reviewable without retrying',async()=>{
 const source=fs.readFileSync('public/assets/launch.js','utf8'),start=source.indexOf(' async function review('),end=source.indexOf(' async function channelBatches(',start);
 for(const [scheduled,error]of [[null,null],['2026-12-01T12:00:00.000Z',null],[null,new Error('Connection lost')]]){
  let dialog,posts=0;const notices=[];
  const box={popup:()=>{dialog=new Node('dialog');dialog.append(new Node('h2'),Object.assign(new Node('p'),{className:'launch-status'}));return dialog;},tr:(_a,b)=>b,el:(tag,text)=>new Node(tag,text),button:(text,fn)=>{const n=new Node('button',text);n.onclick=fn;return n;},field:(host,label,value)=>{const wrap=new Node('label',label),input=new Node('input');input.value=value;wrap.append(input);host.append(wrap);return input;},stateLabel:s=>s,window:{MrsaalSchedule:{read:()=>({valid:true,scheduledAt:scheduled}),reject:()=>false}},request:async(_p,method)=>{if(method==='POST'){posts++;if(error)throw error;return {ok:true};}return {campaign:{channel:'email',status:'draft'},items:[]};},campaignNotice:(action,options)=>notices.push({action,options}),campaigns:async()=>{}};
  vm.runInNewContext(source.slice(start,end),box);await box.review('id');assert.equal(notices.length,0);await dialog.querySelector('.review-footer').querySelector('button').onclick();assert.equal(posts,1);assert.equal(notices[0].action,error?'error':scheduled?'scheduled':'start');assert.equal(Boolean(dialog.closed),!error);if(error)assert.equal(notices[0].options.message,'Connection lost');
 }
});
