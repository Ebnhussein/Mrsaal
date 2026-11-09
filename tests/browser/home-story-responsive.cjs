'use strict';
// Run with `node tests/browser/home-story-responsive.cjs` after installing Playwright Chromium.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {render}=require('../../utils/website/site-template');
const publicDir=path.resolve(__dirname,'../../public');
const mime={'.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(/^\/(ar|en)\/$/.test(pathname)){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(render(pathname.slice(1,3),'home'));}
 const file=path.resolve(publicDir,'.'+pathname);
 if(!file.startsWith(publicDir+path.sep)){res.statusCode=403;return res.end();}
 try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:JSON.parse(process.env.PLAYWRIGHT_LAUNCH_ARGS||'[]')});
  const errors=[];
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  async function visit(lang,width,height){
   await page.setViewportSize({width,height});await page.goto(url+'/'+lang+'/');
   await page.evaluate(async()=>{document.documentElement.style.scrollBehavior='auto';await document.fonts.ready;});
   await page.waitForTimeout(60);
  }
  async function shot(index){
   // Align the selected chapter with the visible reading area. Repeat after
   // the initial scroll brings the stage into its sticky position.
   for(let pass=0;pass<3;pass++){
    await page.evaluate(i=>{
     const r=document.querySelector('.hs-stage').getBoundingClientRect();
     const nav=document.querySelector('.sx-bottom-nav').getBoundingClientRect();
     const bottom=nav.height?nav.top:innerHeight;
     const top=parseFloat(getComputedStyle(document.querySelector('.hs-stage')).top);
     const stageBottom=top+r.height;
     const target=innerWidth<=760?stageBottom+Math.max(0,bottom-stageBottom)*.5:top+r.height/2;
     const step=document.querySelector('[data-step="'+i+'"]').getBoundingClientRect();
     window.scrollBy(0,step.top+step.height/2-target);
    },index);
    await page.waitForTimeout(35);
   }
   const result=await page.evaluate(()=>{
    const stage=document.querySelector('.hs-stage').getBoundingClientRect();
    const header=document.querySelector('.sx-site-header').getBoundingClientRect();
    const nav=document.querySelector('.sx-bottom-nav').getBoundingClientRect();
    return {label:document.querySelector('[data-story-count]').textContent,stage:stage.toJSON(),headerBottom:header.bottom,bottom:nav.height?nav.top:innerHeight,opacities:[...document.querySelectorAll('[data-scene]')].map(s=>Number(s.style.opacity)),active:document.querySelector('.hs-step.is-active')?.dataset.step};
   });
   assert.equal(result.label,String(index+1).padStart(2,'0')+' / 06');
   assert.equal(result.active,String(index));assert(result.opacities[index]>.95);
   const fits=await page.locator('[data-scene="'+index+'"]').evaluate(scene=>{
    const canvas=scene.parentElement.getBoundingClientRect();
    const nodes=[...scene.querySelectorAll('.hs-action,.hs-narration')].map(el=>el.getBoundingClientRect());
    return {canvas:canvas.toJSON(),nodes:nodes.map(r=>r.toJSON()),ok:nodes[0].bottom<=nodes[1].top+1&&nodes.every(r=>r.top>=canvas.top-1&&r.bottom<=canvas.bottom+1&&r.left>=canvas.left-1&&r.right<=canvas.right+1)};
   });
   assert(fits.ok,'Scene '+index+' content must fit inside the card: '+JSON.stringify(fits));
   assert(result.stage.top>=result.headerBottom+4,JSON.stringify(result));
   assert(result.stage.bottom<=result.bottom+1,JSON.stringify(result));
   return result;
  }
  const sizes=[[320,480],[360,640],[390,844],[414,896],[667,375],[760,900],[761,900],[768,1024],[820,1180],[1023,768],[1024,768],[1280,720],[1366,617],[1440,900],[1920,1080],[2049,926],[1280,480]];
  for(const lang of ['en','ar'])for(const [width,height] of sizes){
   await visit(lang,width,height);
   const inline=await page.locator('.hs-home').evaluate(el=>el.classList.contains('hs-inline'));
   if(inline){
    assert.equal(await page.locator('.hs-inline-stage').count(),6);
    for(let i=0;i<6;i++){
     const card=page.locator('[data-step="'+i+'"] .hs-inline-stage');
     await card.scrollIntoViewIfNeeded();assert(await card.isVisible());
     assert.equal(await card.locator('.hs-scene').count(),1);
     const fits=await card.evaluate(card=>{const c=card.querySelector('.hs-canvas').getBoundingClientRect();const a=card.querySelector('.hs-action').getBoundingClientRect();const n=card.querySelector('.hs-narration').getBoundingClientRect();return {canvas:c.toJSON(),action:a.toJSON(),narration:n.toJSON(),ok:a.top>=c.top&&a.bottom<=n.top+1&&n.bottom<=c.bottom};});
     assert(fits.ok,lang+' '+width+'x'+height+' inline '+i+' must fit: '+JSON.stringify(fits));
     assert.equal(await card.locator('.hs-stage-bottom span:last-child').textContent(),String(i+1).padStart(2,'0')+' / 06');
    }
   }else{
    for(const i of [0,1,2,3,4,5,4,2,0])await shot(i);
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${lang} ${width}x${height} horizontal overflow`);
   console.log(`${lang} ${width}x${height}: ${inline?'matching inline cards':'all six scenes forward and reverse'} passed`);
  }
  // Rotation and address-bar-style resizes must reconfigure without a reload,
  // and repeated changes must not duplicate the fallback cards.
  await visit('ar',390,844);await shot(3);
  for(const size of [{width:667,height:375},{width:390,height:844},{width:360,height:640},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForTimeout(80);
   if(size.height===844)await shot(3);
  }
  assert.equal(await page.locator('.hs-inline-stage').count(),6);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);
  assert(await page.locator('.hs-home.hs-inline').count());assert.equal(await page.locator('.hs-inline-stage').count(),6);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(80);await shot(4);
  const noJS=page;await noJS.setViewportSize({width:360,height:640});await noJS.route('**/*.js*',route=>route.abort());
  await noJS.goto(url+'/en/');assert.equal(await noJS.locator('[data-step]').count(),6);assert(await noJS.locator('[data-step="5"]').isVisible());await noJS.close();
  assert.deepEqual(errors,[]);console.log('Rotation, repeated resize, reduced motion, no-JS and browser console checks passed.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
