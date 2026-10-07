'use strict';
(()=>{
 const body=document.body,themeButton=document.querySelector('[data-theme-toggle]');
 function theme(value){body.dataset.theme=value;themeButton?.setAttribute('aria-pressed',String(value==='dark'));}
 try{theme(localStorage.getItem('mrsaal-site-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));}catch{theme('light');}
 themeButton?.addEventListener('click',()=>{const value=body.dataset.theme==='dark'?'light':'dark';theme(value);try{localStorage.setItem('mrsaal-site-theme',value);}catch{}});
 const menuButton=document.querySelector('[data-menu-toggle]'),menu=document.getElementById('mobile-menu');
 function closeMenu(){if(!menu)return;menu.hidden=true;menuButton?.setAttribute('aria-expanded','false');}
 menuButton?.addEventListener('click',()=>{if(!menu)return;menu.hidden=!menu.hidden;menuButton.setAttribute('aria-expanded',String(!menu.hidden));});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu&&!menu.hidden){closeMenu();menuButton?.focus();}});
 document.addEventListener('click',event=>{if(menu&&!menu.hidden&&!menu.contains(event.target)&&!menuButton?.contains(event.target))closeMenu();});
 matchMedia('(min-width: 1101px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
 document.querySelectorAll('[data-channel]').forEach(button=>button.addEventListener('click',()=>{
  const preview=button.closest('.m-preview');if(!preview)return;
  preview.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  const wa=button.dataset.channel==='wa',ar=document.documentElement.lang==='ar';
  const status=preview.querySelector('[data-skip]');if(status)status.textContent=wa?(ar?'تخطي: مفيش رقم':'Skipped: no phone'):(ar?'جاهز للمراجعة':'Ready for review');
  const subject=preview.querySelector('.m-msg strong');if(subject)subject.hidden=wa;
 }));
})();
