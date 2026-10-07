let currentUser=null,cvReady=false,templateReady=false,waState='unknown',dataLoaded=false,activeSetting='account',onboardingEditing=false;
const setupItems=[{key:'cv',title:'السيرة الذاتية',description:'ارفع PDF أو اكتب خبراتك ومهاراتك. دي المعلومات اللي هتتكتب منها رسالتك.',icon:'cv',action:'أضف الـCV'},{key:'channels',title:'ربط واتساب',description:'امسح QR من الأجهزة المرتبطة عشان تبعت من رقمك. تقدر تبدأ بالإيميل بس.',icon:'chat',action:'اربط واتساب'},{key:'template',title:'تفضيلات الرسالة',description:'اختار اللغة والأسلوب، وحدّد التعليمات اللي تخلي كل رسالة أقرب ليك.',icon:'mail',action:'ظبط الرسالة'}];
function storageKey(){return 'mrsaal:onboarding:v1:'+String(currentUser?.email||'anonymous').toLowerCase();}
function getSetupPreferences(){try{return JSON.parse(localStorage.getItem(storageKey())||'{}')}catch{return {};}}
function putSetupPreferences(data){try{localStorage.setItem(storageKey(),JSON.stringify(data))}catch{}}
function setupComplete(key){return key==='cv'?cvReady:key==='channels'?waState==='connected':templateReady;}
function setupIcon(key){const paths={cv:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/>',chat:'<path d="M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-1l-5 2 1-5a9 9 0 1 1 17-5Z"/><path d="M8 11h8"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>'};return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[key]+'</svg>';}
function pendingSetupItems(){
  const skipped=getSetupPreferences().skipped||[];
  return setupItems.filter(item=>!setupComplete(item.key)&&!skipped.includes(item.key));
}
function setupCard(item,firstTime){
  const unknown=item.key==='channels'&&waState==='unknown';
  return `<article class="setup-card"><div class="setup-card-top"><span class="setup-icon">${setupIcon(item.icon)}</span><span class="state-badge">${unknown?'تعذر التحقق':'لسه محتاجة إعداد'}</span></div><h3>${item.title}</h3><p>${item.description}</p><div class="setup-card-actions"><button class="btn btn-primary" onclick="${firstTime?'editSetup':'openSettings'}('${item.key}')">${item.action}</button><button class="text-button" onclick="skipSetup('${item.key}')">تخطي دلوقتي</button></div></article>`;
}
function refreshWorkspace(){
  if(!currentUser)return;
  const outstanding=pendingSetupItems(),preferences=getSetupPreferences();
  const count=setupItems.filter(item=>setupComplete(item.key)).length;
  const deferred=setupItems.filter(item=>!setupComplete(item.key)&&preferences.skipped?.includes(item.key)).length;
  const home=document.getElementById('home-setup-cards'),onboard=document.getElementById('onboard-cards');
  document.getElementById('home-readiness').hidden=!dataLoaded||outstanding.length===0;
  home.innerHTML=outstanding.map(item=>setupCard(item,false)).join('');
  onboard.innerHTML=outstanding.length?outstanding.map(item=>setupCard(item,true)).join(''):`<div class="setup-empty"><strong>مفيش خطوات متبقية للعرض</strong><p>${count===setupItems.length?'إعداداتك محفوظة. تقدر تعدّلها من الإعدادات في أي وقت.':'الخطوات مكتملة أو اخترت تأجيلها. تقدر ترجع لأي خطوة من الإعدادات.'}</p><button class="btn btn-secondary" onclick="openSettings('account')">افتح الإعدادات</button></div>`;
  document.getElementById('onboard-counter').textContent=count+' مكتمل'+(deferred?' · '+deferred+' مؤجل':'')+' · '+outstanding.length+' متبقي';
  // Deferred items are deliberately not presented as completed.
  document.getElementById('onboard-bar').style.width=(count/setupItems.length*100)+'%';
  const pending=companies.filter(c=>c.status==='pending');
  const ready=cvReady?pending.filter(c=>!!c.email||(!!c.phone&&waState==='connected')):[];
  const replied=log.filter(l=>l.replied).length;
  const scheduled=companies.filter(c=>c.status==='scheduled').length;
  document.getElementById('home-companies').textContent=companies.length;
  document.getElementById('home-pending').textContent=ready.length;
  document.getElementById('home-sent').textContent=log.filter(l=>l.status==='sent').length;
  document.getElementById('home-replies').textContent=replied;
  const title=document.getElementById('next-title'),copy=document.getElementById('next-copy'),button=document.getElementById('next-action');
  document.getElementById('home-next-block').hidden=!dataLoaded;
  function recommend(heading,description,label,action){title.textContent=heading;copy.textContent=description;button.textContent=label;button.onclick=action;}
  if(outstanding.some(item=>item.key==='cv')){
    recommend('ابدأ بسيرتك الذاتية','ضيف خبراتك عشان الرسائل تتكتب بناءً على معلوماتك.','أضف الـCV',()=>openSettings('cv'));
  }else if(!companies.length){
    recommend('اختار الشركات اللي تناسبك','استورد قائمتك، وحدّد الشركات اللي حابب تتواصل معاها.','استيراد الشركات',openImporter);
  }else if(ready.length){
    recommend('عندك '+ready.length+' شركة في انتظار الإرسال','السيرة الذاتية موجودة وقناة التواصل متاحة. راجع الرسالة قبل الإرسال.','راجع الإرسال',()=>nav('send'));
  }else if(cvReady&&pending.some(c=>!c.email&&c.phone)&&outstanding.some(item=>item.key==='channels')){
    recommend('قناة واتساب محتاجة ربط','عندك شركات بوسيلة تواصل واتساب فقط. اربط حسابك لو حابب تبعت لها.','ربط واتساب',()=>openSettings('channels'));
  }else if(replied){
    recommend('عندك '+replied+' رد مرصود في التقارير','راجع تفاصيل الرسائل وآخر رد وصل من كل شركة.','عرض التقارير',()=>nav('report'));
  }else if(scheduled){
    recommend('عندك '+scheduled+' رسالة مجدولة','تابع حالة الشركات ونتائج الإرسال في التقارير.','عرض الشركات',()=>nav('companies'));
  }else if(log.length){
    recommend('تابع نتائج رسائلك','شوف حالة الإرسال والقراءة وآخر رد مرصود من الخدمة.','عرض التقارير',()=>nav('report'));
  }else{
    recommend('قائمة شركاتك موجودة','راجع بيانات التواصل وحدّد الشركات اللي حابب تبدأ معاها.','عرض الشركات',()=>nav('companies'));
  }
  const steps=[];
  if(outstanding.length)steps.push('<li><b>كمّل الخطوات المتبقية</b><span>'+outstanding.map(item=>item.title).join('، ')+'</span></li>');
  if(!companies.length)steps.push('<li><b>اختار الشركات</b><span>استورد قائمتك وحدّد مين هتتواصل معاه.</span></li>');
  if(!log.length&&ready.length)steps.push('<li><b>راجع أول رسالة</b><span>المعاينة بتخليك تعدّل النص قبل الإرسال.</span></li>');
  const workflow=document.getElementById('home-workflow');workflow.hidden=!dataLoaded||!steps.length;
  document.getElementById('home-workflow-steps').innerHTML=steps.join('');
  document.getElementById('home-bottom').classList.toggle('workflow-single',workflow.hidden);
  const activity=document.getElementById('home-activity');
  activity.innerHTML=log.length?log.slice(0,4).map(l=>`<button class="activity-row" onclick="viewLogDetail('${esc(l.id)}')"><span class="activity-symbol">${l.replied?'↩':'↗'}</span><span class="activity-description"><strong>${esc(l.company_name)}</strong><small>${l.channel==='whatsapp'?'واتساب':'إيميل'} · ${esc(reportDate(l.sent_at))}</small></span><span class="state-badge ${l.replied||l.status==='sent'?'ready':''}">${l.replied?'وصل رد':esc(stLabel(l.status))}</span></button>`).join(''):'<div class="empty"><div class="empty-t">مفيش نشاط إرسال لسه</div><p class="empty-s">نتائج الرسائل هتظهر هنا وفي التقارير بعد الإرسال.</p></div>';
}

function hydrateAccount(){const name=currentUser.name||'حسابك',email=currentUser.email||'';document.getElementById('welcome-name').textContent=name.split(' ')[0];document.getElementById('profile-name').textContent=name;document.getElementById('profile-email').textContent=email;document.getElementById('channel-email').textContent=email;for(const id of ['sidebar-avatar','top-avatar','settings-avatar'])document.getElementById(id).textContent=name.charAt(0)||'م';}
function decideFirstPage(){const prefs=getSetupPreferences();const returning=cvReady||companies.length>0||log.length>0;if(prefs.dismissed||returning){nav('home');}else{nav('onboarding');}}
function skipSetup(key){const prefs=getSetupPreferences();prefs.skipped=[...new Set([...(prefs.skipped||[]),key])];putSetupPreferences(prefs);refreshWorkspace();toast('تقدر ترجع للخطوة دي من الإعدادات في أي وقت','info');}
function finishOnboarding(skip){const prefs=getSetupPreferences();prefs.dismissed=true;if(skip)prefs.skipped=setupItems.filter(i=>!setupComplete(i.key)).map(i=>i.key);putSetupPreferences(prefs);onboardingEditing=false;nav('home');}
function startOnboarding(){onboardingEditing=true;nav('onboarding');}
function editSetup(key){onboardingEditing=true;activeSetting=key;nav('settings');}
function openSettings(key='account'){onboardingEditing=false;activeSetting=key;nav('settings');}
function selectSettings(key){if(key==='channels')gmailLoad().catch(connectionError);if(!['account','cv','channels','template','ai'].includes(key))key='account';activeSetting=key;document.querySelectorAll('.settings-panel').forEach(el=>el.hidden=el.id!=='settings-'+key);document.querySelectorAll('[data-setting]').forEach(el=>{el.classList.toggle('active',el.dataset.setting===key);el.setAttribute('aria-pressed',el.dataset.setting===key?'true':'false');});window.MrsaalTour?.contextChanged();}
function openImporter(){nav('companies');const panel=document.getElementById('import-panel');panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'});}
function ensureCV(){if(cvReady)return true;toast('ضيف السيرة الذاتية الأول عشان نكتب رسالة تعبّر عنك','error');openSettings('cv');return false;}
function setAppTheme(choice){let theme=choice==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):choice;document.documentElement.dataset.theme=theme;try{localStorage.setItem('mrsaal-theme-choice',choice);if(choice==='system')localStorage.removeItem('mrsaal-theme');else localStorage.setItem('mrsaal-theme',theme)}catch{}updateMrsaalThemeLabels();}
function updateMrsaalThemeLabels(){const dark=document.documentElement.dataset.theme==='dark';document.querySelectorAll('.theme-label').forEach(el=>el.textContent=dark?'☀ فاتح':'☾ داكن');let choice='system';try{choice=localStorage.getItem('mrsaal-theme-choice')||'system'}catch{}document.querySelectorAll('[data-choice]').forEach(el=>{el.classList.toggle('active',el.dataset.choice===choice);el.setAttribute('aria-pressed',el.dataset.choice===choice?'true':'false')});}
function toggleMrsaalTheme(){setAppTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');}
try{setAppTheme(localStorage.getItem('mrsaal-theme-choice')||'system')}catch{updateMrsaalThemeLabels()}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{try{if((localStorage.getItem('mrsaal-theme-choice')||'system')==='system')setAppTheme('system')}catch{}});
const authError=new URLSearchParams(location.search).get('error');if(authError){const el=document.getElementById('auth-error');el.hidden=false;el.textContent={auth_denied:'الدخول ما اكتملش. تقدر تحاول تاني وتراجع الصلاحيات في Google.',no_code:'رابط الدخول غير مكتمل. ابدأ تسجيل الدخول من الزر اللي تحت.',auth_failed:'تعذر تسجيل الدخول. حاول تاني، ولو المشكلة مستمرة راجع إعداد Google.'}[authError]||'حصلت مشكلة أثناء تسجيل الدخول. حاول تاني.';}
// Preview focus, Escape/backdrop, focus restoration.
let previousPreviewFocus=null,previewFocusBound=false;
const originalPreviewOne=previewOne;previewOne=async function(id,channel){previousPreviewFocus=document.activeElement;await originalPreviewOne(id,channel);if(document.getElementById('preview-overlay').classList.contains('open'))document.querySelector('#preview-overlay .modal').focus();};
const originalClosePrev=closePrev;closePrev=function(cancel=true){originalClosePrev(cancel);previousPreviewFocus?.focus?.();};
document.getElementById('preview-overlay').addEventListener('click',e=>{if(e.target.id==='preview-overlay')closePrev();});
document.addEventListener('keydown',e=>{const overlay=document.getElementById('preview-overlay');if(!overlay.classList.contains('open'))return;if(e.key==='Escape'){e.preventDefault();closePrev();}if(e.key==='Tab'){const items=[...overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.offsetParent!==null);if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!items.includes(document.activeElement))){e.preventDefault();first.focus();}}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',checkAuth,{once:true});else checkAuth();
