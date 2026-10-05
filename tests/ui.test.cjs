const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {defaults}=require('../utils/writing-profile');
test('style saved, explicit approval, revision and reference do not send',async()=>{
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,setAttribute(){},focus(){},replaceChildren(){},add(){}});return elements.get(id);};
 let stored={profile:defaults(),subject:'فرصة',saved:true},sent=0;
 const c={document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},Option:function(){},companies:[{id:'1',name:'ألف'}],api:async(p,method,data)=>{
 if(p==='/api/writing'){if(method==='POST')stored={...data,saved:true};return JSON.parse(JSON.stringify(stored));}
 if(p.endsWith('/analyze'))return {summary:'مصري مباشر'};
 if(p.endsWith('/generate'))return {subject:'تواصل',body:'رسالة مختصرة',reviewed:true,review:[]};
 sent++;throw new Error('unexpected endpoint');
 },toast(){},refreshWorkspace(){},templateReady:false,prevCompanyId:'1',previewRequest:0,confirm:()=>true,previewOne:async()=>{},console};
 vm.createContext(c);vm.runInContext(fs.readFileSync(require.resolve('../public/assets/writing.js'),'utf8'),c);
 await c.writingLoad();el('ws-example-0').value='أهلًا';el('ws-example-1').value='شكرًا';el('ws-summary').value='قديم';
 await c.writingAnalyze();assert.equal(el('ws-summary').value,'قديم');c.writingAccept();assert.equal(el('ws-summary').value,'مصري مباشر');assert.equal(await c.writingSave(),true);await c.writingLoad();assert.equal(el('ws-summary').value,'مصري مباشر');
 el('prev-body').value='مسودة طويلة';await c.writingRevise('shorten');assert.equal(el('prev-body').value,'رسالة مختصرة');assert.equal(el('btn-confirm').disabled,false);
 await c.writingReference();assert.equal(stored.profile.examples.length,3);assert.equal(sent,0);
});
