'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plan=require('../public/assets/delivery-plan');
const both={id:'both',email:'test@example.com',phone:'201012345678'},email={id:'email',email:'test@example.com'},phone={id:'phone',phone:'201012345678'};
test('available mode chooses the only valid contact or the explicit preference; dual mode chooses both',()=>{
 for(const bothChannels of [false,true]){assert.deepEqual(plan.channels(email,{channel:'available',bothChannels}),['email']);assert.deepEqual(plan.channels(phone,{channel:'available',bothChannels}),['whatsapp']);}
 assert.deepEqual(plan.channels(both,{channel:'available'}),['email']);assert.deepEqual(plan.channels(both,{channel:'available',preferredChannel:'whatsapp'}),['whatsapp']);assert.deepEqual(plan.channels(both,{channel:'available',bothChannels:true}),['email','whatsapp']);
 assert.deepEqual(plan.channels({...both,email:'bad'},{channel:'available',bothChannels:true}),['whatsapp']);assert.deepEqual(plan.channels({id:'empty'},{channel:'available'}),['email']);
});
test('sent filtering is channel-specific and does not silently retry failed or uncertain sends',()=>{
 const sent=[{company_id:'both',channel:'email',status:'sent'}];assert.deepEqual(plan.channels(both,{channel:'available',bothChannels:true,skipSent:true},sent),['whatsapp']);assert.deepEqual(plan.channels(both,{channel:'available',skipSent:true},sent),['whatsapp']);assert.deepEqual(plan.channels(both,{channel:'email',skipSent:true},sent),[]);
 assert.deepEqual(plan.channels(both,{channel:'available',bothChannels:true,skipSent:true},[...sent,{company_id:'both',channel:'whatsapp',status:'sent'}]),[]);
 assert.deepEqual(plan.channels(both,{channel:'email',skipSent:true},[{company_id:'both',channel:'email',status:'failed'}]),['email']);
});
test('shared browser planning uses the same rules as server planning',()=>{const box={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/delivery-plan'),'utf8'),box);assert.equal(JSON.stringify(box.window.MrsaalDeliveryPlan.channels(both,{channel:'available',bothChannels:true})),JSON.stringify(plan.channels(both,{channel:'available',bothChannels:true})));});
test('mixed creation is transactional, owner-scoped, uses independent drafts and never sends before review',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),pg=new PGlite();const db={get:async(s,p)=>(await pg.query(s,p)).rows[0],all:async(s,p)=>(await pg.query(s,p)).rows,run:async(s,p)=>p===undefined?(await pg.exec(s),{rowCount:1}):pg.query(s,p),pool:{connect:async()=>({query:(s,p)=>pg.query(s,p),release(){}})}};
 function load(file,deps){const filename=path.resolve(__dirname,'..',file),base=require('node:module').createRequire(filename),box={module:{exports:{}},console,process,Buffer,require:id=>Object.hasOwn(deps,id)?deps[id]:base(id)};vm.runInNewContext(fs.readFileSync(filename,'utf8'),box);return box.module.exports;}
 try{
  await pg.exec(fs.readFileSync(require.resolve('../utils/db'),'utf8').match(/await query\(`([\s\S]*?)`\);/)[1]);await load('utils/launch-schema.js',{'./db':db}).ensureLaunchSchema();
  await pg.exec("INSERT INTO users(id,email) VALUES('owner','owner@test.com'),('other','other@test.com');INSERT INTO cv_profiles(id,user_id,content) VALUES('cv','owner','CV');INSERT INTO companies(id,user_id,name,email,phone) VALUES('both','owner','Both','b@test.com','201012345678'),('email','owner','Email','e@test.com',NULL),('phone','owner','Phone',NULL,'201012345678'),('foreign','other','Foreign','f@test.com','201012345678'),('missing','owner','Missing',NULL,NULL);INSERT INTO message_drafts(user_id,company_id,channel,subject,body) VALUES('owner','both','email','Subject','Email draft'),('owner','both','whatsapp','','WhatsApp draft');");
  const routes=[],router={use(){}};for(const method of ['get','post','patch'])router[method]=(route,...handlers)=>routes.push({method,route,handler:handlers.at(-1)});let accountLookups=0,rejectAccount=false;
  load('routes/campaigns.js',{express:{Router:()=>router},'../utils/db':db,'../middleware/auth':{requireAuth(){}},'../middleware/async-handler':f=>f,'../utils/cv-store':{active:async()=>({id:'cv'})},'../utils/gmail/accounts':{resolveAccount:async()=>{accountLookups++;if(rejectAccount)throw new Error('Reconnect Gmail');return {gmail_account_id:null};}}});
  async function create(extra={}){let data,status=200;const res={json:x=>data=x,status:s=>(status=s,res)};await routes.find(r=>r.method==='post'&&r.route==='/').handler({session:{userId:'owner'},body:{companyIds:['both','both','email','phone','foreign','missing'],channel:'available',bothChannels:true,...extra}},res);return {data,status};}
  const result=await create();assert.equal(result.data.campaigns.length,2);assert.equal(accountLookups,1);
  const rows=await db.all('SELECT c.channel,i.company_id,i.body,i.status FROM campaign_items i JOIN campaigns c ON c.id=i.campaign_id');
  assert.equal(rows.length,5);assert(!rows.some(r=>r.company_id==='foreign'));assert.equal(rows.find(r=>r.company_id==='both'&&r.channel==='email').body,'Email draft');assert.equal(rows.find(r=>r.company_id==='both'&&r.channel==='whatsapp').body,'WhatsApp draft');assert.equal(rows.find(r=>r.company_id==='missing').status,'skipped');assert(rows.every(r=>['draft','skipped'].includes(r.status)));
  await pg.exec("INSERT INTO email_log(id,user_id,company_id,channel,status) VALUES('sent','owner','both','email','sent');");
  const filtered=await create({companyIds:['both'],skipSent:true});assert.equal(filtered.data.campaigns.length,1);assert.equal(filtered.data.campaigns[0].channel,'whatsapp');assert.equal(accountLookups,1);
  await pg.exec("INSERT INTO email_log(id,user_id,company_id,channel,status) VALUES('wa-sent','owner','both','whatsapp','sent');");
  await assert.rejects(create({companyIds:['both'],skipSent:true}),e=>e.code==='CAMPAIGN_ALREADY_SENT');
  const repeat=await create({companyIds:['both'],skipSent:false});assert.equal(repeat.data.campaigns.length,2);
  await assert.rejects(create({companyIds:['foreign'],skipSent:false}),e=>e.code==='CAMPAIGN_SELECTION_STALE');
  const count=(await db.get('SELECT COUNT(*) AS n FROM campaigns')).n;rejectAccount=true;await assert.rejects(create(),/Reconnect Gmail/);assert.equal((await db.get('SELECT COUNT(*) AS n FROM campaigns')).n,count);
  assert.equal((await create({bothChannels:'true'})).status,400);
 }finally{await pg.close();}
});
test('sending controls enable dual checkbox only in available mode and summarize actual per-channel messages',()=>{
 const nodes={'send-channel':{value:'available'},'opt-send-both':{checked:true},'send-priority':{value:'email'},'opt-skip-sent':{checked:true},'send-filter':{value:'selected'},'channel-summary':{},'send-priority-field':{},'send-both-label':{style:{}},'send-both-hint':{}};
 const source=fs.readFileSync(require.resolve('../public/assets/app.js'),'utf8'),context={window:{MrsaalDeliveryPlan:plan},document:{getElementById:id=>nodes[id]},cvLabel:(_a,b)=>b,log:[],companies:[both,email,phone].map(c=>({...c,selected:true}))};
 vm.runInNewContext(source.slice(source.indexOf('function companyChannelReason'),source.indexOf('async function refreshPreviewAttachment')),context);context.updateChannelSummary();assert.match(nodes['channel-summary'].textContent,/2 email messages · 2 WhatsApp messages/);assert.equal(nodes['opt-send-both'].disabled,false);assert.equal(nodes['send-priority-field'].hidden,true);
 nodes['opt-send-both'].checked=false;context.updateChannelSummary();assert.match(nodes['channel-summary'].textContent,/2 email messages · 1 WhatsApp messages/);assert.equal(nodes['send-priority-field'].hidden,false);
 nodes['send-channel'].value='email';context.updateChannelSummary();assert.equal(nodes['opt-send-both'].disabled,true);assert.equal(nodes['send-priority-field'].hidden,true);
});
