'use strict';
(()=>{
 const t=value=>window.MrsaalLocale?.t(value)||value;
 const overlay=document.getElementById('applications-drawer'),panel=overlay.querySelector('[role=dialog]');
 let focusBefore=null,locks=[],overflowBefore='';
 function syncSelection(){
  const selected=companies.filter(c=>c.selected).length,visible=filteredCompanyRows(),checked=visible.filter(c=>c.selected).length;
  document.getElementById('applications-selection').hidden=false;
  document.querySelectorAll('[data-company-selection-action]').forEach(button=>{button.disabled=!selected;});
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
 function showError(error){
  let host=document.getElementById('applications-send-error');
  if(!host){host=document.createElement('div');host.id='applications-send-error';host.className='card';host.setAttribute('role','status');document.getElementById('page-send').prepend(host);}
  const message=document.createElement('p');message.textContent=error.message;host.replaceChildren(message);host.hidden=false;
  if(['CAMPAIGN_ALREADY_SENT','NO_ELIGIBLE_COMPANIES'].includes(error.code)&&document.getElementById('opt-skip-sent').checked){
   const action=document.createElement('button');action.type='button';action.className='btn btn-secondary';action.textContent=document.documentElement.lang==='en'?'Allow new messages to previously contacted companies':'السماح برسائل جديدة للشركات المُرسل إليها سابقًا';
   action.onclick=()=>{document.getElementById('opt-skip-sent').checked=false;updateChannelSummary();host.hidden=true;};host.append(action);
  }
  if(error.code==='CAMPAIGN_SELECTION_STALE'){
   const refresh=document.createElement('button');refresh.type='button';refresh.className='btn btn-secondary';refresh.textContent=document.documentElement.lang==='en'?'Refresh company list':'تحديث قائمة الشركات';refresh.onclick=async()=>{refresh.disabled=true;try{if(await loadCompanies())host.hidden=true;}finally{refresh.disabled=false;}};host.append(refresh);
  }
  host.scrollIntoView?.({block:'nearest',behavior:'smooth'});
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
 const start=startSend;let starting=false;startSend=async function(){if(starting)return false;starting=true;document.getElementById('send-filter').value='selected';try{const success=await start();if(success)close();return success;}finally{starting=false;}};
 document.addEventListener('mrsaal:language',()=>{syncSelection();updateChannelSummary();});
 window.MrsaalApplications={open,close,showError};
 syncSelection();
})();
