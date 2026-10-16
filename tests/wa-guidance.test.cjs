'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const nodes=[];
 class El{
  constructor(tag,text=''){this.tag=tag;this.value='';this.textContent=text;this.children=[];this.dataset={};this.style={};nodes.push(this);}
  click(){this.onclick?.();}
  focus(){this.focused=true;}
  scrollIntoView(){this.scrolled=true;}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.textContent='';this.append(...children);}
  setAttribute(k,v){this[k]=v;}
  insertBefore(child){this.append(child);}
  get options(){return this.children;}
  querySelectorAll(selector){const out=[];function visit(n){for(const c of n.children){if(c.tag===selector)out.push(c);visit(c);}}visit(this);return out;}
 }
 const host=new El('div');for(const id of ['wa-status','wa-qr','wa-connect','wa-disconnect']){const n=new El(id==='wa-qr'?'img':'button');n.id=id;host.append(n);}
 const byId=id=>nodes.find(n=>n.id===id),document={documentElement:{lang:'en'},createElement:t=>new El(t),getElementById:byId,addEventListener(){}};
 let failure=null;const calls=[];const identities=[],saved=new Map(),window={MrsaalDialog:{identity:async options=>{identities.push(options);return false;}},MrsaalErrors:{from:(d)=>Object.assign(new Error(d.error),{code:d.code})}};
 const fetch=async url=>{calls.push(url);return url.endsWith('/options')?{ok:true,json:async()=>({provider:'mrsaalwa',betaAvailable:true})}:failure?{ok:false,status:401,json:async()=>failure}:{ok:true,json:async()=>({pairingCode:'ABCD1234'})};};
 const context={window,document,fetch,Option:function(t,v){const e=new El('option',t);e.value=v;return e;},sessionStorage:{setItem:(k,v)=>saved.set(k,v)},loadWhatsAppStatus:async()=>window.MrsaalWA.render({status:'qr',hasSession:true}),Date,console};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/mrsaalwa.js'),'utf8'),context);
 return {ui:window.MrsaalWA,byId,nodes,saved,calls,identities,setFailure:v=>failure=v,text:n=>n.textContent+n.children.map(c=>c.textContent+c.children.map(x=>x.textContent).join('')).join('')};
}
test('phone pairing explains the code rather than asking users to scan a hidden QR; connected state hides instructions',async()=>{
 const f=fixture();await f.ui.render({status:'disconnected'});assert.equal(f.byId('wa-disconnect').disabled,true);
 f.ui.restoreMethod('phone');f.byId('mrsaalwa-phone').value='201012345678';f.byId('mrsaalwa-pair-ack').checked=true;await f.ui.connect();
 const notice=f.nodes.find(n=>n.className==='mrsaalwa-notice');assert.match(f.text(notice),/pairing code is ready/);assert.equal(f.byId('wa-qr').style.display,'none');
 assert.equal(f.nodes.find(n=>n.tag==='output').textContent,'ABCD1234');
 await f.ui.render({status:'connected',phone:'201012345678'});assert.equal(f.nodes.find(n=>n.tag==='ol').hidden,true);assert.equal(f.nodes.find(n=>n.tag==='output').hidden,true);assert.equal(f.byId('wa-connect').disabled,true);assert.equal(f.byId('wa-disconnect').disabled,false);
});
test('identity check explains why and keeps the connection method for return; internal UUIDs are redacted',async()=>{
 const f=fixture();await f.ui.render({status:'disconnected'});f.setFailure({code:'REAUTH_REQUIRED',error:'internal error'});await f.ui.connect();
 const notice=f.nodes.find(n=>n.className==='mrsaalwa-notice');assert.equal(notice.dataset.kind,'identity');assert.match(f.text(notice),/verify your identity/);assert.equal(f.identities.length,1);assert(!f.text(notice).includes('protect your account'));
 f.identities[0].onContinue();assert.equal(f.saved.get('mrsaal-wa-return'),'qr');
 assert(!f.ui.safeText('Session 66cb8617-a5d7-4fe6-ae9f-84f73a51c9fc').includes('66cb8617'));
});

test('missing phone and consent show separate field errors, focus the first issue and never request pairing',async()=>{
 const f=fixture();await f.ui.render({status:'disconnected'});f.ui.restoreMethod('phone');await f.ui.connect();
 const phone=f.byId('mrsaalwa-phone'),ack=f.byId('mrsaalwa-pair-ack');assert.equal(phone['aria-invalid'],'true');assert.equal(ack['aria-invalid'],'true');assert(phone.focused&&phone.scrolled);assert.equal(f.calls.filter(x=>x.endsWith('/connect')).length,0);
 assert.match(f.byId(phone.id+'-error').textContent,/Enter the WhatsApp number/);assert.equal(f.byId(ack.id+'-error').hidden,false);
 phone.value='01012345678';phone.oninput();assert.match(f.byId(phone.id+'-error').textContent,/country code/);
 phone.value='+٢٠١٠١٢٣٤٥٦٧٨';phone.oninput();assert.equal(phone['aria-invalid'],'false');assert.equal(ack['aria-invalid'],'true');
 await f.ui.connect();assert(ack.focused);assert.equal(f.calls.filter(x=>x.endsWith('/connect')).length,0);
 await f.ui.render({status:'qr',hasSession:true});assert.equal(f.nodes.find(n=>n.className==='mrsaalwa-notice').dataset.kind,'validation');
 ack.checked=true;ack.onchange();assert.equal(ack['aria-invalid'],'false');assert.equal(f.byId(ack.id+'-error').hidden,true);await f.ui.connect();assert.equal(f.calls.filter(x=>x.endsWith('/connect')).length,1);
});
