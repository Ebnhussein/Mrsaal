// Boots the real server (server.js) against an in-memory Postgres and exercises the public surface over HTTP.
// Catches what unit tests with mocks cannot: startup crashes, route registration errors, middleware order.
const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),net=require('node:net'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {PGLiteSocketServer}=require('@electric-sql/pglite-socket');
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>resolve(port));});s.on('error',reject);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let db,socket,child,logs='';
test('server boots against Postgres and serves the public site, auth gate and request guard',{timeout:120000},async()=>{
 const [pgPort,port]=[await freePort(),await freePort()];
 db=new PGlite();await db.waitReady;socket=new PGLiteSocketServer({db,port:pgPort,host:'127.0.0.1',maxConnections:50});await socket.start();
 const base='http://127.0.0.1:'+port;
 child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),PGHOST:'127.0.0.1',PGPORT:String(pgPort),PGUSER:'postgres',PGPASSWORD:'x',PGDATABASE:'postgres',SESSION_SECRET:'boot-test-secret-0123456789',NODE_ENV:'test',BASE_URL:base},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>{logs+=d;});child.stderr.on('data',d=>{logs+=d;});
 let exited=null;child.on('exit',code=>{exited=code;});
 let ready=false;for(let i=0;i<240&&!ready&&exited===null;i++){try{ready=(await fetch(base+'/health')).status===200;}catch{}if(!ready)await sleep(500);}
 assert.ok(ready,'server never became healthy (exit '+exited+')\n'+logs.slice(-2500));
 // Every response keeps its path, status and a body/log excerpt so a failure explains itself.
 const get=async(p,o)=>{const res=await fetch(base+p,{redirect:'manual',...o});const body=await res.text();return {status:res.status,body,diag:p+' -> '+res.status+'\n'+body.slice(0,300)+'\n'+logs.slice(-1500)};};
 const expect=(r,status)=>assert.equal(r.status,status,r.diag);
 let r=await get('/ar/');expect(r,200);assert.match(r.body,/<meta name="description" content="[^"]{40,}">/);assert.match(r.body,/property="og:title"/);
 r=await get('/ar/privacy');expect(r,200);assert.match(r.body,/gmail\.send/);
 r=await get('/sitemap.xml');expect(r,200);assert.match(r.body,/<urlset/);
 r=await get('/api/companies');expect(r,401);
 r=await get('/api/does-not-exist');assert.ok([401,404].includes(r.status),r.diag);
 r=await get('/api/companies',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});expect(r,403);
 r=await get('/auth/logout',{headers:{'Sec-Fetch-Site':'cross-site'}});expect(r,302);
 r=await get('/no-such-page');expect(r,404);
});
test.after(async()=>{if(child&&child.exitCode===null){child.kill('SIGTERM');await sleep(300);if(child.exitCode===null)child.kill('SIGKILL');}try{await socket?.stop();}catch{}try{await db?.close();}catch{}});
