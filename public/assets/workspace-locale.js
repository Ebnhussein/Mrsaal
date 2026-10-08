'use strict';
(()=>{
 let dictionary={},reverse={},pattern=null,queued=false;
 const memories=new WeakMap(),attributes=new WeakMap();
 const query=new URLSearchParams(location.search);let lang=query.get('lang');
 if(!['ar','en'].includes(lang))try{lang=localStorage.getItem('mrsaal-workspace-language')||document.documentElement.lang;}catch{lang=document.documentElement.lang;}
 lang=lang==='en'?'en':'ar';
 const protectedSelector='[data-workspace-language],[data-user-content],#welcome-name,#gmail-label,#gmail-sub,#profile-name,#profile-email,#channel-email,#prev-company,#rd-company,#rd-recipient,#rd-subject,#rd-body,#rd-reply,.mono,.support-message.user p,.support-message.assistant p';
 function t(value){const source=String(value??'');if(lang!=='en')return source;const trimmed=source.trim();if(dictionary[trimmed])return source.replace(trimmed,dictionary[trimmed]);return pattern?source.replace(pattern,m=>dictionary[m]):source;}
 function translateNode(node){if(!node.parentElement||node.parentElement.closest('script,style,textarea,[contenteditable],'+protectedSelector))return;const current=node.nodeValue;if(!current?.trim())return;const previous=memories.get(node);const source=previous?.last===current?previous.original:current;const trimmed=source.trim();const original=reverse[trimmed]?source.replace(trimmed,reverse[trimmed]):source;const next=t(original);memories.set(node,{original,last:next});if(next!==current)node.nodeValue=next;}
 function translateAttribute(el,key){const current=el.getAttribute(key);if(!current)return;let row=attributes.get(el);if(!row){row={};attributes.set(el,row);}const previous=row[key],source=previous?.last===current?previous.original:current,original=reverse[source.trim()]?source.replace(source.trim(),reverse[source.trim()]):source,next=t(original);row[key]={original,last:next};if(next!==current)el.setAttribute(key,next);}
 function refresh(){queued=false;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))translateNode(node);document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el=>{if(el.closest(protectedSelector))return;for(const key of ['placeholder','aria-label','title'])translateAttribute(el,key);});document.querySelectorAll('[data-workspace-language]').forEach(b=>{const label=lang==='en'?'عربي':'EN',aria=lang==='en'?'Switch to Arabic':'Switch to English';if(b.textContent!==label)b.textContent=label;if(b.getAttribute('aria-label')!==aria)b.setAttribute('aria-label',aria);});document.querySelectorAll('#public-site-link').forEach(a=>a.href='/'+lang+'/');}
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(refresh);}
 function setLanguage(value){lang=value==='en'?'en':'ar';document.documentElement.lang=lang;document.documentElement.dir=lang==='en'?'ltr':'rtl';try{localStorage.setItem('mrsaal-workspace-language',lang);}catch{}refresh();document.dispatchEvent(new CustomEvent('mrsaal:language',{detail:{lang}}));}
 window.MrsaalLocale={t,setLanguage,refresh,get lang(){return lang;}};
 document.documentElement.lang=lang;document.documentElement.dir=lang==='en'?'ltr':'rtl';
 const ready=fetch('/assets/workspace-translations.json?v=navigation-2').then(r=>{if(!r.ok)throw Error('Locale unavailable');return r.json();}).then(d=>{dictionary=d;reverse=Object.fromEntries(Object.entries(d).map(([a,b])=>[b,a]));const keys=Object.keys(d).filter(k=>k.length>2).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));pattern=new RegExp('(?<![\\u0600-\\u06ff])(?:'+keys.join('|')+')(?![\\u0600-\\u06ff])','g');setLanguage(lang);return lang;}).catch(()=>{setLanguage('ar');return 'ar';});
 window.MrsaalLocale.ready=ready;
 document.addEventListener('click',e=>{if(e.target.closest('[data-workspace-language]'))setLanguage(lang==='ar'?'en':'ar');});
 new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
 const nativeConfirm=window.confirm.bind(window),nativePrompt=window.prompt.bind(window);window.confirm=message=>nativeConfirm(t(message));window.prompt=(message,initial='')=>nativePrompt(t(message),initial);
 refresh();
})();
