'use strict';
(()=>{
 const t=value=>window.MrsaalLocale?.t(value)||value;
 const metrics=document.getElementById('work-company-metrics');
 function updateMetrics(){if(!metrics||typeof companies==='undefined')return;const vals=[[companies.length,'إجمالي الشركات'],[companies.filter(c=>c.email||c.phone).length,'بيانات تواصل متاحة'],[companies.filter(c=>c.selected).length,'شركات محددة'],[companies.filter(c=>c.status==='sent').length,'تم الإرسال']];metrics.replaceChildren(...vals.map(([count,label])=>{const div=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');span.textContent=t(label);strong.textContent=count;div.append(span,strong);return div;}));}
 if(typeof renderCompanies==='function'){
  const original=renderCompanies;renderCompanies=function(){original();updateMetrics();const container=document.getElementById('companies-container'),table=container.querySelector('.tbl-wrap');if(!table)return;table.classList.add('work-company-table');const rows=filteredCompanyRows();const cards=document.createElement('div');cards.className='work-company-list';cards.innerHTML=rows.map(c=>`<article class="work-company-card"><div class="work-company-head"><span class="work-company-mark" data-user-content>${esc(c.name.charAt(0))}</span><div><h3 data-user-content>${esc(c.name)}</h3><small data-user-content>${esc([c.field,c.location].filter(Boolean).join(' · '))}</small></div><label class="work-company-check"><input type="checkbox" ${c.selected?'checked':''} aria-label="${esc(t('تحديد الشركة'))}" data-company-select="${esc(c.id)}"></label></div><div class="work-company-contacts" data-user-content>${c.email?`<span>${esc(c.email)}</span>`:''}${c.phone?`<span>${esc(c.phone)}</span>`:''}${!c.email&&!c.phone?`<span>${esc(t('لا توجد وسيلة تواصل'))}</span>`:''}</div><div class="work-company-actions"><span class="tag ${esc(c.status)}">${esc(t(stLabel(c.status)))}</span><button class="btn btn-primary" data-company-preview="${esc(c.id)}">${esc(t('مراجعة الرسالة'))}</button></div></article>`).join('');container.append(cards);};
  document.getElementById('companies-container').addEventListener('click',e=>{const b=e.target.closest('[data-company-preview]');if(b)previewOne(b.dataset.companyPreview);});
  document.getElementById('companies-container').addEventListener('change',async e=>{if(!e.target.matches('[data-company-select]'))return;try{await toggleChk(e.target.dataset.companySelect,e.target.checked);renderCompanies();}catch(error){toast(error.message,'error');}});
 }
 if(typeof refreshWorkspace==='function'){const original=refreshWorkspace;refreshWorkspace=function(){original();updateMetrics();};}
 function syncNavigation(){
  const page=document.querySelector('.page.active')?.id.replace('page-','');
  document.querySelectorAll('.sidebar .nav-item').forEach(b=>{
   const active=b.dataset.workSetting?page==='settings'&&b.dataset.workSetting===activeSetting:b.dataset.page===page;
   b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  if(page==='settings'){
   const label={template:'الرسائل',cv:'السيرة الذاتية',channels:'قنوات التواصل',ai:'منصات الذكاء الاصطناعي',account:'الإعدادات'}[activeSetting];
   const heading=document.querySelector('#page-settings .ph h1');if(label){heading.textContent=t(label);document.getElementById('workspace-current').textContent=t(label);}
  }
  const channelReady=waState==='connected'||(typeof gmailAccounts!=='undefined'&&gmailAccounts.some(a=>a.connected));
  const states={cv:[cvReady,cvReady?'مرفوع':dataLoaded?'لم يُرفع':'لم يتم التحقق'],channels:[channelReady,channelReady?'متصل':dataLoaded&&waState!=='unknown'?'غير متصل':'لم يتم التحقق'],ai:[window.MrsaalProviderSetup?.configured,window.MrsaalProviderSetup?window.MrsaalProviderSetup.configured?'مُعدّ':'غير مُعدّ':'لم يتم التحقق']};
  document.querySelectorAll('[data-work-status]').forEach(n=>{const state=states[n.dataset.workStatus];const text=t(state[1]);if(n.textContent!==text)n.textContent=text;n.dataset.ready=String(!!state[0]);});
 }
 for(const name of ['nav','selectSettings','refreshWorkspace']){
  const original=window[name];if(typeof original==='function')window[name]=function(...args){const result=original(...args);syncNavigation();return result;};
 }
 if(typeof gmailLoad==='function'){const original=gmailLoad;gmailLoad=async function(...args){try{return await original(...args);}finally{syncNavigation();}};}
 document.addEventListener('mrsaal:providers',syncNavigation);
 document.addEventListener('mrsaal:language',syncNavigation);
 syncNavigation();
 // Navigation state is reflected in both the rail and the mobile bar.
 document.querySelector('.work-bottom-nav')?.setAttribute('aria-label',t('التنقل السريع'));
 updateMetrics();
})();
