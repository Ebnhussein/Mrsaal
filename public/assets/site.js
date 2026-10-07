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

/* Motion is progressive enhancement: content is never hidden by CSS. */
(()=>{
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 if(preference.matches||typeof window.IntersectionObserver!=='function')return;
 const active=new Set(),seen=new WeakSet();
 function move(element,frames,options){
  if(preference.matches||document.hidden||typeof element?.animate!=='function')return;
  const animation=element.animate(frames,options);active.add(animation);
  animation.finished?.then(()=>active.delete(animation),()=>active.delete(animation));
 }
 function reveal(element,index=0){
  if(seen.has(element)||preference.matches)return;seen.add(element);
  move(element,[{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],{duration:560,delay:Math.min(index*65,195),easing:'cubic-bezier(.22,1,.36,1)'});
 }
 const observer=new window.IntersectionObserver(entries=>{
  let index=0;
  for(const entry of entries){if(!entry.isIntersecting)continue;reveal(entry.target,index++);observer.unobserve(entry.target);}
 },{threshold:0.06,rootMargin:'0px 0px -24px 0px'});
 document.querySelectorAll('.m-section-intro,.m-section-title,.m-feature-copy,.m-feature-art,.m-feature,.m-path,.m-workflow>div,.m-plan,.m-faq>div,.m-bottom,.m-login-story,.m-login-panel,.m-page-heading').forEach(element=>observer.observe(element));
 document.querySelectorAll('.m-hero>.m-eyebrow,.m-hero>h1,.m-hero>.m-desc,.m-hero>.m-actions,.m-hero>.m-fine,.m-hero-product').forEach((element,index)=>reveal(element,index));
 const product=document.querySelector('.m-hero-product .m-preview');
 if(product){
  const ambient=new window.IntersectionObserver(entries=>{
   for(const entry of entries){if(!entry.isIntersecting)continue;
    move(entry.target,[{transform:'translateY(0)'},{transform:'translateY(-5px)'},{transform:'translateY(0)'}],{duration:4800,iterations:2,easing:'ease-in-out'});
    ambient.unobserve(entry.target);
   }
  },{threshold:0.3});ambient.observe(product);
  preference.addEventListener?.('change',event=>{if(event.matches)ambient.disconnect();});
 }
 document.querySelectorAll('.m-faq details,.m-help-content details').forEach(details=>details.addEventListener('toggle',()=>{
  if(details.open)move(details.querySelector('p'),[{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
 }));
 document.querySelector('[data-theme-toggle]')?.addEventListener('click',event=>move(event.currentTarget.querySelector('.m-icon'),[{transform:'rotate(0deg)'},{transform:'rotate(90deg)'}],{duration:240,easing:'ease-out'}));
 document.querySelector('[data-menu-toggle]')?.addEventListener('click',()=>{
  const menu=document.getElementById('mobile-menu');if(menu&&!menu.hidden)move(menu,[{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
 });
 function stop(){for(const animation of active)animation.cancel();active.clear();}
 preference.addEventListener?.('change',event=>{if(event.matches){stop();observer.disconnect();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
})();
