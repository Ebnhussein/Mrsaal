'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const dir=path.resolve(__dirname,'../../extensions/mrsaal-scraper');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname.slice(1);
 if(!['panel.html','panel.css','panel.js','extractor.js','games.js','logo.svg'].includes(name)){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Fixture</title><body></body>');}
 res.setHeader('Content-Type',name.endsWith('.svg')?'image/svg+xml':name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(path.join(dir,name)));
});
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS||'[]')});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  async function extract(html,url,options={}){await page.goto(base+'/fixture');await page.setContent(html);await page.addScriptTag({path:path.join(dir,'extractor.js')});return page.evaluate(({url,options})=>globalThis.MrsaalExtractor.extract(document,url,options),{url,options});}
  const maps=await extract(`<main><div><article><a aria-label="Public Company" href="https://www.google.com/maps/place/one">Public Company</a><p>Software company</p><p>Cairo</p><a href="https://public-company.example/">Website</a><a href="tel:+201012345678">+20 10 1234 5678</a></article><article><a aria-label="Another Company" href="https://www.google.com/maps/place/two">Another Company</a><p>Software company</p><p>Giza</p></article><article hidden><a href="https://www.google.com/maps/place/hidden">Hidden</a></article></div></main>`,'https://www.google.com/maps/search/software+cairo');
  assert.equal(maps.adapter,'maps');assert.equal(maps.rows.length,2);assert.equal(maps.rows[0].name,'Public Company');assert.equal(maps.rows[0].phone,'+201012345678');assert.equal(maps.rows[0].website,'https://public-company.example/');assert.equal(maps.rows[1].email,'');
  const polluted=await extract('<div role="feed"><article data-category="Marketing"><a aria-label="Agency" href="https://www.google.com/maps/place/agency/data=!1sabc"></a><p>4.8 (57)</p><p>Marketing</p><p>Cairo</p><p>“ممتازة وخدمة رائعة جدًا”</p><a href="tel:bad-number">Call</a><a href="mailto:invalid">Email</a></article></div>','https://www.google.com/maps/search/marketing');
  assert.equal(polluted.rows[0].location,'Cairo');assert.equal(polluted.rows[0].phone,'');assert.equal(polluted.rows[0].email,'');assert.equal(polluted.rows[0].field,'Marketing');
  const job={ '@context':'https://schema.org','@type':'JobPosting',title:'Frontend Developer',url:'https://jobs.example/1',hiringOrganization:{name:'Example Employer'},description:'<p>Build JavaScript interfaces</p>',jobLocation:{address:{addressLocality:'Cairo',addressCountry:'EG'}},jobLocationType:'TELECOMMUTE',employmentType:'FULL_TIME'};
  const structured=await extract('<h1>Frontend Developer</h1><script type="application/ld+json">'+JSON.stringify({'@graph':[job,{...job,title:'Unknown Employer',url:'https://jobs.example/2',hiringOrganization:null}]})+'</script>','https://jobs.example/');
  assert.equal(structured.adapter,'jsonld');assert.equal(structured.rows.length,2);assert.equal(structured.rows[0].workMode,'remote');assert.equal(structured.rows[0].country,'EG');assert.equal(structured.rows[1].companyName,'');assert.equal(structured.rows[1].website,'');assert.equal(structured.rows[0].description,'Build JavaScript interfaces');
  const table=await extract('<table><tr><th>اسم الشركة</th><th>البريد</th><th>هاتف</th><th>المدينة</th></tr><tr><td>شركة تجريبية</td><td>hello@example.test</td><td>٠١٠١٢٣٤٥٦٧٨</td><td>القاهرة</td></tr></table>','https://directory.example/');
  assert.equal(table.rows[0].name,'شركة تجريبية');assert.equal(table.rows[0].phone,'01012345678');assert.equal(table.rows[0].website,'');assert.equal(table.rows[0].location,'القاهرة');
  const card=await extract('<article class="result"><h3>QA Engineer</h3><a href="https://jobs.example/qa">Apply</a></article>','https://jobs.example/',{selector:'.result',kind:'job'});assert.equal(card.rows[0].title,'QA Engineer');assert.equal(card.rows[0].jobUrl,'https://jobs.example/qa');
  await page.evaluate(()=>document.title='Verify you are human');const blocked=await page.evaluate(()=>globalThis.MrsaalExtractor.run());assert.equal(blocked.rows.length,0);assert(blocked.warning);
  const search=await extract('<main><article><a href="https://careers.example/jobs/123"><h3>Media Buyer job — Cairo</h3></a><p>Apply for this job</p></article><article><a href="https://learn.example/marketing"><h3>Marketing course</h3></a></article></main>','https://www.google.com/search?q=media+buyer+jobs');
  assert.equal(search.adapter,'search');assert.equal(search.rows.length,1);assert.equal(search.rows[0].entryType,'link_only');assert.equal(search.rows[0].companyName,'');
  const posting=await extract('<main><h1>Media Buyer</h1><p>Manage campaigns in Cairo.</p><form><input type="file"><button type="submit">Apply</button></form></main>','https://careers.example/jobs/123');assert.equal(posting.adapter,'job-page');assert(posting.rows[0].description.includes('Manage campaigns'));
  const login=await extract('<h1>Sign in</h1><form><input type="password"><button type="submit">Sign in</button></form>','https://careers.example/jobs/123');assert(!login.rows.some(row=>row.entryType==='details'));
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));assert(!manifest.permissions.includes('cookies'));assert(!manifest.host_permissions.includes('<all_urls>'));assert.deepEqual(manifest.host_permissions,['https://mrsaal.ebnhussein.co/*']);
  // Render the real panel and drive its actual buttons with a Chrome transport
  // double. This tests UI safety/layout; it does not install an extension.
  await page.addInitScript(()=>{
   let changed,allowed=false;window.calls=[];const state={account:{id:'owner',email:'owner@example.test'},sourceTitle:'Public results page',sourceTabId:4,sourceUrl:'https://www.google.com/maps/search/companies',appOrigin:'https://mrsaal.ebnhussein.co',phase:'complete',lastResult:{companiesAdded:2,jobsAdded:1,duplicates:1},lastRows:[{kind:'company',name:'<img src=x onerror=alert(1)>',phone:'+201000000000',sourceUrl:'https://example.test/'}]};
   window.setPanelState=patch=>{Object.assign(state,patch);changed?.({},'session');};window.setPanelQueue=value=>{state.hasPendingImport=value;changed?.({pendingImport:{}},'local');};
   window.chrome={runtime:{sendMessage:async message=>{window.calls.push(message);return ({ok:true,data:['state','bootstrap'].includes(message.action)?state:message.action==='saved'?{jobs:[{title:'Developer',company_name:'Employer',job_url:'https://example.test/job'}]}:message.action==='connect'?{account:state.account}:{}});}},storage:{local:{get:async()=>({language:'ar'}),set:async()=>{}},onChanged:{addListener(fn){changed=fn;}}},tabs:{create:async()=>{},query:async()=>[{id:4,url:state.sourceUrl}]},permissions:{contains:async()=>allowed,request:async input=>{window.permissionRequest=input;allowed=true;return true;}}};
  });
  for(const width of [280,360,480]){
   await page.setViewportSize({width,height:900});await page.goto(base+'/panel.html');await page.waitForFunction(()=>document.getElementById('account').textContent==='owner@example.test');
   assert.equal(await page.locator('#search-maps').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#preview img').count(),0);assert((await page.locator('#status').textContent()).includes('2'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Arabic panel overflow ${width}`);
   assert(await page.locator('#auto-scroll').isChecked());
   await page.evaluate(()=>window.setPanelState({phase:'collecting',progress:{stage:'waiting',count:12,limit:100,latest:['Company A']}}));
   await page.waitForFunction(()=>document.getElementById('live-count').textContent==='12');
   assert.equal(await page.locator('#activity').getAttribute('aria-busy'),'true');
   assert.equal(await page.locator('#collection-progress').getAttribute('aria-valuenow'),'12');
   assert.equal(await page.locator('#activity-icon').evaluate(el=>getComputedStyle(el).animationName),'spin');
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#activity-icon').evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>window.setPanelState({phase:'importing',progress:{stage:'importing',count:12,limit:100}}));
   await page.waitForFunction(()=>document.getElementById('activity').dataset.state==='importing');
   await page.evaluate(()=>window.setPanelState({phase:'complete',progress:{stage:'complete',count:12,limit:100}}));
   await page.waitForFunction(()=>document.getElementById('activity').getAttribute('aria-busy')==='false');
   await page.locator('#language').click();await page.waitForFunction(()=>document.documentElement.lang==='en');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`English panel overflow ${width}`);
   await page.locator('#saved').click();await page.waitForFunction(()=>document.querySelector('#saved-jobs a'));assert.equal(await page.locator('#saved-jobs a').getAttribute('href'),'https://example.test/job');
  }
  await page.evaluate(()=>window.setPanelQueue(true));await page.waitForFunction(()=>document.getElementById('collect').disabled);assert(await page.locator('#retry-save').isVisible());await page.evaluate(()=>window.setPanelQueue(false));await page.waitForFunction(()=>!document.getElementById('collect').disabled);assert(await page.locator('#retry-save').isHidden());
  await page.locator('#waiting-games').evaluate(el=>{el.open=true;});
  await page.locator('#snake-start').click();const before=await page.locator('#snake-board').evaluate(el=>el.toDataURL());await page.waitForTimeout(190);const after=await page.locator('#snake-board').evaluate(el=>el.toDataURL());assert.notEqual(before,after);await page.locator('#snake-pause').click();
  await page.locator('#game-choice').selectOption('xo');await page.locator('#xo-board button').first().click();await page.waitForFunction(()=>document.querySelector('#xo-board').textContent.includes('O'));
  await page.locator('#collect').click();await page.waitForFunction(()=>window.permissionRequest);assert.deepEqual(await page.evaluate(()=>window.permissionRequest.origins),['https://www.google.com/*']);
  assert((await page.evaluate(()=>window.calls.filter(c=>c.action==='collect'))).every(c=>c.sourceTabId===4));
  await page.locator('#query').fill('Media Buyer');await page.locator('#search-jobs').click();assert(await page.evaluate(()=>window.calls.some(c=>c.action==='search'&&c.url.includes('google.com/search'))));
  if(process.env.MRSAAL_PANEL_SCREENSHOT)await page.screenshot({path:process.env.MRSAAL_PANEL_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('Job/search adapters, Snake/XO, site permission/source selection, pending-save UI unlock, XSS, reduced motion and bilingual layouts passed.');
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
