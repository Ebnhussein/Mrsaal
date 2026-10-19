'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(lang='en'){
 const nodes=[];const document={documentElement:{lang},addEventListener(){},createElement(tag){const e={tag,children:[],dataset:{},style:{},attrs:{},textContent:'',value:'',hidden:false,append(...items){this.children.push(...items);for(const x of items)x.parentElement=this;},insertBefore(n){this.append(n);},replaceChildren(...items){this.children=[];this.append(...items);},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);},showModal(){this.open=true;},close(){this.open=false;},focus(){},remove(){}};Object.defineProperty(e,'options',{get(){return this.children;}});nodes.push(e);return e;},getElementById(id){return nodes.find(n=>n.id===id);}};document.body=document.createElement('body');const host=document.createElement('section');for(const id of ['wa-status','wa-connect','wa-disconnect','wa-qr']){const e=document.createElement(id==='wa-qr'?'img':'button');e.id=id;host.append(e);}
 const calls=[];let state={status:'disconnected'},next={};const context={document,window:{MrsaalDialog:{confirm:async()=>true}},Option:function(text,value){const e=document.createElement('option');e.textContent=text;e.value=value;return e;},fetch:async(path,opts)=>{calls.push({path,opts});return {ok:true,json:async()=>path.endsWith('options')?{provider:'mrsaalwa',betaAvailable:true}:next};},loadWhatsAppStatus:async()=>context.window.MrsaalWA.render(state)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/mrsaalwa.js'),'utf8'),context);
 return {api:context.window.MrsaalWA,find:id=>document.getElementById(id),nodes,calls,setState:v=>state=v,setReply:v=>next=v};
}
test('QR and phone pairing share a centered dialog, progress hides the QR, and close does not disconnect',async()=>{
 for(const lang of ['ar','en']){
 const h=setup(lang);await h.api.render({status:'disconnected'});h.setState({status:'qr',qr:'data:image/png;base64,TEST',hasSession:true});await h.api.connect();
 const dialog=h.find('wa-pairing-dialog'),image=dialog.children.find(x=>x.tag==='img');assert.equal(dialog.open,true);assert.equal(dialog.dir,lang==='en'?'ltr':'rtl');assert.equal(image.hidden,false);assert.equal(h.find('wa-qr').style.display,'none');
 await h.api.render({status:'connecting',hasSession:true});assert.equal(image.hidden,true);const status=dialog.children.find(x=>x.className==='mrsaalwa-dialog-status');assert.equal(status.dataset.loading,'true');assert.match(status.textContent,lang==='en'?/Connecting/:/جاري الاتصال/);
 const count=h.calls.length;dialog.close();assert.equal(h.calls.length,count);assert.equal(h.api.pairingActive(),false);
 const phone=h.find('mrsaalwa-pairing').children[1].children[1];phone.onclick();h.find('mrsaalwa-phone').value='+201012345678';h.find('mrsaalwa-pair-ack').checked=true;h.setReply({pairingCode:'ABCD1234'});h.setState({status:'qr',hasSession:true});await h.api.connect();
 const code=dialog.children.find(x=>x.tag==='output');assert.equal(code.textContent,'ABCD1234');assert.equal(code.hidden,false);assert.equal(image.hidden,true);
 await h.api.render({status:'connected',phone:'201012345678'});assert.equal(code.hidden,true);assert.equal(status.dataset.loading,'false');assert.equal(h.api.pairingActive(),false);
 }
});
