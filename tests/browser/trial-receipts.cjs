'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');const {chromium}=require('playwright');
(async()=>{
 let browser,trial;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mrsaal-ui-receipts-'));
 try{
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});trial=await require('../../ops/scraper-trial/server.cjs').start({port,dataDir:dir});
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS||'[]')});const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(trial.url);
  async function add(name,key){return page.evaluate(async({name,key})=>{const response=await fetch('/api/discovery/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:'scraper-trial-user',requestKey:key,source:{url:'https://www.google.com/maps/search/test',adapter:'maps',country:'EG'},rows:[{kind:'company',name,email:key+'@example.test',location:'Cairo',sourceUrl:'https://www.google.com/maps/place/'+key}]})});if(!response.ok)throw new Error(await response.text());return response.json();},{name,key});}
  const first=await add('Older saved company','older');assert(first.confirmed);await page.waitForFunction(()=>document.getElementById('companies').textContent.includes('Older saved company'),{timeout:7000});
  const second=await add('Newest verified company','newest');await page.waitForFunction(()=>document.getElementById('companies').textContent.includes('Newest verified company'),{timeout:7000});
  assert(!(await page.locator('#companies').textContent()).includes('Older saved company'));assert((await page.locator('#receipt').textContent()).includes(second.receiptId));
  assert.equal(await page.locator('#companies a').textContent(),'فتح المصدر');assert(!(await page.locator('#companies').textContent()).includes('https://'));
  await page.locator('#all-results').check();await page.waitForFunction(()=>document.querySelectorAll('#companies tr').length===2);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('Real HTTP import, receipt, automatic refresh, newest batch isolation, all-records toggle and bounded source links passed.');
 }finally{await browser?.close();await trial?.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
