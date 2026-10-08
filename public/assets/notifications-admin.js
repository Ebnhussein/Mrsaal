'use strict';
(()=>{
 const rail=document.querySelector('.admin-tabs'),area=document.getElementById('admin-content');if(!rail||!area)return;
 const en=()=>document.documentElement.lang==='en',t=(ar,eng)=>en()?eng:ar;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 async function req(path,method='GET',data){const r=await fetch('/api/notifications'+path,{method,headers:{'Content-Type':'application/json','X-Mrsaal-Notifications':'1'},...(data?{body:JSON.stringify(data)}:{})});const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}
 const tab=node('button',t('تحديثات وإشعارات','Updates & notifications'));tab.type='button';tab.className='m-button';tab.dataset.userContent='';tab.dataset.notificationAdmin='';rail.append(tab);
 async function show(){rail.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected','false'));tab.setAttribute('aria-selected','true');area.replaceChildren();area.dataset.userContent='';const h=node('h2',t('انشر تحديث للمستخدمين','Publish a product update')),intro=node('p',t('اعرض إيه الجديد في مرسال. الإعلان محفوظ في مركز الإشعارات ويصل لكل حساب فعّل نوع «تحديثات»، بما فيها الحسابات الجديدة.','Explain what changed in Mrsaal. Updates are stored in notification centres for accounts with updates enabled, including new users.'));area.append(h,intro);const form=node('form');form.className='nt-admin-release';
  for(const [key,ar,eng]of [['title_ar','العنوان بالعربي','Arabic title'],['title_en','العنوان بالإنجليزي','English title'],['body_ar','التفاصيل بالعربي','Arabic details'],['body_en','التفاصيل بالإنجليزي','English details']]){const label=node('label',t(ar,eng)),input=node(key.startsWith('title')?'input':'textarea');input.name=key;input.required=true;input.minLength=3;input.maxLength=key.startsWith('title')?120:1500;input.dir=key.endsWith('en')?'ltr':'rtl';label.append(input);form.append(label);}
  const publish=node('button',t('نشر التحديث','Publish update'));publish.className='m-button m-primary';publish.type='submit';const status=node('p');status.setAttribute('role','status');form.append(publish,status);area.append(form);
  form.addEventListener('submit',async e=>{e.preventDefault();publish.disabled=true;try{await req('/releases','POST',Object.fromEntries(new FormData(form)));status.textContent=t('تم نشر التحديث','Update published');form.reset();await history();window.MrsaalNotifications?.refresh();}catch(err){status.textContent=err.message;}finally{publish.disabled=false;}});
  const list=node('section');area.append(list);async function history(){const d=await req('/releases');list.replaceChildren(node('h2',t('التحديثات المنشورة','Published updates')));for(const r of d.releases){const article=node('article');article.className='nt-release-history';article.append(node('h3',r[en()?'title_en':'title_ar']),node('p',r[en()?'body_en':'body_ar']),node('time',new Date(r.created_at).toLocaleString(en()?'en-GB':'ar-EG')));list.append(article);}}
  await history();
 }
 tab.addEventListener('click',()=>show().catch(e=>{area.textContent=e.message;}));rail.addEventListener('click',e=>{if(e.target.closest('[data-tab]')){tab.setAttribute('aria-selected','false');delete area.dataset.userContent;}});
 document.addEventListener('mrsaal:language',()=>{tab.textContent=t('تحديثات وإشعارات','Updates & notifications');if(tab.getAttribute('aria-selected')==='true')show().catch(()=>{});});
 if(new URLSearchParams(location.search).get('section')==='support')setTimeout(()=>document.querySelector('[data-tab="support"]')?.click(),500);
})();
