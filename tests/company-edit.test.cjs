'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
function load(db){const box={module:{exports:{}},require:id=>{assert.equal(id,'../db');return db;}};vm.runInNewContext(fs.readFileSync(require.resolve('../utils/companies/edit'),'utf8'),box);return box.module.exports;}
const details={name:'Company',email:'jobs@example.test',phone:'+201012345678',field:'Software',location:'Cairo'};
test('company details validate international contact data without accepting arbitrary fields',()=>{
 const api=load({});assert.equal(api.validate(details).phone,'201012345678');assert.equal(api.validate({...details,email:' JOBS@EXAMPLE.TEST '}).email,'jobs@example.test');assert.equal(api.validate({...details,email:''}).phone,'201012345678');
 for(const [change,code] of [[{name:' '},'COMPANY_NAME_REQUIRED'],[{email:'bad'},'COMPANY_EMAIL_INVALID'],[{phone:'01012345678'},'WA_RECIPIENT_FORMAT'],[{email:'',phone:''},'COMPANY_CONTACT_REQUIRED'],[{field:42},'COMPANY_DETAILS_INVALID']])assert.throws(()=>api.validate({...details,...change}),e=>e.code===code);
 assert.equal(api.validate({...details,status:'sent',user_id:'other'}).status,undefined);
});
test('company editing isolates owners, preserves selection/status, detects stale edits and blocks active work',async()=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES('owner'),('other');
  CREATE TABLE companies(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,email TEXT,phone TEXT,field TEXT,location TEXT,status TEXT,selected INTEGER);
  INSERT INTO companies VALUES('company','owner','Old name','old@example.test','201000000000','Old field','Old location','sent',1);
  CREATE TABLE email_log(id TEXT,user_id TEXT,company_id TEXT,status TEXT);CREATE TABLE scheduled_jobs(id TEXT,user_id TEXT,company_id TEXT,status TEXT);
  CREATE TABLE campaigns(id TEXT,user_id TEXT,status TEXT);CREATE TABLE campaign_items(id TEXT,campaign_id TEXT,company_id TEXT,status TEXT);`);
  const query=(s,a)=>pg.query(s,a),api=load({pool:{connect:async()=>({query,release(){}})}});
  await assert.rejects(api.update('other','company',details),e=>e.code==='COMPANY_NOT_FOUND');
  const row=await api.update('owner','company',details);assert.equal(row.name,'Company');assert.equal(row.selected,1);assert.equal(row.status,'sent');assert.equal(row.user_id,'owner');
  const baseline=Object.fromEntries(['name','email','phone','field','location'].map(k=>[k,row[k]]));
  await assert.rejects(api.update('owner','company',{...details,name:'Changed'},{...baseline,name:'Stale'}),e=>e.code==='COMPANY_DETAILS_CHANGED');
  for(const sql of ["INSERT INTO scheduled_jobs VALUES('job','owner','company','pending')","INSERT INTO email_log VALUES('log','owner','company','uncertain')","INSERT INTO campaigns VALUES('campaign','owner','running');INSERT INTO campaign_items VALUES('item','campaign','company','ready')"]){
   await pg.exec(sql);await assert.rejects(api.update('owner','company',{...details,name:'Blocked'},baseline),e=>e.code==='COMPANY_EDIT_BUSY');await pg.exec('DELETE FROM scheduled_jobs;DELETE FROM email_log;DELETE FROM campaign_items;DELETE FROM campaigns');
  }
  assert.equal((await query("SELECT name FROM companies WHERE id='company'")).rows[0].name,'Company');
  const saved=await api.update('owner','company',{...details,name:'Updated'},baseline);assert.equal(saved.name,'Updated');
 }finally{await pg.close();}
});
test('company edit errors have explicit Arabic and English descriptions',()=>{
 const catalog=require('../utils/public-errors');for(const code of ['COMPANY_NAME_REQUIRED','COMPANY_DETAILS_INVALID','COMPANY_CONTACT_REQUIRED','COMPANY_EMAIL_INVALID','COMPANY_NOT_FOUND','COMPANY_DETAILS_CHANGED','COMPANY_EDIT_BUSY'])for(const lang of ['ar','en']){const result=catalog.describe({code,status:409},lang);assert.equal(result.code,code);if(lang==='en')assert(!/[\u0600-\u06ff]/.test(result.error));}
});
