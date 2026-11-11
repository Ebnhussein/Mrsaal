'use strict';
(()=>{
 const page=document.getElementById('page-discovery');if(!page)return;
 const $=id=>document.getElementById('discovery-'+id),t=s=>window.MrsaalLocale?.t(s)||s;
 let launchBusy=false,waitingStart=false,bridgeReady=false,bridgeError=false,bridgeOutdated=false;
 let busy=false,allowed=false,account=null,imports=[],jobs=[],nextOffset=null,problem='',loaded=false;
 const active=()=>page.classList.contains('active');
 function message(text,error=false){$('status').textContent=t(text);$('status').dataset.state=error?'error':'ready';}
 function controls(){for(const id of ['download','maps','job-search'])$(id).disabled=!allowed||(id!=='download'&&(launchBusy||bridgeOutdated));$('refresh').disabled=busy;}
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
   article.append(heading,p,time);const open=document.createElement('button');open.className='btn btn-secondary';open.type='button';open.textContent=t('عرض شركات وفرص الدفعة');open.addEventListener('click',()=>openBatch(receipt.id,open));article.append(open);$('imports').append(article);
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
 async function openBatch(id,trigger){
  trigger.disabled=true;
  try{
   const data=await request('imports/'+encodeURIComponent(id)),dialog=document.createElement('dialog');dialog.className='discovery-batch-dialog';dialog.setAttribute('aria-label',t('تفاصيل الدفعة'));
   const header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.textContent=t('تفاصيل الدفعة');close.className='btn btn-secondary';close.textContent=t('إغلاق');close.onclick=()=>dialog.close();header.append(title,close);dialog.append(header);
   function table(rows,columns){
    if(!rows.length)return;const wrap=document.createElement('div');wrap.className='discovery-batch-table tbl-wrap';const table=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr'),body=document.createElement('tbody');
    for(const [,label] of columns){const th=document.createElement('th');th.textContent=t(label);tr.append(th);}head.append(tr);table.append(head);
    for(const row of rows){const line=document.createElement('tr');for(const [key] of columns){const td=document.createElement('td');td.setAttribute('data-user-content','');td.textContent=key==='status'?t(row[key]==='needs_review'?'بحاجة للمراجعة':'تفاصيل محفوظة'):row[key]||'—';line.append(td);}body.append(line);}table.append(body);wrap.append(table);dialog.append(wrap);
   }
   table(data.companies||[],[['name','الشركة'],['email','البريد الإلكتروني'],['phone','الهاتف'],['field','المجال'],['location','المكان']]);
   table(data.jobs||[],[['title','الوظيفة'],['company_name','الشركة'],['location','المكان'],['status','الحالة']]);
   if(!data.companies?.length&&!data.jobs?.length)empty(dialog,'لا توجد سجلات متاحة في هذه الدفعة.');
   dialog.addEventListener('close',()=>{dialog.remove();trigger.focus();},{once:true});document.body.append(dialog);dialog.showModal();
  }catch{message('تعذر تحميل النتائج. حاول التحديث مرة أخرى.',true);}finally{trigger.disabled=false;}
 }
 async function refresh(){
  if(busy||!active()||document.hidden)return;busy=true;controls();
  try{
   const session=await request('session');if(!session.user?.id)throw new Error('تعذر تحميل النتائج. حاول التحديث مرة أخرى.');
   const changed=account?.id!==session.user.id;
   const [batches,saved]=await Promise.all([request('imports'),request('jobs')]);
   account=session.user;page.dataset.discoveryAccountId=account.id;if(changed)restoreSearch();allowed=true;problem='';imports=batches.imports||[];
   // A refresh shows the newest page; older pages can be loaded again explicitly.
   jobs=saved.jobs||[];nextOffset=saved.nextOffset??null;loaded=true;if(changed)$('jobs').replaceChildren();
  }catch(error){
   allowed=false;account=null;delete page.dataset.discoveryAccountId;imports=[];jobs=[];loaded=false;
   problem=error.status===403?'التجربة متاحة حاليًا للأدمن وحسابات الاختبار المحددة فقط.':error.status===404?'تحديث الإضافة لسه مش منشور على السيرفر. جرّب بعد اكتمال النشر.':error.status===401?'سجّل دخولك إلى مرسال أولًا.':'تعذر تحميل النتائج. حاول التحديث مرة أخرى.';
  }finally{busy=false;draw();}
 }
 function searchKey(){return 'mrsaal:discovery:search:'+account?.id;}
 function restoreSearch(){try{const saved=JSON.parse(localStorage.getItem(searchKey())||'{}');for(const id of ['query','country','city','mode','limit'])if(typeof saved[id]==='string')$(id).value=saved[id];if(typeof saved.autoScroll==='boolean')$('auto-scroll').checked=saved.autoScroll;}catch{}}
 function saveSearch(){if(!account)return;try{const saved={};for(const id of ['query','country','city','mode','limit'])saved[id]=$(id).value;saved.autoScroll=$('auto-scroll').checked;localStorage.setItem(searchKey(),JSON.stringify(saved));}catch{}}
 $('search').addEventListener('input',saveSearch);$('search').addEventListener('change',saveSearch);
 $('download').addEventListener('click',()=>{if(allowed)window.location.assign('/api/discovery/extension.zip');});
 $('refresh').addEventListener('click',refresh);
 $('companies').addEventListener('click',async()=>{const b=$('companies');b.disabled=true;try{if(typeof loadCompanies==='function')await loadCompanies();window.nav('companies');}catch{message('تعذر تحميل النتائج. حاول التحديث مرة أخرى.',true);}finally{b.disabled=false;}});
 function extensionStatus(text){$('extension').textContent=t(text);}
 function hello(){window.postMessage({type:'mrsaal-scraper-hello'},location.origin);}
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.type!=='mrsaal-scraper-bridge')return;
  const data=event.data;const version=String(data.version||'').split('.').map(Number);if(version.length<2||!Number.isFinite(version[0])||version[0]===0&&version[1]<6){bridgeOutdated=true;bridgeReady=false;extensionStatus('حدّث الإضافة إلى 0.6.0 أو أحدث، ثم حدّث صفحة مرسال.');controls();return;}bridgeOutdated=false;bridgeReady=true;
  if(data.event==='starting'){bridgeError=false;launchBusy=true;waitingStart=true;extensionStatus('بنشغّل الإضافة. وافق على صلاحية Google لو ظهرت.');}
  else if(data.event==='error'){bridgeError=true;launchBusy=false;waitingStart=false;extensionStatus(data.error||'تعذر بدء الإضافة.');}
  else if(data.event==='disconnected'){bridgeError=true;bridgeReady=false;launchBusy=false;waitingStart=false;extensionStatus('حدّث الإضافة إلى 0.6.0 أو أحدث، ثم حدّث صفحة مرسال.');}
  else if(data.event==='started'){waitingStart=false;extensionStatus(data.panelOpened===false?'الجمع بدأ. لو لوحة الإضافة مش ظاهرة، اضغط أيقونتها لمتابعة التقدم.':'البحث والجمع التلقائي بدأ. تابع التقدم في الإضافة.');}
  else if(data.event==='state'&&!bridgeError&&(!waitingStart||['opening','collecting','importing','verifying'].includes(data.phase))){
   const phase=data.phase||'idle';launchBusy=['opening','collecting','importing','verifying'].includes(phase);
   const words={opening:'فتح البحث والجمع التلقائي',collecting:'جاري جمع النتائج',importing:'جاري حفظ الدفعة',verifying:'جاري تأكيد الحفظ',complete:'تم تأكيد حفظ الدفعة',stopped:'تم إيقاف الجمع',idle:'الإضافة جاهزة. البحث والجمع يبدأوا من نفس الزر.'};
   if(data.error)extensionStatus(data.error);else extensionStatus(words[phase]||'الإضافة جاهزة. البحث والجمع يبدأوا من نفس الزر.');
   if(launchBusy)$('extension').append(document.createTextNode(' · '+Number(data.count||0)+' / '+Number(data.limit||100)));
  }else if(data.event==='ready'&&!launchBusy&&!bridgeError)extensionStatus('الإضافة جاهزة. البحث والجمع يبدأوا من نفس الزر.');
  controls();
 });
 $('search').addEventListener('submit',event=>{
  event.preventDefault();if(!allowed)return;
  // The installed bridge handles real clicks synchronously to retain user activation.
  extensionStatus(bridgeReady?'اضغط زر البحث مباشرة لتشغيل الإضافة.':'حدّث الإضافة إلى 0.6.0 أو أحدث، ثم حدّث صفحة مرسال.');
  hello();
 });
 hello();setTimeout(()=>{if(!bridgeReady)extensionStatus('حدّث الإضافة إلى 0.6.0 أو أحدث، ثم حدّث صفحة مرسال.');},1500);
 $('more').addEventListener('click',async()=>{
  if(busy||!allowed||nextOffset===null)return;busy=true;$('more').disabled=true;
  try{const saved=await request('jobs?offset='+nextOffset),ids=new Set(jobs.map(j=>j.id));jobs.push(...(saved.jobs||[]).filter(j=>!ids.has(j.id)));nextOffset=saved.nextOffset??null;draw();}
  catch{message('تعذر تحميل النتائج. حاول التحديث مرة أخرى.',true);}finally{busy=false;$('more').disabled=false;controls();}
 });
 const original=window.nav;if(typeof original==='function')window.nav=function(name){const result=original.apply(this,arguments);if(name==='discovery'){refresh();hello();}return result;};
 document.addEventListener('mrsaal:language',draw);
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 // Preserve an explicit older-page view until the user refreshes or reopens the section.
 setInterval(()=>{if(jobs.length>100)return;refresh();},6000);
 if(active())refresh();
})();
