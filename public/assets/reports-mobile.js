'use strict';
(()=>{
 const t=value=>window.MrsaalLocale?.t(value)||value;
 const container=document.getElementById('log-container');
 function renderMobileReports(){
  const table=container.querySelector('.tbl-wrap');if(table)table.classList.add('reports-desktop-table');
  container.querySelector('.reports-mobile-list')?.remove();
  document.getElementById('reports-export').disabled=!log.length;document.getElementById('reports-clear').disabled=!log.length;
  if(!log.length)return;
  const cards=document.createElement('div');cards.className='reports-mobile-list';
  cards.innerHTML=log.map(item=>{
   const whatsapp=item.channel==='whatsapp',reply=!!item.replied;
   const read=whatsapp?!!item.whatsapp_read_at:!!item.open_count;
   const delivered=whatsapp&&!!item.whatsapp_delivered_at;
   const label=reply?'تم الرد':read?(whatsapp?'قراءة واتساب':'رصد فتح البريد'):delivered?'تسليم واتساب':stLabel(item.status);
   const status=reply?'replied':read?'opened':item.status;
   return `<article class="reports-mobile-card"><div class="reports-card-heading"><span class="reports-company-mark" aria-hidden="true" data-user-content>${esc(String(item.company_name||'').charAt(0)||'—')}</span><div><h3 data-user-content>${esc(item.company_name||t('بدون اسم شركة'))}</h3><time>${esc(reportDate(item.sent_at))}</time></div><span class="log-status ${esc(status)}">${esc(t(label))}</span></div><div class="reports-recipient"><span class="reports-channel">${esc(t(whatsapp?'واتساب':'إيميل'))}</span><span dir="auto" data-user-content>${esc(item.company_email||'—')}</span></div>${item.status==='skipped'&&item.reason?`<p class="reports-card-note">${esc(t(item.reason))}</p>`:''}${item.status==='failed'&&item.reason?`<p class="reports-card-note reports-card-error">${esc(t(item.reason))}</p>`:''}${reply&&item.reply_text?`<div class="reports-reply"><strong>${esc(t('آخر رد مرصود'))}</strong><p dir="auto" data-user-content>${esc(item.reply_text)}</p></div>`:''}<button type="button" class="btn btn-secondary" data-report-details="${esc(item.id)}">${esc(t('عرض التفاصيل'))}<span class="material-symbols-outlined" aria-hidden="true">arrow_outward</span></button></article>`;
  }).join('');container.append(cards);
 }
 const render=renderLog;renderLog=function(...args){const result=render(...args);renderMobileReports();return result;};
 container.addEventListener('click',event=>{const button=event.target.closest('[data-report-details]');if(button)viewLogDetail(button.dataset.reportDetails);});
 const sync=syncNow;syncNow=async function(){const button=document.getElementById('reports-sync');if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');const label=button.querySelector('span:last-child');label.textContent=t('جاري تحديث الردود');try{return await sync();}finally{label.textContent=t('تحديث الردود');button.disabled=false;button.removeAttribute('aria-busy');}};
 document.addEventListener('mrsaal:language',renderMobileReports);
 renderMobileReports();
})();
