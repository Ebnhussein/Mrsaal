'use strict';
(()=>{
 const root=document.getElementById('scraper-install');if(!root)return;
 const t=s=>window.MrsaalLocale?.t(s)||s,urls={chrome:'chrome://extensions/',edge:'edge://extensions/',brave:'brave://extensions/',opera:'opera://extensions/',vivaldi:'vivaldi://extensions/',chromium:'chrome://extensions/'};
 let step=0,timer=null;
 function show(n){step=(n+4)%4;root.querySelector('.install-demo').dataset.step=step;root.querySelectorAll('[data-demo]').forEach(el=>el.hidden=Number(el.dataset.demo)!==step);document.getElementById('guide-counter').textContent=(step+1)+' / 4';}
 function stop(){clearInterval(timer);timer=null;document.getElementById('guide-play').textContent=t('تشغيل الشرح');}
 root.querySelector('[data-guide-prev]').onclick=()=>{stop();show(step-1);};root.querySelector('[data-guide-next]').onclick=()=>{stop();show(step+1);};
 document.getElementById('guide-play').onclick=()=>{if(timer){stop();return;}document.getElementById('guide-play').textContent=t('إيقاف الشرح');timer=setInterval(()=>{if(!document.hidden&&document.getElementById('page-discovery').classList.contains('active'))show(step+1);},3500);};
 root.querySelectorAll('[data-extension-browser]').forEach(button=>button.addEventListener('click',async()=>{
  const url=urls[button.dataset.extensionBrowser],input=document.getElementById('extension-manager-url');input.value=url;root.querySelector('.demo-address').textContent=url;
  try{await navigator.clipboard.writeText(url);document.getElementById('extension-guide-status').textContent=t('العنوان اتنسخ. الصقه في شريط عنوان المتصفح واضغط Enter.');}
  catch{input.focus();input.select();document.getElementById('extension-guide-status').textContent=t('انسخ العنوان المحدد والصقه في شريط عنوان المتصفح.');}
 }));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});document.addEventListener('mrsaal:language',()=>{if(!timer)stop();});show(0);
})();
