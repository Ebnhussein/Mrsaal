'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const validate=require('../utils/discovery/validate');
const source={url:'https://www.google.com/maps/search/software+cairo',adapter:'maps',country:'EG'};
const company={kind:'company',name:'Example Company',phone:'+20 10 1234 5678',location:'Cairo',website:'https://example.test/',sourceUrl:'https://www.google.com/maps/place/Example'};
const job={kind:'job',companyName:'Example Company',title:'Developer',jobUrl:'https://careers.example.test/jobs/1',location:'Cairo',description:'JavaScript experience',workMode:'remote'};
function load(file,deps){const box={module:{exports:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:require(id),process,console,Buffer,URL};vm.runInNewContext(fs.readFileSync(require.resolve('../'+file),'utf8'),box);return box.module.exports;}
test('discovery validates bounded rows, URLs and regions without trusting client owner IDs or fabricating contact details',()=>{
 const result=validate.batch({rows:[company,{...job,companyName:''}],source});assert.equal(result.rows[0].phone,'+201012345678');assert.equal(result.rows[0].email,'');assert.equal(result.rows[1].companyName,'');assert.equal(result.rows[1].name,'');assert.equal(validate.batch({rows:[{...job,jobUrl:job.jobUrl+'?utm_source=search&gh_src=campaign'}],source}).rows[0].jobUrl,job.jobUrl);
 for(const bad of [{rows:[],source},{rows:Array(251).fill(company),source},{rows:[{...company,name:''}],source},{rows:[{...company,email:'not-an-email'}],source},{rows:[{...company,website:'javascript:alert(1)'}],source},{rows:[{...job,jobUrl:'https://name:password@example.test/jobs'}],source},{rows:[{...job,title:''}],source},{rows:[company],source:{...source,country:'US'}}])assert.throws(()=>validate.batch(bad),e=>e.code==='DISCOVERY_INPUT');
});
test('imports isolate accounts, deduplicate repeat jobs/companies, keep sources and never select recipients or send messages',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),pg=new PGlite();
 const query=(sql,args)=>args?pg.query(sql,args):pg.exec(sql);
 const db={pool:{connect:async()=>({query,release(){}})},get:async(s,p)=>(await pg.query(s,p)).rows[0],all:async(s,p)=>(await pg.query(s,p)).rows,run:query};
 try{
  const base=fs.readFileSync(require.resolve('../utils/db'),'utf8').match(/await query\(`([\s\S]*?)`\);/)[1];await pg.exec(base);
  const schema=load('utils/launch-schema.js',{'./db':db});await schema.ensureLaunchSchema();await schema.ensureLaunchSchema();
  await pg.exec("INSERT INTO users(id,email) VALUES('owner','owner@example.test'),('other','other@example.test')");
  const store=load('utils/discovery/store.js',{'../db':db,'../usage/resources':require('../utils/usage/resources')});
  const first=await store.importRows('owner',validate.batch({rows:[company,job],source}));assert.equal(first.companiesAdded,1);assert.equal(first.jobsAdded,1);
  const row=await db.get("SELECT * FROM companies WHERE user_id='owner'");assert.equal(row.selected,0);assert.equal(row.status,'pending');assert.equal(row.discovery_meta.website,company.website);assert.equal(row.discovery_meta.searchCountry,'EG');
  const again=await store.importRows('owner',validate.batch({rows:[company,job],source}));assert.equal(again.companiesAdded,0);assert.equal(again.jobsAdded,0);assert.equal(again.duplicates,2);
  await store.importRows('other',validate.batch({rows:[company,job],source}));assert.equal((await db.get('SELECT COUNT(*) AS n FROM companies')).n,2);
  const unknown=await store.importRows('owner',validate.batch({rows:[{...job,companyName:'',jobUrl:'https://careers.example.test/jobs/2'}],source}));assert.equal(unknown.companiesAdded,0);assert.equal(unknown.jobsAdded,1);
  assert.equal((await db.get("SELECT company_id FROM discovered_jobs WHERE job_url LIKE '%/2'")).company_id,null);
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM email_log')).n,0);assert.equal((await db.get('SELECT COUNT(*) AS n FROM campaigns')).n,0);
  // Resource limits roll back the entire batch, including earlier inserts.
  await pg.exec("UPDATE users SET company_limit=2 WHERE id='owner'");
  await assert.rejects(store.importRows('owner',validate.batch({rows:[{...company,name:'New A',phone:'',email:''},{...company,name:'New B',phone:'',email:''}],source})),e=>e.code==='RESOURCE_LIMIT');
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM companies WHERE user_id='owner'")).n,1);
  const handlers={};const router={use(){},get(p,...h){handlers['GET '+p]=h.at(-1);},post(p,...h){handlers['POST '+p]=h.at(-1);}};
  load('routes/discovery.js',{express:{Router:()=>router},'../middleware/auth':{requireAuth(){}},'../middleware/async-handler':f=>f,'../utils/db':db,'../utils/discovery/validate':validate,'../utils/discovery/store':store});
  const invoke=async(key,user,body={})=>{const res={statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;},setHeader(){}};await handlers[key]({session:{userId:user},body,query:{}},res);return res;};
  const changed=await invoke('POST /import','owner',{expectedUserId:'other',rows:[company],source});assert.equal(changed.statusCode,409);
  const listing=await invoke('GET /jobs','other');assert.equal(listing.body.jobs.length,1);assert(listing.body.jobs.every(r=>r.user_id==='other'));
  assert.equal((await invoke('GET /session','owner')).body.user.id,'owner');
 }finally{await pg.close();}
});
