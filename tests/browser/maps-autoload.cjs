'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('playwright');
const extractor=path.resolve(__dirname,'../../extensions/mrsaal-scraper/extractor.js');
function fixture({delay=1800,initialDelay=0}={}){
 return `<!doctype html><meta charset="utf-8"><title>Maps result loading fixture</title><style>body{margin:0;height:2200px;font:14px system-ui}#pane{height:250px;width:340px;overflow-y:auto;border:1px solid}article{height:160px;padding:10px;box-sizing:border-box}a{display:block}#other{height:100px;overflow:auto}</style><div id="other"><div style="height:500px">Unrelated scroller</div></div><aside id="pane"><div role="feed" aria-label="Results"></div></aside><script>
 const pane=document.getElementById('pane'),feed=pane.firstElementChild,batches=[[1,2],[2,3],[4,5],[6,7,8]];let batch=0,loading=false;
 function render(){feed.innerHTML=batches[batch].map(id=>'<article><a aria-label="Company '+id+'" href="https://www.google.com/maps/place/company-'+id+'/data=!1splace-'+id+'?tracking='+batch+'">Company '+id+'</a><p>Software company</p><p>Cairo</p></article>').join('')+(batch===batches.length-1?'<p>You have reached the end</p><p>You’ve reached the end of the list.</p>':'');pane.scrollTop=0;}
 pane.addEventListener('scroll',()=>{if(loading||batch===batches.length-1||pane.scrollTop+pane.clientHeight<pane.scrollHeight-8)return;loading=true;setTimeout(()=>{batch++;render();loading=false;},${delay});});
 setTimeout(render,${initialDelay});
 </script>`;
}
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS||'[]')});
  const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function visit(options={}){await page.route('https://www.google.com/maps/**',route=>route.fulfill({contentType:'text/html',body:fixture(options)}));await page.goto('https://www.google.com/maps/search/software+cairo');await page.addScriptTag({path:extractor});}
  await visit();await page.waitForSelector('article');
  assert.equal(await page.evaluate(()=>globalThis.MrsaalExtractor.findScroller(document,'maps').id),'pane');
  const result=await page.evaluate(async()=>{
   const progress=[];const output=await globalThis.MrsaalExtractor.run({limit:20,feedback:false,onProgress:p=>progress.push({...p})});return {output,progress,documentScroll:document.scrollingElement.scrollTop,other:document.getElementById('other').scrollTop};
  });
  assert.equal(result.output.rows.length,8);assert.equal(new Set(result.output.rows.map(r=>r.name)).size,8);assert.equal(result.output.reason,'end');assert.equal(result.documentScroll,0);assert.equal(result.other,0);
  assert(result.progress.some(p=>p.stage==='waiting'));assert(result.progress.some(p=>p.count>2));assert(result.progress.every((p,i,a)=>i===0||p.count>=a[i-1].count));
  console.log('Nested result pane, 1.8s delayed loads, virtualized/replaced cards, duplicates, live counts and end-of-list passed.');
  await page.unrouteAll();await visit({delay:1500,initialDelay:1200});
  const limit=await page.evaluate(()=>globalThis.MrsaalExtractor.run({limit:4,feedback:false}));assert.equal(limit.rows.length,4);assert.equal(limit.reason,'limit');
  console.log('Initial loading and exact requested limit passed.');
  await page.unrouteAll();await visit();await page.waitForSelector('article');
  const stopped=await page.evaluate(async()=>{const start=performance.now();const output=await globalThis.MrsaalExtractor.run({limit:20,onProgress:p=>{if(p.stage==='waiting')setTimeout(()=>globalThis.MrsaalExtractor.cancel(),80);}});return {output,elapsed:performance.now()-start,overlay:!!document.getElementById('mrsaal-scraper-feedback')};});
  assert(stopped.output.cancelled);assert.equal(stopped.output.reason,'cancelled');assert(stopped.elapsed<1000);assert(!stopped.overlay);
  console.log('Cancellation wakes pending load immediately and removes page feedback.');
  await page.unrouteAll();await visit();await page.waitForSelector('article');
  await page.evaluate(()=>{document.getElementById('pane').style.height='1200px';document.querySelector('[role=feed]').insertAdjacentHTML('beforeend',"<p>You've reached the end of the list.</p>");});
  const short=await page.evaluate(()=>globalThis.MrsaalExtractor.run({limit:20,feedback:false}));assert.equal(short.rows.length,2);assert.equal(short.reason,'end');
  console.log('Short lists with no scrollbar finish at the end notice.');
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
