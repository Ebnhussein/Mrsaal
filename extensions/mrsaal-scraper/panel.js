'use strict';
const $=id=>document.getElementById(id);
let language='ar',account=null;
const words=(ar,en)=>language==='en'?en:ar;
function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
async function send(action,extra={}){const result=await chrome.runtime.sendMessage({action,...extra});if(!result?.ok)throw new Error(result?.error||words('تعذر الاتصال بالإضافة.','Could not contact the extension.'));return result.data;}
function applyLanguage(){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.querySelectorAll('[data-ar]').forEach(el=>{el.textContent=el.dataset[language];});document.querySelectorAll('[data-ar-placeholder]').forEach(el=>{el.placeholder=language==='ar'?el.dataset.arPlaceholder:el.dataset.enPlaceholder;});$('language').textContent=language==='ar'?'EN':'عربي';if(account)$('account').textContent=account.email||account.name;}
function list(container,rows,saved=false){
 container.replaceChildren();
 for(const row of rows.slice(0,saved?100:5)){
  const article=document.createElement('article'),title=document.createElement('strong'),details=document.createElement('p');
  title.textContent=row.title||row.name;details.textContent=[row.company_name||row.companyName,row.location,row.email,row.phone].filter(Boolean).join(' · ');article.append(title,details);
  const href=row.job_url||row.jobUrl||row.sourceUrl;
  if(href&&/^https?:\/\//.test(href)){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=words('فتح المصدر','Open source');article.append(a);}
  container.append(article);
 }
}
function render(state){
 account=state.account||null;
 $('account').textContent=account?.email||account?.name||words('الحساب غير مربوط','Account not connected');
 $('source').textContent=state.sourceTitle||words('افتح صفحة نتائج واضغط أيقونة مرسال في شريط المتصفح.','Open a results page and click the Mrsaal toolbar icon.');
 const busy=['collecting','importing'].includes(state.phase);
 $('collect').disabled=busy;$('connect').disabled=busy;$('stop').disabled=state.phase!=='collecting';
 if(state.lastError&&state.phase==='failed')setStatus(state.lastError,true);
 else if(state.phase==='collecting')setStatus(words('جارٍ جمع النتائج من الصفحة…','Collecting results from the page…'));
 else if(state.phase==='importing')setStatus(words('جارٍ حفظ النتائج في حسابك…','Saving results to your account…'));
 else if(state.phase==='stopped')setStatus(words('تم إيقاف الجمع. لم تُرسل النتائج إلى مرسال.','Collection stopped. Results were not sent to Mrsaal.'));
 else if(state.lastResult){const r=state.lastResult;setStatus(words(`أضفنا ${r.companiesAdded} شركة و${r.jobsAdded} فرصة. تخطينا ${r.duplicates} نتيجة مكررة. ${r.warning||''}`,`Added ${r.companiesAdded} companies and ${r.jobsAdded} jobs. Skipped ${r.duplicates} duplicates. ${r.warning||''}`));}
 else setStatus(words('جاهز. النتائج تتضاف للحساب بعد الضغط على البدء.','Ready. Results are imported after you press start.'));
 list($('preview'),state.lastRows||[]);
}
async function refresh(){render(await send('state'));}
function action(id,fn){$(id).addEventListener('click',async()=>{try{await fn();}catch(error){setStatus(error.message,true);}});}
action('language',async()=>{language=language==='ar'?'en':'ar';await chrome.storage.local.set({language});applyLanguage();await refresh();});
action('connect',async()=>{const data=await send('connect');account=data.account;await refresh();});
action('open-app',()=>send('openApp'));
action('collect',async()=>{setStatus(words('جارٍ البدء…','Starting…'));await send('collect',{limit:Number($('limit').value),autoScroll:$('auto-scroll').checked,selector:$('selector').value.trim(),kind:$('kind').value,query:$('query').value.trim(),country:$('country').value});await refresh();});
action('stop',()=>send('stop'));
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
 await chrome.tabs.create({url:url.href});
 setStatus(words('اختار صفحة النتائج واضغط أيقونة مرسال عليها، ثم ابدأ الجمع.','Choose a results page, click the Mrsaal toolbar icon there, then start collecting.'));
}
action('search-jobs',()=>search(false));action('search-maps',()=>search(true));
chrome.storage.onChanged.addListener((_,area)=>{if(area==='session')refresh().catch(error=>setStatus(error.message,true));});
(async()=>{const prefs=await chrome.storage.local.get('language');language=prefs.language==='en'?'en':'ar';applyLanguage();await refresh();})().catch(error=>setStatus(error.message,true));
