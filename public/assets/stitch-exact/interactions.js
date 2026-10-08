'use strict';
(()=>{
 const body=document.body,toggle=document.querySelector('[data-theme-toggle]');
 function theme(value){body.dataset.theme=value;toggle?.setAttribute('aria-pressed',String(value==='dark'));}
 try{theme(localStorage.getItem('mrsaal-site-theme')||'light');}catch{theme('light');}
 toggle?.addEventListener('click',()=>{const value=body.dataset.theme==='dark'?'light':'dark';theme(value);try{localStorage.setItem('mrsaal-site-theme',value);}catch{}});
 const trigger=document.querySelector('[data-menu-toggle]'),menu=document.getElementById('mobile-menu');
 trigger?.addEventListener('click',()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu){menu.hidden=true;trigger?.setAttribute('aria-expanded','false');}});
 document.querySelectorAll('.faq-trigger,.faq-header,.faq-toggle').forEach(button=>{
  const panel=button.nextElementSibling;if(!panel)return;
  button.setAttribute('aria-expanded',String(!panel.classList.contains('hidden')&&panel.style.display!=='none'));
  button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));panel.classList.toggle('hidden',!open);panel.style.display=open?'block':'none';});
 });
 const search=document.getElementById('guide-search-input')||document.getElementById('helpSearchInput');let category='all';
 function filter(){const q=search?.value.trim().toLowerCase()||'';document.querySelectorAll('[data-post-category],.faq-item').forEach(el=>{const match=el.textContent.toLowerCase().includes(q)&&(category==='all'||el.dataset.postCategory===category);el.hidden=!match;el.style.display=match?'':'none';});}
 search?.addEventListener('input',filter);document.querySelectorAll('[data-quick-search]').forEach(b=>b.addEventListener('click',()=>{if(search){search.value=b.dataset.quickSearch;filter();search.focus();}}));
 document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filter();}));
 ['clear-search-btn','reset-filter-btn'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{if(search)search.value='';category='all';filter();}));
 const form=document.querySelector('[data-support-form]');form?.addEventListener('submit',async e=>{
  e.preventDefault();const feedback=document.getElementById('form-feedback');const submit=form.querySelector('[type=submit]');const name=document.getElementById('contact-name')?.value.trim();const email=document.getElementById('contact-email')?.value.trim();const message=document.getElementById('contact-message')?.value.trim();
  feedback?.classList.remove('hidden');if(!message||message.length<10){if(feedback)feedback.textContent='اكتب تفاصيل طلبك في 10 حروف على الأقل.';return;}
  if(submit)submit.disabled=true;
  try{const response=await fetch('/api/tickets',{method:'POST',headers:{'Content-Type':'application/json','X-Mrsaal-Support':'1'},body:JSON.stringify({subject:'طلب من صفحة التواصل',body:[name,email,message].filter(Boolean).join('\n'),category:'general'})});if(response.status===401){if(feedback){feedback.textContent='سجّل الدخول أولًا لإرسال طلبك ومتابعة رد الدعم. ';const a=document.createElement('a');a.href='/ar/login';a.textContent='تسجيل الدخول';feedback.append(a);}return;}const data=await response.json();if(!response.ok)throw Error(data.error||'تعذر إرسال الطلب');if(feedback)feedback.textContent='تم تسجيل طلبك. يمكنك متابعة الرد من المساعدة داخل مساحة مرسال.';form.reset();}catch(error){if(feedback)feedback.textContent=error.message||'تعذر إرسال الطلب. حاول مرة أخرى.';}finally{if(submit)submit.disabled=false;}
 });
 // Demonstration channels only change the preview, never send messages.
 document.querySelectorAll('[data-preview-channel]').forEach(b=>b.addEventListener('click',()=>document.querySelectorAll('[data-preview-channel]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))));
})();
