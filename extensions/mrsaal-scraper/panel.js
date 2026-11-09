'use strict';
const $=id=>document.getElementById(id);
let language='ar',account=null,refreshVersion=0,sourceState={};
const words=(ar,en)=>language==='en'?en:ar;
function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
async function send(action,extra={}){const result=await chrome.runtime.sendMessage({action,...extra});if(!result?.ok)throw new Error(result?.error||words('تعذر الاتصال بالإضافة.','Could not contact the extension.'));return result.data;}
function applyLanguage(){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.querySelectorAll('[data-ar]').forEach(el=>{el.textContent=el.dataset[language];});document.querySelectorAll('[data-ar-placeholder]').forEach(el=>{el.placeholder=language==='ar'?el.dataset.arPlaceholder:el.dataset.enPlaceholder;});$('language').textContent=language==='ar'?'EN':'عربي';if(account)$('account').textContent=account.email||account.name;}
function list(container,rows,saved=false){
 container.replaceChildren();
 for(const row of rows.slice(0,saved?100:5)){
  const article=document.createElement('article'),title=document.createElement('strong'),details=document.createElement('p');
  title.textContent=row.title||row.name;details.textContent=[row.company_name||row.companyName,row.location,row.status==='needs_review'?words('رابط بحث — راجع الإعلان','Search link — review the posting'):'',row.email,row.phone].filter(Boolean).join(' · ');article.append(title,details);
  const href=row.job_url||row.jobUrl||row.sourceUrl;
  if(href&&/^https?:\/\//.test(href)){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=words('فتح المصدر','Open source');article.append(a);}
  container.append(article);
 }
}
function renderActivity(state){
 const phase=state.phase||'idle',busy=['opening','collecting','importing','verifying'].includes(phase),p=state.progress||{};
 const count=Number(p.count??state.lastResult?.collected)||0,limit=Number(p.limit)||100;
 const titles={verifying:words('بنتأكد من السجلات المحفوظة','Verifying saved records'),opening:words('فتح البحث والجمع التلقائي','Opening search and auto-collecting'), 'save-pending':words('الحفظ محتاج تأكيد — الدفعة محفوظة محليًا','Save needs confirmation — batch kept locally'),idle:words('جاهز لجمع الشركات','Ready to collect'),collecting:words('بنجمع النتائج دلوقتي','Collecting results'),importing:words('بنحفظ النتائج في حسابك','Saving results to your account'),complete:words('الدفعة اتجمعت واتحفظت','Batch collected and saved'),stopped:words('تم إيقاف الجمع','Collection stopped'),failed:words('العملية محتاجة مراجعة','Check the collection result')};
 const stages={scanning:words('قراءة بيانات الشركات الظاهرة','Reading visible company details'),scrolling:words('تحميل شركات إضافية بالسكرول','Scrolling to load more companies'),waiting:words('في انتظار تحميل نتائج جديدة','Waiting for new results to load'),verifying:words('قراءة إيصال الدفعة من قاعدة البيانات','Reading the stored batch receipt'),importing:words('إضافة النتائج ومنع التكرار','Importing results and skipping duplicates')};
 const activity=$('activity');activity.dataset.state=phase;activity.setAttribute('aria-busy',String(busy));
 $('activity-title').textContent=titles[phase]||titles.idle;
 $('activity-icon').textContent=busy?'':phase==='failed'?'!':phase==='stopped'?'■':phase==='complete'?'✓':'↗';
 $('activity-stage').textContent=busy?(stages[p.stage]||stages.scanning):phase==='complete'?words('عدد النتائج الفعلي، وليس تقديرًا.','Actual collected results, not an estimate.'):words('التقدم يظهر هنا أثناء العمل.','Live progress appears here while collecting.');
 $('live-count').textContent=String(count);$('live-limit').textContent=String(limit);
 $('progress-fill').style.width=Math.min(100,count/limit*100)+'%';
 $('collection-progress').setAttribute('aria-valuemax',String(limit));$('collection-progress').setAttribute('aria-valuenow',String(Math.min(limit,count)));
 $('collection-progress').setAttribute('aria-label',words('عدد النتائج بالنسبة لحد الدفعة','Collected results toward the batch limit'));
 const active=['importing','verifying'].includes(phase)?1:phase==='complete'?2:0;
 ['step-collect','step-import','step-done'].forEach((id,i)=>{$(id).classList.toggle('is-current',i===active);$(id).classList.toggle('is-done',phase==='complete'||i<active);});
 const latest=Array.isArray(p.latest)?p.latest:[];
 $('live-latest').textContent=busy&&latest.length?words('آخر النتائج: ','Latest results: ')+latest.join(' · '):'';
}
function render(state){
 sourceState=state;account=state.account||null;
 $('account').textContent=account?.email||account?.name||words('الحساب غير مربوط','Account not connected');
 $('source').textContent=state.sourceTitle||words('افتح صفحة نتائج واضغط أيقونة مرسال في شريط المتصفح.','Open a results page and click the Mrsaal toolbar icon.');
 renderActivity(state);
 const busy=['opening','collecting','importing','verifying'].includes(state.phase);
 window.MrsaalGames?.setBusy(busy);$('retry-save').hidden=!state.hasPendingImport;$('retry-save').disabled=busy;
 $('collect').disabled=busy||state.hasPendingImport;$('connect').disabled=busy;$('stop').disabled=!['collecting','opening'].includes(state.phase);
 if(state.lastError&&['failed','save-pending'].includes(state.phase))setStatus(state.lastError,true);
 else if(state.phase==='collecting')setStatus(words('جارٍ جمع النتائج من الصفحة…','Collecting results from the page…'));
 else if(state.phase==='verifying')setStatus(words('جارٍ تأكيد الحفظ من قاعدة البيانات…','Verifying saved data in the database…'));
 else if(state.phase==='opening')setStatus(words('نتائج البحث هتتجمع تلقائيًا بعد التحميل.','Results will be collected automatically once loaded.'));
 else if(state.phase==='importing')setStatus(words('جارٍ حفظ النتائج في حسابك…','Saving results to your account…'));
 else if(state.phase==='stopped')setStatus(words('تم إيقاف الجمع. لم تُرسل النتائج إلى مرسال.','Collection stopped. Results were not sent to Mrsaal.'));
 else if(state.lastResult){const r=state.lastResult;setStatus(words(`أضفنا ${r.companiesAdded} شركة و${r.jobsAdded} فرصة، وحدّثنا ${r.jobsUpdated||0} إعلان. تخطينا ${r.duplicates} نتيجة مكررة. ${r.warning||''} إيصال: ${r.receiptId||''}`,`Added ${r.companiesAdded} companies and ${r.jobsAdded} jobs, updated ${r.jobsUpdated||0} postings. Skipped ${r.duplicates} duplicates. ${r.warning||''} Receipt: ${r.receiptId||''}`));}
 else setStatus(words('جاهز. النتائج تتضاف للحساب بعد الضغط على البدء.','Ready. Results are imported after you press start.'));
 $('job-details').hidden=!(state.lastRows||[]).some(row=>row.entryType==='link_only');$('job-details').disabled=busy;
 list($('preview'),state.lastRows||[]);
}
async function refresh(){const version=++refreshVersion,state=await send('state');if(version===refreshVersion)render(state);}
function action(id,fn){$(id).addEventListener('click',async()=>{try{await fn();}catch(error){setStatus(error.message,true);}});}
action('language',async()=>{language=language==='ar'?'en':'ar';await chrome.storage.local.set({language});applyLanguage();await refresh();});
action('connect',async()=>{const data=await send('connect');account=data.account;await refresh();});
action('open-app',()=>send('openApp'));
async function allowOrigin(origin){
 const permission={origins:[origin+'/*']};
 if(!await chrome.permissions.request(permission))throw new Error(words('السماح للموقع مطلوب للجمع.','Site access is required to collect.'));
}
async function prepareSource(grantedOrigin){
 const [active]=await chrome.tabs.query({active:true,currentWindow:true});let id=sourceState.sourceTabId,url=sourceState.sourceUrl;
 if(active?.url&&new URL(active.url).origin!==sourceState.appOrigin){id=active.id;url=active.url;}
 else if(active?.id!==id&&!active?.url)throw new Error(words('اضغط أيقونة الإضافة مرة واحدة على الموقع الجديد، ثم اسمح له بالوصول.','Click the toolbar icon once on this new site, then grant access.'));
 if(!url||!/^https?:/.test(url))throw new Error(words('اختار صفحة النتائج من أيقونة الإضافة.','Choose the results page using the toolbar icon.'));
 if(new URL(url).origin!==grantedOrigin)throw new Error(words('الموقع اتغيّر؛ اختاره من أيقونة الإضافة مرة واحدة.','The site changed; select it once using the toolbar icon.'));return id;
}
function options(){return {limit:Number($('limit').value),autoScroll:$('auto-scroll').checked,selector:$('selector').value.trim(),kind:$('kind').value,query:$('query').value.trim(),country:$('country').value,language};}
action('collect',async()=>{$('collect').disabled=true;try{const url=sourceState.sourceUrl;if(!url)throw new Error(words('اختار المصدر من أيقونة الإضافة مرة واحدة.','Select the source using the toolbar icon once.'));const origin=new URL(url).origin;await allowOrigin(origin);const sourceTabId=await prepareSource(origin);await send('collect',{...options(),sourceTabId});}finally{await refresh();}});
action('retry-save',async()=>{try{await send('retryImport');}finally{await refresh();}});
action('stop',()=>send('stop'));
action('job-details',async()=>{const origins=[...new Set((sourceState.lastRows||[]).filter(r=>r.entryType==='link_only').slice(0,10).map(r=>new URL(r.jobUrl).origin+'/*'))];if(!await chrome.permissions.request({origins}))throw new Error(words('السماح لمواقع الإعلانات مطلوب.','Posting-site permission is required.'));try{await send('details');}finally{await refresh();}});
action('saved',async()=>{const data=await send('saved');list($('saved-jobs'),data.jobs,true);if(!data.jobs.length)$('saved-jobs').textContent=words('لا توجد فرص محفوظة بعد.','No saved opportunities yet.');});
const countryNames={EG:'Egypt',SA:'Saudi Arabia',AE:'United Arab Emirates',KW:'Kuwait',QA:'Qatar',BH:'Bahrain',OM:'Oman'};
async function search(maps){
 const query=$('query').value.trim();if(!query)throw new Error(words('اكتب المجال أو المسمى الوظيفي.','Enter an industry or job title.'));
 const country=countryNames[$('country').value],city=$('city').value.trim();
 let domain=$('domain').value.trim();if(domain&&!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain))throw new Error(words('اكتب دومين فقط، مثل wuzzuf.net.','Enter a domain only, such as wuzzuf.net.'));
 const work={remote:'remote',hybrid:'hybrid',onsite:'on-site'}[$('work-mode').value]||'';
 const url=new URL(maps?'https://www.google.com/maps/search/':'https://www.google.com/search');
 if(maps){url.pathname+=encodeURIComponent([query,city,country].filter(Boolean).join(' '));}
 else url.searchParams.set('q',[query,'jobs',country,city,work,domain?'site:'+domain:''].filter(Boolean).join(' '));
 await allowOrigin(url.origin);
 if(!maps){await send('search',{url:url.href,options:options()});await refresh();return;}
 await chrome.tabs.create({url:url.href});
 setStatus(words('اختار صفحة النتائج واضغط أيقونة مرسال عليها، ثم ابدأ الجمع.','Choose a results page, click the Mrsaal toolbar icon there, then start collecting.'));
}
action('search-jobs',()=>search(false));action('search-maps',()=>search(true));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'||area==='local'&&changes.pendingImport)refresh().catch(error=>setStatus(error.message,true));});
(async()=>{const prefs=await chrome.storage.local.get('language');language=prefs.language==='en'?'en':'ar';applyLanguage();await refresh();})().catch(error=>setStatus(error.message,true));
