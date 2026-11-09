/* Runs only after a toolbar action grants activeTab. No cookies, form values,
   remote scripts, private APIs or background network requests are read. */
(() => {
 'use strict';
 const VERSION='0.3.0';
 if(globalThis.MrsaalExtractor?.version===VERSION)return;
 globalThis.MrsaalExtractor?.cancel();
 let cancelled=false,wakeWait=null;
 const clean=(value,max=200)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
 const digits=value=>String(value||'').replace(/[٠-٩]/g,n=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).replace(/[۰-۹]/g,n=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n)));
 function safeUrl(value,base){if(typeof value!=='string'||!value.trim())return '';try{const u=new URL(value,base);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 function visible(el){return !!el?.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';}
 function bodyText(el){return el?.innerText||el?.textContent||'';}
 function contacts(el,base){
  const links=[...el.querySelectorAll('a[href]')];
  const mail=links.find(a=>a.getAttribute('href').startsWith('mailto:'));
  const tel=links.find(a=>a.getAttribute('href').startsWith('tel:'));
  const raw=digits(bodyText(el));
  const email=mail?mail.getAttribute('href').slice(7).split('?')[0]:(raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[''])[0];
  const phone=tel?tel.getAttribute('href').slice(4):(raw.match(/(?:\+\d{1,3}[\s-]*|0)(?:\d[\s()-]*){7,14}\d/)||[''])[0];
  const website=links.map(a=>safeUrl(a.href,base)).find(url=>{try{return !/(^|\.)google\.[a-z.]+$/.test(new URL(url).hostname)&&new URL(url).origin!==new URL(base).origin;}catch{return false;}})||'';
  return {email:clean(email,254),phone:clean(phone,40).replace(/[\s()-]/g,''),website};
 }
 function maps(doc,base){
  const links=[...doc.querySelectorAll('a[href*="/maps/place/"]')].filter(visible),rows=[];
  for(const link of links){
   let card=link.parentElement;
   for(let n=0;n<7&&card?.parentElement;n++){
    if(card.parentElement.matches('[role="feed"]')||scrollable(card.parentElement)||card.parentElement.querySelectorAll('a[href*="/maps/place/"]').length>1)break;
    card=card.parentElement;
   }
   if(!card)continue;
   const name=clean(link.getAttribute('aria-label')||bodyText(link)||card.querySelector('h2,h3')?.textContent);
   if(!name)continue;
   const lines=bodyText(card).split('\n').map(s=>clean(s)).filter(s=>s&&s!==name&&!/^(?:[\d.]+\s*(?:\(|stars)|\(?\d+\)?$|Website|Directions|Open|Closed|Closes|Opens|No reviews|موقع|الاتجاهات|مفتوح|مغلق)/i.test(s));
   rows.push({kind:'company',name,...contacts(card,base),field:lines[0]||'',location:clean(lines.slice(1).filter(line=>!/["“”👍⭐]|reviews?|خدمة|ممتاز|مشاكل|سهولة|جودة|الموقع الإلكتروني|الموقع|الاتجاهات|حجز|مواعيد|دائمًا|عرض المزيد|Website|Directions|online|appointment/iu.test(line)&&!/(?:\+|0)[\d ()-]{7,}/.test(digits(line))).slice(0,2).join(', ')),sourceUrl:safeUrl(link.href,base)});
  }
  return rows;
 }
 function structured(doc,base){
  const rows=[];let seen=0;
  function walk(data,depth=0){
   if(!data||depth>12||++seen>2000)return;
   if(Array.isArray(data)){data.slice(0,500).forEach(d=>walk(d,depth+1));return;}
   if(typeof data!=='object')return;
   const type=[data['@type']].flat();
   if(type.includes('JobPosting')){
    const places=[data.jobLocation].flat().filter(Boolean).map(p=>p.address||p);
    const a=places[0]||{};const country=typeof a.addressCountry==='string'?a.addressCountry:a.addressCountry?.name||'';
    // Decode text without creating images/links from untrusted JSON-LD HTML.
    const description=doc.createElement('textarea');description.innerHTML=String(data.description||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ');
    const title=clean(data.title||data.name),jobUrl=safeUrl(data.url||base,base);
    if(title&&jobUrl)rows.push({kind:'job',title,companyName:clean(data.hiringOrganization?.name),website:safeUrl(data.hiringOrganization?.sameAs||'',base),description:clean(description.value,16000),jobUrl,sourceUrl:base,location:clean(places.map(p=>[p.addressLocality,p.addressRegion,typeof p.addressCountry==='string'?p.addressCountry:p.addressCountry?.name].filter(Boolean).join(', ')).join(' / ')),country:['EG','SA','AE','KW','QA','BH','OM'].includes(country.toUpperCase())?country.toUpperCase():'',workMode:data.jobLocationType==='TELECOMMUTE'?'remote':'',employmentType:clean([data.employmentType].flat().filter(Boolean).join(', '),100)});
   }
   for(const [key,value] of Object.entries(data))if(key!=='description')walk(value,depth+1);
  }
  for(const el of doc.querySelectorAll('script[type="application/ld+json"]')){try{walk(JSON.parse(el.textContent));}catch{}}
  return rows;
 }
 function tables(doc,base){
  const rows=[];
  const columns={name:/^(?:company|company name|business|name|الشركة|اسم الشركة|الاسم)$/i,email:/email|بريد|إيميل/i,phone:/phone|mobile|هاتف|موبايل/i,location:/location|address|عنوان|موقع|مدينة/i,website:/website|الموقع الإلكتروني/i,title:/job title|position|المسمى|الوظيفة/i};
  for(const table of doc.querySelectorAll('table')){
   if(!visible(table))continue;
   const trs=[...table.querySelectorAll('tr')],heads=[...trs[0]?.querySelectorAll('th,td')||[]].map(el=>clean(bodyText(el)));
   const indices=Object.fromEntries(Object.entries(columns).map(([key,re])=>[key,heads.findIndex(s=>re.test(s))]));
   if(indices.name<0&&indices.title<0)continue;
   for(const tr of trs.slice(1,251)){
    const cells=[...tr.querySelectorAll('td')];if(!cells.length)continue;
    const read=key=>indices[key]>=0?clean(bodyText(cells[indices[key]]),key==='email'?254:200):'';
    const links=[...tr.querySelectorAll('a[href]')];
    const row={kind:indices.title>=0?'job':'company',name:read('name'),companyName:read('name'),title:read('title'),email:read('email'),phone:digits(read('phone')).replace(/[\s()-]/g,''),location:read('location'),website:safeUrl(cells[indices.website]?.querySelector('a[href]')?.href||read('website'),base),sourceUrl:base};
    if(row.kind==='job')row.jobUrl=safeUrl(links.find(a=>/jobs?|careers?|vacanc/i.test(a.href))?.href||'',base);
    if(row.kind==='company'&&row.name||row.kind==='job'&&row.title&&row.jobUrl)rows.push(row);
   }
  }
  return rows;
 }
 function custom(doc,base,selector,kind){
  if(!selector||selector.length>300)return [];
  let cards;try{cards=[...doc.querySelectorAll(selector)].filter(visible).slice(0,250);}catch{throw new Error('راجع محدد العناصر CSS selector.');}
  return cards.map(card=>{
   const title=clean(bodyText(card.querySelector('h1,h2,h3,h4,[data-title]'))||card.querySelector('a')?.textContent);
   const link=card.querySelector('a[href]');
   return {kind,name:kind==='company'?title:'',title:kind==='job'?title:'',...contacts(card,base),sourceUrl:base,jobUrl:kind==='job'?safeUrl(link?.href||'',base):'',description:kind==='job'?clean(bodyText(card),16000):''};
  }).filter(r=>r.kind==='company'?r.name:r.title&&r.jobUrl);
 }
 function jobLinks(doc,base,search=false){
  const rows=[],seen=new Set();
  const anchors=search?[...doc.querySelectorAll('h3')].map(h=>h.closest('a')):[...doc.querySelectorAll('a[href]')].filter(a=>a.querySelector('h2,h3')||a.closest('[data-job-id],.job-card,[data-testid*="job-card"]'));
  for(const a of anchors){
   if(!a||!visible(a))continue;let href=safeUrl(a.href,base);
   if(!href)continue;const u=new URL(href);
   if(/(^|\.)google\.[a-z.]+$/.test(u.hostname)){href=safeUrl(u.searchParams.get('q')||u.searchParams.get('url')||'',base);if(!href)continue;}
   if(new URL(href).origin===new URL(base).origin&&search||seen.has(href))continue;
   const title=clean(a.querySelector('h2,h3')?.textContent||a.textContent);if(!title)continue;
   let card=a.closest('article,[data-job-id],.job-card,[data-testid*="job-card"]')||a.parentElement;
   for(let n=0;n<3&&card?.parentElement;n++){if(card.parentElement.querySelectorAll('h3').length>1)break;card=card.parentElement;}
   const snippet=clean(bodyText(card),2500);
   if(search&&!/jobs?|careers?|vacanc|وظائف|وظيفة|توظيف|فرص عمل|فرصة عمل|wuzzuf|bayt\.com|linkedin\.com|indeed\.|gulftalent|naukrigulf/i.test(href+' '+title+' '+snippet))continue;
   seen.add(href);rows.push({kind:'job',title,companyName:'',description:snippet,jobUrl:href,sourceUrl:base,entryType:'link_only'});
  }
  return rows;
 }
 function jobPage(doc,base){
  const heading=doc.querySelector('h1');if(!heading||!/(?:jobs?|careers?|vacanc|وظائف|وظيفة)/i.test(new URL(base).pathname)||!doc.querySelector('form,input[type="file"],a[href*="apply"],button[type="submit"]'))return [];
  if(doc.querySelector('input[type="password"]')&&/sign in|log in|تسجيل الدخول/i.test(heading.textContent))return [];
  const text=bodyText(doc.querySelector('main')||doc.body).split(/Apply for this job|Submit application|التقديم على الوظيفة/i)[0];
  return [{kind:'job',title:clean(heading.textContent),companyName:clean(doc.querySelector('[itemprop="hiringOrganization"] [itemprop="name"],[data-company-name]')?.textContent),description:clean(text,12000),jobUrl:base,sourceUrl:base,entryType:'details'}];
 }
 function extract(doc,base,options={}){
  if(options.selector)return {adapter:'custom',rows:custom(doc,base,options.selector,options.kind||'company')};
  if(/(^|\.)google\.[a-z.]+$/.test(new URL(base).hostname)&&new URL(base).pathname.startsWith('/maps'))return {adapter:'maps',rows:maps(doc,base)};
  if(/(^|\.)google\.[a-z.]+$/.test(new URL(base).hostname)&&new URL(base).pathname==='/search')return {adapter:'search',rows:jobLinks(doc,base,true)};
  const jobs=structured(doc,base);if(jobs.length)return {adapter:'jsonld',rows:jobs};
  const page=jobPage(doc,base);if(page.length)return {adapter:'job-page',rows:page};
  const table=tables(doc,base);if(table.length)return {adapter:'table',rows:table};
  return {adapter:'job-cards',rows:jobLinks(doc,base)};
 }
 function blocked(doc){return /^(?:Just a moment|Access Denied|Verify you are human|Attention Required)/i.test(doc.title)||[...doc.querySelectorAll('input[name="captcha"],iframe[src*="hcaptcha.com/captcha"],iframe[title*="challenge"]')].some(visible);}
 function key(row,source){
  if(row.kind==='job')return row.jobUrl;
  const place=row.sourceUrl?.match(/!1s([^!/?]+)/)?.[1];
  if(place)return 'maps:'+place;
  if(row.sourceUrl&&row.sourceUrl!==source){const url=new URL(row.sourceUrl);return url.origin+url.pathname;}
  return row.name+'|'+row.email+'|'+row.phone;
 }
 function scrollable(el){return !!el&&el.clientHeight>60&&el.scrollHeight>el.clientHeight+4&&/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY);}
 function findScroller(doc,adapter){
  if(adapter==='maps'){
   // Maps scrolls its result pane, which is often outside the role=feed node.
   // Walk the actual place-card ancestors instead of scrolling the document.
   for(const link of doc.querySelectorAll('a[href*="/maps/place/"]')){
    for(let el=link.parentElement;el&&el!==doc.body;el=el.parentElement)if(scrollable(el))return el;
   }
   const feed=[...doc.querySelectorAll('[role="feed"]')].find(visible);
   if(feed){for(let el=feed;el&&el!==doc.body;el=el.parentElement)if(scrollable(el))return el;}
   return feed||null;
  }
  return doc.scrollingElement;
 }
 function listEnded(scroller){return /you[’']ve reached the end of the list|reached the end of the results|وصلت (?:إلى|الى) نهاية القائمة|نهاية نتائج البحث/i.test(bodyText(scroller));}
 function feedback(language){
  const host=document.createElement('div');host.id='mrsaal-scraper-feedback';
  const shadow=host.attachShadow({mode:'closed'}),english=language==='en';
  shadow.innerHTML=`<style>:host{all:initial;position:fixed;top:88px;right:18px;z-index:2147483647;width:244px;font:13px/1.6 system-ui;color:#173c30}*{box-sizing:border-box}.card{background:#fff;border:1px solid #bad8c7;box-shadow:0 10px 36px #173c3028;border-radius:16px;padding:14px}.top{display:flex;align-items:center;gap:8px;font-weight:750}.dot{width:10px;height:10px;border-radius:50%;background:#1b7955;animation:pulse 1.2s ease-in-out infinite}.count{font-size:30px;font-weight:750;margin:8px 0 0}.stage{font-size:12px;color:#5c7066;min-height:20px}button{margin-top:10px;border:1px solid #cbded3;border-radius:8px;padding:5px 12px;background:#f2f8f4;color:#196c4c;font:inherit;cursor:pointer}@keyframes pulse{50%{box-shadow:0 0 0 7px #1b79551a;opacity:.55}}@media(prefers-reduced-motion:reduce){.dot{animation:none}}</style><div class="card" dir="${english?'ltr':'rtl'}"><div class="top"><i class="dot"></i>Mrsaal Scraper</div><div class="count">0</div><div class="stage"></div><button type="button">${english?'Stop collecting':'إيقاف الجمع'}</button></div>`;
  shadow.querySelector('button').addEventListener('click',()=>{cancelled=true;wakeWait?.('cancelled');});
  document.documentElement.append(host);
  return {update(progress){shadow.querySelector('.count').textContent=String(progress.count);const labels=english?{scanning:'Reading companies…',scrolling:'Loading more results…',waiting:'Waiting for Maps…',complete:'Collection finished',stopped:'Collection stopped'}:{scanning:'بنجمع بيانات الشركات…',scrolling:'بنحمّل نتائج جديدة…',waiting:'مستنيين تحميل النتائج…',complete:'اكتمل الجمع',stopped:'توقف الجمع'};shadow.querySelector('.stage').textContent=labels[progress.stage]||progress.stage;},remove(){host.remove();}};
 }
 function waitForResults(source,options,unique,scroller,timeout){
  return new Promise(resolve=>{
   let observer,timer,poll,done=false;
   const finish=reason=>{if(done)return;done=true;observer?.disconnect();clearTimeout(timer);clearInterval(poll);wakeWait=null;resolve(reason);};
   const check=()=>{
    if(done)return;
    if(cancelled)return finish('cancelled');
    if(location.href!==source)return finish('navigation');
    if(blocked(document))return finish('blocked');
    if(extract(document,source,options).rows.some(row=>!unique.has(key(row,source))))return finish('new-results');
    if(scroller&&listEnded(scroller))return finish('end');
   };
   observer=new MutationObserver(check);observer.observe(scroller||document.body,{childList:true,subtree:true});
   poll=setInterval(check,200);timer=setTimeout(()=>finish('timeout'),timeout);wakeWait=finish;check();
  });
 }
 async function run(options={}){
  cancelled=false;const source=location.href,unique=new Map(),started=Date.now();let adapter='',reason='',passes=0,stalls=0;
  const limit=Math.min(250,Math.max(1,Number(options.limit)||100));
  const automatic=options.autoScroll!==false,maxDuration=120000;
  const overlay=options.feedback===false?null:feedback(options.language);
  async function report(stage){
   const progress={stage,count:unique.size,limit,pass:passes,elapsedMs:Date.now()-started,latest:[...unique.values()].slice(-3).map(row=>row.name||row.title)};
   overlay?.update(progress);
   if(typeof options.onProgress==='function')options.onProgress(progress);
   if(options.runId&&typeof chrome!=='undefined'&&chrome.runtime?.id){try{await chrome.runtime.sendMessage({event:'collection-progress',runId:options.runId,progress});}catch{}}
  }
  try{
   for(let pass=0;pass<100&&Date.now()-started<maxDuration;pass++){
    passes=pass;
    if(cancelled){reason='cancelled';break;}
    if(location.href!==source){reason='navigation';break;}
    if(blocked(document)){reason='blocked';break;}
    const result=extract(document,source,options);adapter=result.adapter;
    for(const row of result.rows){const id=key(row,source);if(unique.has(id)||unique.size<limit)unique.set(id,row);}
    await report('scanning');
    if(unique.size>=limit){reason='limit';break;}
    if(!automatic){reason='single-page';break;}
    const scroller=findScroller(document,adapter);
    if(scroller&&listEnded(scroller)){reason='end';break;}
    if(adapter!=='maps'&&result.rows.length&&(!scroller||scroller.scrollHeight<=scroller.clientHeight+4)){reason='end';break;}
    if(!scroller||scroller.scrollHeight<=scroller.clientHeight+4){
     await report('waiting');
     const outcome=await waitForResults(source,options,unique,scroller,Math.min(4000,maxDuration-(Date.now()-started)));
     if(outcome==='new-results'){stalls=0;continue;}
     if(['cancelled','navigation','blocked'].includes(outcome)){reason=outcome;break;}
     if(++stalls>=3){reason='no-scroll-container';break;}
     continue;
    }
    const before=scroller.scrollTop;
    await report('scrolling');
    scroller.scrollBy({top:Math.max(240,scroller.clientHeight*.85),behavior:'instant'});
    await report('waiting');
    const outcome=await waitForResults(source,options,unique,scroller,Math.min(5000,maxDuration-(Date.now()-started)));
    if(outcome==='new-results'){stalls=0;continue;}
    if(['cancelled','navigation','blocked'].includes(outcome)){reason=outcome;break;}
    if(outcome==='end')continue; // Capture the final render before stopping.
    const atBottom=scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-8;
    stalls=(atBottom||scroller.scrollTop===before)?stalls+1:0;
    if(stalls>=3){reason='no-new-results';break;}
   }
   reason=reason||'time-limit';
   const warnings={navigation:'الصفحة تغيّرت؛ توقف الجمع.',blocked:'الموقع طلب تحققًا؛ توقف الجمع.', 'no-scroll-container':'افتح قائمة نتائج البحث على Maps؛ لم نجد قائمة قابلة لتحميل نتائج إضافية.', 'no-new-results':'لم تظهر نتائج جديدة بعد عدة محاولات تحميل؛ حفظنا الشركات التي جُمعت.', 'time-limit':'انتهى وقت الدفعة؛ يمكنك بدء دفعة جديدة.'};
   const warning=warnings[reason]||'';
   await report(cancelled?'stopped':'complete');
   return {rows:[...unique.values()],source:{url:source,adapter:adapter||'custom'},warning,cancelled,reason,passes};
  }finally{overlay?.remove();wakeWait?.('finished');}
 }
 const api={version:VERSION,extract,run,findScroller,blocked,cancel(){cancelled=true;wakeWait?.('cancelled');}};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else globalThis.MrsaalExtractor=api;
})();
