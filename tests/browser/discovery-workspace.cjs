'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../../public');
let access=200,batchCount=1;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/discovery/')){
  if(access!==200){res.writeHead(access,{'Content-Type':'application/json'});return res.end('{}');}
  if(url.pathname.endsWith('extension.zip')){res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="mrsaal-scraper.zip"'});return res.end('zip fixture');}
  res.setHeader('Content-Type','application/json');
  return res.end(JSON.stringify(url.pathname.endsWith('session')?{user:{id:'owner',email:'owner@example.test'}}:url.pathname.endsWith('imports')?{imports:Array.from({length:batchCount},(_,i)=>({id:'r'+i,result:{companiesAdded:3,jobsAdded:1},source:{url:i?'javascript:alert(1)':'https://www.google.com/maps/search/test'},created_at:'2026-11-09T10:00:00Z'}))}:{jobs:[{id:'j1',title:'<img src=x onerror=alert(1)>',company_name:'Example company',job_url:'https://jobs.example.test/1',status:'needs_review'}],nextOffset:null}));
 }
 if(url.pathname==='/app'){
  const markup=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  res.setHeader('Content-Type','text/html');return res.end(markup.replace('</body>',`<script>document.querySelector('.app').classList.add('active');document.getElementById('app-loading').remove();document.getElementById('login-screen').remove();window.opened=[];window.open=(url)=>opened.push(url);window.nav=function(name){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));document.getElementById('workspace-current').textContent=name;};window.loadCompanies=async()=>{window.companiesRefreshed=true;};</script><script src="/assets/workspace-locale.js"></script><script src="/assets/discovery-workspace.js"></script></body>`));
 }
 const file=path.join(root,url.pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'text/plain');res.end(fs.readFileSync(file));
});
(async()=>{let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS||'[]')});
  const page=await browser.newPage();await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [360,768,1440]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/app');await page.evaluate(()=>window.MrsaalLocale.ready);
   // The mobile entry is on Companies; the sidebar provides the desktop entry.
   await page.evaluate(()=>window.nav('companies'));await page.locator('#page-companies button[onclick="nav(\'discovery\')"]').click();
   await page.waitForFunction(()=>document.getElementById('discovery-status').textContent.includes('owner@example.test'));assert(await page.locator('#page-discovery').isVisible());
   assert(await page.locator('#discovery-download').isEnabled());assert.equal(await page.locator('#discovery-imports article').count(),batchCount);
   assert.equal(await page.locator('#discovery-jobs img').count(),0);assert((await page.locator('#discovery-jobs').textContent()).includes('<img src=x'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Arabic overflow ${width}`);
   await page.evaluate(()=>window.MrsaalLocale.setLanguage('en'));await page.waitForFunction(()=>document.querySelector('#page-discovery h1').textContent==='Discover companies & jobs');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`English overflow ${width}`);
  }
  await page.locator('#discovery-query').fill('Media Buyer');await page.locator('#discovery-country').selectOption('SA');await page.locator('#discovery-mode').selectOption('remote');await page.locator('#discovery-job-search').click();
  assert((await page.evaluate(()=>window.opened.at(-1))).includes('Saudi%20Arabia%20remote'));
  const download=page.waitForEvent('download');await page.locator('#discovery-download').click();assert.equal((await download).suggestedFilename(),'mrsaal-scraper.zip');
  batchCount=2;await page.locator('#discovery-refresh').click();await page.waitForFunction(()=>document.querySelectorAll('#discovery-imports article').length===2);assert.equal(await page.locator('#discovery-imports a').count(),1);
  await page.locator('#discovery-companies').click();assert(await page.evaluate(()=>window.companiesRefreshed));
  await page.evaluate(()=>window.nav('discovery'));access=403;await page.locator('#discovery-refresh').click();await page.waitForFunction(()=>document.getElementById('discovery-status').textContent.includes('selected test accounts'));assert(await page.locator('#discovery-download').isDisabled());assert.equal(await page.locator('#discovery-imports article').count(),0);
  access=404;await page.locator('#discovery-refresh').click();await page.waitForFunction(()=>document.getElementById('discovery-status').textContent.includes('not reached the server'));
  access=200;await page.locator('#discovery-refresh').click();await page.waitForFunction(()=>!document.getElementById('discovery-download').disabled);
  if(process.env.MRSAAL_DISCOVERY_SCREENSHOT)await page.screenshot({path:process.env.MRSAAL_DISCOVERY_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('Workspace entry, ZIP download, gated access, errors, batch refresh, job links, XSS and responsive AR/EN layouts passed.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
