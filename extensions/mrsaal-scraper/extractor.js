/* Runs only after a toolbar action grants activeTab. No cookies, form values,
   remote scripts, private APIs or background network requests are read. */
(() => {
 'use strict';
 if(globalThis.MrsaalExtractor)return;
 let cancelled=false;
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
    if(card.parentElement.querySelectorAll('a[href*="/maps/place/"]').length>1)break;
    card=card.parentElement;
   }
   if(!card)continue;
   const name=clean(link.getAttribute('aria-label')||bodyText(link)||card.querySelector('h2,h3')?.textContent);
   if(!name)continue;
   const lines=bodyText(card).split('\n').map(s=>clean(s)).filter(s=>s&&s!==name&&!/^(?:[\d.]+\s*(?:\(|stars)|\(?\d+\)?$|Website|Directions|Open|Closed|Closes|Opens|No reviews|موقع|الاتجاهات|مفتوح|مغلق)/i.test(s));
   rows.push({kind:'company',name,...contacts(card,base),field:lines[0]||'',location:clean(lines.slice(1).join(', ')),sourceUrl:safeUrl(link.href,base)});
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
 function extract(doc,base,options={}){
  if(options.selector)return {adapter:'custom',rows:custom(doc,base,options.selector,options.kind||'company')};
  if(/(^|\.)google\.[a-z.]+$/.test(new URL(base).hostname)&&new URL(base).pathname.startsWith('/maps'))return {adapter:'maps',rows:maps(doc,base)};
  const jobs=structured(doc,base);if(jobs.length)return {adapter:'jsonld',rows:jobs};
  return {adapter:'table',rows:tables(doc,base)};
 }
 function blocked(doc){return /^(?:Just a moment|Access Denied|Verify you are human|Attention Required)/i.test(doc.title)||[...doc.querySelectorAll('input[name="captcha"],iframe[src*="hcaptcha.com/captcha"],iframe[title*="challenge"]')].some(visible);}
 async function run(options={}){
  cancelled=false;const source=location.href,unique=new Map();let adapter='',unchanged=0,warning='';
  const limit=Math.min(250,Math.max(1,Number(options.limit)||100));
  const rounds=options.autoScroll?10:1;
  for(let pass=0;pass<rounds;pass++){
   if(cancelled){warning='تم إيقاف الجمع.';break;}
   if(location.href!==source){warning='الصفحة تغيّرت؛ توقف الجمع.';break;}
   if(blocked(document)){warning='الموقع طلب تحققًا؛ توقف الجمع.';break;}
   const result=extract(document,source,options);adapter=result.adapter;
   const before=unique.size;
   for(const row of result.rows){const key=row.kind==='job'?row.jobUrl:row.sourceUrl!==source?row.sourceUrl:row.name+'|'+row.email+'|'+row.phone;if(unique.size<limit)unique.set(key,row);}
   if(unique.size>=limit||pass===rounds-1)break;
   if(unique.size===before)unchanged++;else unchanged=0;
   if(unchanged>=2)break;
   const feed=document.querySelector('[role="feed"]');const scroller=feed||document.scrollingElement;
   if(!scroller||scroller.scrollHeight<=scroller.clientHeight)break;
   scroller.scrollBy({top:Math.max(300,scroller.clientHeight*.8),behavior:'instant'});
   await new Promise(resolve=>setTimeout(resolve,900));
  }
  return {rows:[...unique.values()],source:{url:source,adapter:adapter||'custom'},warning,cancelled};
 }
 const api={extract,run,cancel(){cancelled=true;}};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else globalThis.MrsaalExtractor=api;
})();
