'use strict';
(()=>{
 const page=document.getElementById('page-discovery');if(!page)return;
 const $=id=>document.getElementById('discovery-'+id),t=s=>window.MrsaalLocale?.t(s)||s;
 let busy=false,allowed=false,account=null,imports=[],jobs=[],nextOffset=null,problem='',loaded=false;
 const active=()=>page.classList.contains('active');
 function message(text,error=false){$('status').textContent=t(text);$('status').dataset.state=error?'error':'ready';}
 function controls(){for(const id of ['download','maps','job-search'])$(id).disabled=!allowed;$('refresh').disabled=busy;}
 async function request(path){
  const response=await fetch('/api/discovery/'+path,{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||'تعذر تحميل النتائج. حاول التحديث مرة أخرى.'),{status:response.status});
  return data;
 }
 function link(url,label){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=t(label);return a;}catch{return null;}}
 function empty(container,text){const p=document.createElement('p');p.className='hint';p.textContent=t(text);container.replaceChildren(p);}
 function draw(){
  controls();
  if(problem){message(problem,true);empty($('imports'),'لا توجد نتائج متاحة للعرض.');$('jobs').replaceChildren();$('more').hidden=true;return;}
  if(!loaded)return;
  message('الحساب متصل:');$('status').append(document.createTextNode(' '+account.email));$('status').setAttribute('data-user-content','');
  $('imports').replaceChildren();
  if(!imports.length)empty($('imports'),'لسه مفيش دفعات محفوظة. ابدأ الجمع من الإضافة.');
  for(const receipt of imports){
   const article=document.createElement('article'),heading=document.createElement('h3'),p=document.createElement('p'),time=document.createElement('time');
   heading.textContent=t('دفعة محفوظة');const r=receipt.result||{};
   p.textContent=`${t('شركات جديدة')}: ${r.companiesAdded||0} · ${t('وظائف جديدة')}: ${r.jobsAdded||0} · ${t('وظائف محدثة')}: ${r.jobsUpdated||0} · ${t('نتائج مكررة')}: ${r.duplicates||0}`;
   const date=new Date(receipt.created_at);if(!Number.isNaN(date.getTime())){time.dateTime=date.toISOString();time.textContent=date.toLocaleString(window.MrsaalLocale?.lang==='en'?'en-GB':'ar-EG');}
   article.append(heading,p,time);const source=link(receipt.source?.url,'فتح مصدر الدفعة');if(source){const row=document.createElement('p');row.append(source);article.append(row);}$('imports').append(article);
  }
  $('jobs').replaceChildren();if(!jobs.length)empty($('jobs'),'لسه مفيش وظائف محفوظة.');
  for(const job of jobs){
   const article=document.createElement('article'),heading=document.createElement('h3'),meta=document.createElement('p'),status=document.createElement('p');
   heading.textContent=job.title;heading.setAttribute('data-user-content','');meta.textContent=[job.company_name,job.location].filter(Boolean).join(' · ');meta.setAttribute('data-user-content','');
   status.textContent=t(job.status==='needs_review'?'رابط بحث — محتاج مراجعة الإعلان':'تم جمع تفاصيل الإعلان');article.append(heading,meta,status);
   const source=link(job.job_url,'فتح إعلان الوظيفة');if(source)article.append(source);$('jobs').append(article);
  }
  $('more').hidden=nextOffset===null;
 }
 async function refresh(){
  if(busy||!active()||document.hidden)return;busy=true;controls();
  try{
   const session=await request('session');if(!session.user?.id)throw new Error('تعذر تحميل النتائج. حاول التحديث مرة أخرى.');
   const changed=account?.id!==session.user.id;
   const [batches,saved]=await Promise.all([request('imports'),request('jobs')]);
   account=session.user;allowed=true;problem='';imports=batches.imports||[];
   // A refresh shows the newest page; older pages can be loaded again explicitly.
   jobs=saved.jobs||[];nextOffset=saved.nextOffset??null;loaded=true;if(changed)$('jobs').replaceChildren();
  }catch(error){
   allowed=false;account=null;imports=[];jobs=[];loaded=false;
   problem=error.status===403?'التجربة متاحة حاليًا للأدمن وحسابات الاختبار المحددة فقط.':error.status===404?'تحديث الإضافة لسه مش منشور على السيرفر. جرّب بعد اكتمال النشر.':error.status===401?'سجّل دخولك إلى مرسال أولًا.':'تعذر تحميل النتائج. حاول التحديث مرة أخرى.';
  }finally{busy=false;draw();}
 }
 $('download').addEventListener('click',()=>{if(allowed)window.location.assign('/api/discovery/extension.zip');});
 $('refresh').addEventListener('click',refresh);
 $('companies').addEventListener('click',async()=>{const b=$('companies');b.disabled=true;try{if(typeof loadCompanies==='function')await loadCompanies();window.nav('companies');}catch{message('تعذر تحميل النتائج. حاول التحديث مرة أخرى.',true);}finally{b.disabled=false;}});
 $('search').addEventListener('submit',event=>{
  event.preventDefault();if(!allowed)return;const query=$('query').value.trim();if(!query)return;
  const countries={EG:'Egypt',SA:'Saudi Arabia',AE:'United Arab Emirates',KW:'Kuwait',QA:'Qatar',BH:'Bahrain',OM:'Oman'},country=countries[$('country').value]||'Egypt';
  const searchJobs=event.submitter?.id==='discovery-job-search',mode=$('mode').value;
  const url=searchJobs?'https://www.google.com/search?q='+encodeURIComponent([query,'jobs',country,mode].filter(Boolean).join(' ')):'https://www.google.com/maps/search/'+encodeURIComponent(query+' '+country);
  window.open(url,'_blank','noopener,noreferrer');
 });
 $('more').addEventListener('click',async()=>{
  if(busy||!allowed||nextOffset===null)return;busy=true;$('more').disabled=true;
  try{const saved=await request('jobs?offset='+nextOffset),ids=new Set(jobs.map(j=>j.id));jobs.push(...(saved.jobs||[]).filter(j=>!ids.has(j.id)));nextOffset=saved.nextOffset??null;draw();}
  catch{message('تعذر تحميل النتائج. حاول التحديث مرة أخرى.',true);}finally{busy=false;$('more').disabled=false;controls();}
 });
 const original=window.nav;if(typeof original==='function')window.nav=function(name){const result=original.apply(this,arguments);if(name==='discovery')refresh();return result;};
 document.addEventListener('mrsaal:language',draw);
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 // Preserve an explicit older-page view until the user refreshes or reopens the section.
 setInterval(()=>{if(jobs.length>100)return;refresh();},6000);
 if(active())refresh();
})();
