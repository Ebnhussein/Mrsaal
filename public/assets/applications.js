'use strict';
(()=>{
 const t=value=>window.MrsaalLocale?.t(value)||value;
 const overlay=document.getElementById('applications-drawer'),panel=overlay.querySelector('[role=dialog]');
 let focusBefore=null,locks=[],overflowBefore='';
 function syncSelection(){
  const selected=companies.filter(c=>c.selected).length,visible=filteredCompanyRows(),checked=visible.filter(c=>c.selected).length;
  document.getElementById('applications-selection').hidden=!selected;
  const hiddenCount=selected-checked,note=document.getElementById('applications-hidden-selected');note.hidden=!hiddenCount;note.textContent=hiddenCount+' '+t('شركة محددة خارج النتائج الظاهرة؛ الفلتر لا يلغي التحديد.');
  document.getElementById('selection-count').textContent=t('تم تحديد')+' '+selected+' '+t('شركة');
  document.querySelectorAll('[data-select-visible],#applications-select-visible').forEach(input=>{input.checked=!!visible.length&&checked===visible.length;input.indeterminate=checked>0&&checked<visible.length;input.disabled=!visible.length;});
  if(document.querySelector('#page-companies.active'))document.getElementById('workspace-current').textContent=t('الشركات والتقديم');
  document.querySelectorAll('.work-bottom-nav [data-page=settings]:not([data-work-setting])').forEach(b=>b.classList.toggle('active',!!document.querySelector('#page-settings.active')&&activeSetting!=='template'));
  document.querySelectorAll('.work-bottom-nav [data-work-setting]').forEach(b=>b.classList.toggle('active',!!document.querySelector('#page-settings.active')&&activeSetting===b.dataset.workSetting));
 }
 function close(){
  if(overlay.hidden)return;window.MrsaalTour?.stop();overlay.hidden=true;locks.forEach(([el,value])=>el.inert=value);locks=[];document.body.style.overflow=overflowBefore;focusBefore?.focus();
 }
 function open(){
  if(!companies.some(c=>c.selected)){toast(t('حدد شركات لتجهيز الإرسال'),'info');return;}
  if(!overlay.hidden)return;
  window.MrsaalTour?.stop();document.getElementById('send-filter').value='selected';updateChannelSummary();
  focusBefore=document.activeElement;overflowBefore=document.body.style.overflow;document.body.style.overflow='hidden';overlay.hidden=false;
  locks=[...document.body.children].filter(el=>el!==overlay&&!['SCRIPT','STYLE'].includes(el.tagName)).map(el=>[el,el.inert]);locks.forEach(([el])=>el.inert=true);
  overlay.querySelector('button').focus();
 }
 overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
 document.addEventListener('keydown',event=>{
  if(overlay.hidden||document.getElementById('mrsaal-tour')?.getClientRects().length)return;
  if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='Tab'){
   const items=[...panel.querySelectorAll('button,input,select,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length&&!el.closest('[hidden]'));
   const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 });
 const render=renderCompanies;renderCompanies=function(...args){const result=render(...args);syncSelection();return result;};
 const navigate=nav;nav=function(page){if(page==='send'){close();navigate('companies');open();return;}close();const result=navigate(page);syncSelection();return result;};
 const select=selectSettings;selectSettings=function(...args){const result=select(...args);syncSelection();return result;};
 const summarize=updateChannelSummary;updateChannelSummary=function(){const result=summarize();const excluded=companies.filter(c=>c.selected).length-deliveryQueue(selectedDeliveryChannel()).length,note=document.getElementById('applications-excluded');note.hidden=!excluded;note.textContent=excluded+' '+t('شركة مستبعدة لأنها أُرسل إليها على نفس القناة.');return result;};
 const start=startSend;startSend=async function(){document.getElementById('send-filter').value='selected';if(document.getElementById('opt-preview').checked&&document.getElementById('sched-type').value==='now')close();return start();};
 document.addEventListener('mrsaal:language',syncSelection);
 window.MrsaalApplications={open,close};
 syncSelection();
})();
