'use strict';
(()=>{
 if(window.top!==window||location.pathname!=='/app')return;
 const origin=location.origin,version=chrome.runtime.getManifest().version;let starting=false;
 const emit=data=>window.postMessage({type:'mrsaal-scraper-bridge',version,...data},origin);
 function account(){return document.getElementById('page-discovery')?.dataset.discoveryAccountId||'';}
 function poll(){
  if(document.hidden||!document.getElementById('page-discovery')?.classList.contains('active'))return;
  chrome.runtime.sendMessage({action:'appState',expectedAccountId:account()}).then(r=>{if(r?.ok)emit({event:'state',...r.data});}).catch(()=>emit({event:'disconnected'}));
 }
 window.addEventListener('message',event=>{if(event.source===window&&event.origin===origin&&event.data?.type==='mrsaal-scraper-hello'){emit({event:'ready'});poll();}});
 document.addEventListener('click',event=>{
  const manager=event.target.closest?.('[data-extension-browser]');if(manager&&event.isTrusted){const ua=navigator.userAgent,current=/Edg\//.test(ua)?'edge':/OPR\//.test(ua)?'opera':/Vivaldi/i.test(ua)?'vivaldi':navigator.brave?'brave':'chrome';if(manager.dataset.extensionBrowser===current||manager.dataset.extensionBrowser==='chromium')chrome.runtime.sendMessage({action:'openExtensions'}).catch(()=>{});return;}
  const button=event.target.closest?.('#discovery-maps,#discovery-job-search');
  if(!button||!event.isTrusted||button.disabled||!document.getElementById('page-discovery')?.classList.contains('active'))return;
  // Leave legacy workspace tabs alone until their app page is refreshed.
  if(!account())return;
  event.preventDefault();event.stopImmediatePropagation();if(starting)return;
  const form=document.getElementById('discovery-search');if(!form?.reportValidity())return;
  const value=id=>document.getElementById('discovery-'+id)?.value||'';
  starting=true;document.getElementById('page-discovery').dataset.discoveryMode=button.id==='discovery-maps'?'maps':'jobs';emit({event:'starting'});
  // No await before sendMessage: retain the browser's real click activation.
  chrome.runtime.sendMessage({action:'launchFromApp',mode:button.id==='discovery-maps'?'maps':'jobs',query:value('query'),country:value('country'),city:value('city'),workMode:value('mode'),limit:Number(value('limit'))||100,autoScroll:document.getElementById('discovery-auto-scroll')?.checked!==false,language:document.documentElement.lang,expectedAccountId:account()})
   .then(r=>{if(!r?.ok)throw new Error(r?.error||'تعذر بدء الإضافة.');emit({event:'started',panelOpened:r.data?.panelOpened});poll();})
   .catch(error=>emit({event:'error',error:error.message})).finally(()=>{starting=false;});
 },true);
 emit({event:'ready'});setInterval(poll,1200);
})();
