'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),zlib=require('node:zlib');
const {build,origin}=require('../scripts/build-scraper-extension.cjs');
const port=()=>new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const number=server.address().port;server.close(()=>resolve(number));});});
test('trial bundle binds the worker and permissions to its test origin and creates a readable ZIP',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mrsaal-bundle-'));try{
  const bundle=build({appOrigin:'http://localhost:4174',out:path.join(dir,'extension')});
  const manifest=JSON.parse(fs.readFileSync(path.join(bundle.directory,'manifest.json'),'utf8'));assert.deepEqual(manifest.host_permissions,['http://localhost:4174/*']);assert(manifest.name.includes('Trial'));
  const worker=fs.readFileSync(path.join(bundle.directory,'background.js'),'utf8');assert(worker.includes('const APP="http://localhost:4174";'));assert(!worker.includes('https://mrsaal.ebnhussein.co'));
  const zip=fs.readFileSync(bundle.zip);let offset=0,found=0;
  while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),nameSize=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+nameSize).toString(),start=offset+30+nameSize+extra;assert.deepEqual(zlib.inflateRawSync(zip.subarray(start,start+size)),fs.readFileSync(path.join(bundle.directory,name)));found++;offset=start+size;}
  assert.equal(found,6);assert.equal(zip.readUInt32LE(offset),0x02014b50);
  for(const bad of ['http://mrsaal.ebnhussein.co','https://example.test/app','https://user:pass@example.test','javascript:alert(1)'])assert.throws(()=>origin(bad));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('local trial exercises real imports in separate data, denies cross-origin writes and exposes no delivery endpoints',{timeout:30000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mrsaal-trial-'));let trial;
 try{
  trial=await require('../ops/scraper-trial/server.cjs').start({port:await port(),dataDir:dir});
  const base=new URL(trial.url).origin,home=await fetch(trial.url);assert.equal(home.status,200);assert((await home.text()).includes('TRIAL'));
  const cookie=home.headers.get('set-cookie').split(';')[0],headers={Cookie:cookie,'Content-Type':'application/json',Origin:base};
  const user=await (await fetch(base+'/api/discovery/session',{headers})).json();assert.equal(user.user.id,'scraper-trial-user');
  const payload={expectedUserId:user.user.id,source:{url:'https://directory.example/companies',adapter:'table',country:'EG'},rows:[{kind:'company',name:'Trial Company',email:'public@example.test'}]};
  const imported=await fetch(base+'/api/discovery/import',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(imported.status,200);assert.equal((await imported.json()).companiesAdded,1);
  const listing=await (await fetch(base+'/api/companies',{headers})).json();assert.equal(listing.companies.length,1);assert.equal(listing.companies[0].selected,0);
  assert.equal((await fetch(base+'/api/discovery/import',{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:JSON.stringify(payload)})).status,403);
  assert.equal((await fetch(base+'/api/discovery/session')).status,401);
  assert.equal((await fetch(base+'/api/email/send',{method:'POST',headers,body:'{}'})).status,404);
  const download=await fetch(base+'/extension.zip');assert.equal(download.status,200);assert.equal(Buffer.from(await download.arrayBuffer()).readUInt32LE(0),0x04034b50);
  await trial.close();trial=null;
  // Persistence survives a trial restart, without any production DB configuration.
  trial=await require('../ops/scraper-trial/server.cjs').start({port:Number(new URL(base).port),dataDir:dir});assert((await fetch(trial.url)).ok);
 }finally{await trial?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
