'use strict';
// Presentation only: move existing controls without recreating inputs or changing application data.
(()=>{
 const key='mrsaal-workspace-view',groups=[],labels=[],$=id=>document.getElementById(id);
 const en=()=>document.documentElement.lang==='en',tr=(ar,english)=>en()?english:ar;
 let view='minimal';
 try{const requested=new URLSearchParams(location.search).get('view');view=requested==='detailed'||requested==='minimal'?requested:localStorage.getItem(key)==='detailed'?'detailed':'minimal';}catch{}
 function label(node,ar,english){labels.push({node,ar,english});node.dataset.userContent='';node.textContent=tr(ar,english);}
 function disclose(id,ar,english,nodes,initial=false){
  nodes=nodes.filter(Boolean);if(!nodes.length)return null;
  const details=document.createElement('details'),summary=document.createElement('summary'),title=document.createElement('span'),body=document.createElement('div');
  details.className='minimal-section';details.id='minimal-'+id;body.className='minimal-section-body';label(title,ar,english);summary.append(title);details.append(summary,body);
  nodes[0].before(details);for(const node of nodes)body.append(node);
  const group={details,expanded:initial};groups.push(group);details.open=view==='detailed'||initial;
  details.addEventListener('toggle',()=>{if(view==='minimal')group.expanded=details.open;});return details;
 }
 function inside(id,ar,english){const host=$(id);if(host)disclose(id,ar,english,[...host.children]);}
 // Home keeps the next action and recent activity; preparation details remain one click away.
 inside('home-readiness','تجهيز حسابك','Account setup');
 inside('home-workflow','الخطوات المتبقية','Remaining steps');
 // Import help belongs next to the uploader, instead of occupying the company list.
 const download=document.querySelector('#page-companies .template-download'),importCard=document.querySelector('#import-panel > .card');if(download&&importCard)importCard.prepend(download);
 const filters=disclose('filters','الفلاتر','Filters',[$('filter-status'),$('filter-contact')]);
 if(filters){filters.classList.add('minimal-filters');const count=document.createElement('span');count.className='minimal-filter-count';filters.querySelector('summary').append(count);const update=()=>{const n=[$('filter-status'),$('filter-contact')].filter(input=>input.value!=='all').length;count.hidden=!n;count.textContent=String(n);};for(const id of ['filter-status','filter-contact'])$(id).addEventListener('change',update);update();}
 const tools=document.querySelector('#page-companies > .launch-actions');if(tools)disclose('company-tools','الحملات والقوائم','Campaigns and lists',[tools]);
 // Essential writing preferences stay visible; examples, channel rules and testing are optional.
 const editor=$('writing-editor'),cards=editor?[...editor.children].filter(n=>n.classList.contains('card')):[];
 if(cards[1])disclose('writing-style','أمثلة وتعليمات أسلوبي','My writing examples and instructions',[cards[1]]);
 if(cards[2])disclose('writing-channels','تخصيص الإيميل والواتساب','Customize email and WhatsApp',[cards[2]]);
 if(cards[3])disclose('writing-test','تجربة الرسالة','Try a message',[cards[3]]);
 const cvText=$('cv-text');if(cvText){const textBox=cvText.parentElement,saveRow=textBox.nextElementSibling;disclose('cv-text','عرض وتعديل نص السيرة','View and edit CV text',[textBox,saveRow]);}
 const aiNotice=document.querySelector('#settings-ai > .connections-notice');if(aiNotice)disclose('ai-help','تفاصيل اختيار المنصات والموديلات','How providers and model selection work',[aiNotice]);
 const account=$('settings-account');if(account){const extras=account.querySelector('.account-preferences');if(extras)disclose('preferences','الإشعارات والإعداد السريع','Notifications and quick setup',[extras]);if($('account-data'))disclose('privacy','الاستخدام والبيانات والخصوصية','Usage, data and privacy',[$('account-data')]);}
 const sendOptions=document.querySelector('#page-send > .g2');if(sendOptions)disclose('send-options','الجدولة وخيارات الإرسال','Scheduling and sending options',[sendOptions]);
 const schedule=$('sched-type');schedule?.addEventListener('change',()=>{if(schedule.value!=='now')reveal(schedule);});
 // Sending errors and channel/recipient/attachment information are never hidden by this view.
 const toolbar=document.querySelector('.workspace-actions'),switcher=document.createElement('button');switcher.type='button';switcher.className='theme-button minimal-view-switch';switcher.id='workspace-view-switch';
 const icon=document.createElement('span'),caption=document.createElement('span');icon.className='material-symbols-outlined';icon.setAttribute('aria-hidden','true');icon.textContent='tune';caption.className='minimal-view-caption';caption.dataset.userContent='';switcher.append(icon,caption);toolbar?.prepend(switcher);
 function refresh(){for(const row of labels)row.node.textContent=tr(row.ar,row.english);const text=view==='minimal'?tr('عرض مفصّل','Detailed view'):tr('عرض مختصر','Minimal view');caption.textContent=text;switcher.setAttribute('aria-label',text);switcher.title=text;switcher.setAttribute('aria-pressed',String(view==='minimal'));}
 function setView(next){view=next==='detailed'?'detailed':'minimal';document.documentElement.dataset.workspaceView=view;try{localStorage.setItem(key,view);}catch{}for(const group of groups)group.details.open=view==='detailed'||group.expanded;refresh();}
 function reveal(node){for(let parent=node?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;}
 switcher.addEventListener('click',()=>{setView(view==='minimal'?'detailed':'minimal');try{const url=new URL(location.href);if(url.searchParams.has('view')){url.searchParams.set('view',view);history.replaceState(null,'',url.pathname+url.search+url.hash);}}catch{}});
 // Native form validation must reveal an optional section before trying to focus its field.
 document.addEventListener('invalid',event=>reveal(event.target),true);
 document.addEventListener('mrsaal:language',refresh);
 window.MrsaalMinimal={setView,reveal,get view(){return view;}};setView(view);
})();
