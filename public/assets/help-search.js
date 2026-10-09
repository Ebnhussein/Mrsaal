(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else {root.MrsaalHelpSearch=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',api.mount);else api.mount();}})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function normalize(value){return String(value||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g,'').replace(/ـ/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0621-\u064a]+/g,' ').trim();}
 const stop=new Set(['ازاي','كيف','مش','هو','هي','في','من','علي','عايز','عاوزه','عاوز','مشكله','ده','دي','مع','بتاع','the','is','a','an','my','how','do','does','to','not','and','i','can','it','with','of']);
 function tokens(s){return [...new Set(normalize(s).split(/\s+/).map(x=>x.startsWith('ال')&&x.length>4?x.slice(2):x).filter(x=>x&&!stop.has(x)))].slice(0,16);}
 function search(data,query='',category='all'){
  const words=tokens(query),q=normalize(query);return data.issues.filter(x=>category==='all'||x.category===category).map((issue,index)=>{
   const title=tokens(issue.title),keywords=tokens(issue.keywords),cat=data.categories.find(c=>c.id===issue.category),categoryWords=tokens(cat?.title);let matches=0,score=0;
   for(const word of words){const exact=title.includes(word),alias=keywords.includes(word),prefix=word.length>=3&&(title.some(t=>t.startsWith(word)||word.startsWith(t)&&t.length>=3)||keywords.some(t=>t.startsWith(word)));if(exact||alias||prefix||categoryWords.includes(word)){matches++;score+=exact?8:alias?6:prefix?3:1;}}
   if(q&&normalize(issue.title).includes(q))score+=12;
   return {issue,score,matches,index};
  }).filter(r=>!words.length||r.matches>0).sort((a,b)=>b.matches-a.matches||b.score-a.score||a.index-b.index).slice(0,24).map(r=>r.issue);
 }
 function node(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
 function mount(){
  const input=(document.getElementById('helpSearchInput')||document.getElementById('guide-search-input')),script=document.getElementById('help-search-data'),panel=document.getElementById('help-search-results');if(!input||!script||!panel)return;
  let data;try{data=JSON.parse(script.textContent);}catch{return;}const en=data.language==='en',clear=(document.getElementById('clearSearchBtn')||document.getElementById('clear-search-btn')),searchRow=input.parentElement;document.body.append(panel);searchRow.classList.add('help-search-input-row');input.autocomplete='off';input.maxLength=200;input.setAttribute('aria-label',en?'Search Mrsaal help':'ابحث في مساعدة مرسال');input.setAttribute('aria-controls',panel.id);input.setAttribute('aria-expanded','false');if(data.mode!=='guides')input.placeholder=en?'Describe the issue: PDF, Gmail, WhatsApp, AI…':'اكتب المشكلة: PDF، إيميل، واتساب، AI…';
  if(data.mode==='guides'){panel.querySelector('h2').textContent=en?'Find a useful guide':'وصل للدليل المناسب';panel.setAttribute('aria-label',en?'Suggested guides':'الأدلة المقترحة');input.setAttribute('aria-label',en?'Search Mrsaal guides':'ابحث في دليل مرسال');}
  let active='all',visible=[],returnFocus=null,dialog=null;
  const categories=panel.querySelector('[data-help-categories]'),results=panel.querySelector('[data-help-results]'),status=panel.querySelector('[data-help-search-status]');
  function positionPanel(){
   if(panel.hidden)return;
   const rect=searchRow.getBoundingClientRect(),viewport=window.visualViewport;
   const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight;
   if(rect.bottom<=top||rect.top>=top+height){hide();return;}
   const panelWidth=Math.min(rect.width,width-24),x=Math.max(left+12,Math.min(rect.left,left+width-panelWidth-12));
   const below=top+height-rect.bottom-20,above=rect.top-top-20,useAbove=below<180&&above>below;
   const available=Math.max(0,useAbove?above:below);
   panel.style.width=panelWidth+'px';panel.style.left=x+'px';panel.style.maxHeight=Math.min(560,available)+'px';
   panel.style.top=(useAbove?Math.max(top+12,rect.top-8-Math.min(panel.scrollHeight,560,available)):rect.bottom+8)+'px';
  }
  function show(){panel.hidden=false;input.setAttribute('aria-expanded','true');render();positionPanel();}
  function hide(){panel.hidden=true;input.setAttribute('aria-expanded','false');}
  function render(){
   visible=search(data,input.value,active);categories.replaceChildren();results.replaceChildren();if(clear){clear.classList.toggle('hidden',!input.value);clear.setAttribute('aria-label',en?'Clear search':'مسح البحث');}
   for(const cat of [{id:'all',title:en?'All categories':'كل التصنيفات'},...data.categories]){const b=node('button',cat.title);b.type='button';b.setAttribute('aria-pressed',String(cat.id===active));b.addEventListener('click',()=>{active=cat.id;render();});categories.append(b);}
   status.textContent=input.value.trim()?(visible.length?(en?(data.mode==='guides'?'Related guides: ':'Related problems: '):(data.mode==='guides'?'أدلة مرتبطة ببحثك: ':'مشاكل مرتبطة ببحثك: '))+visible.length:(en?'No results. Try PDF, Gmail, WhatsApp or AI.':'مفيش نتائج مطابقة. جرّب كلمة زي PDF أو إيميل أو واتساب أو AI.')):(en?'Choose a category or describe the problem.':'اختار تصنيف أو اكتب المشكلة اللي بتقابلك.');
   for(const cat of data.categories){const entries=visible.filter(x=>x.category===cat.id);if(!entries.length)continue;const group=node('section',null,'help-search-group');const h=node('h3');const icon=node('span',cat.icon,'material-symbols-outlined');icon.setAttribute('aria-hidden','true');h.append(icon,document.createTextNode(cat.title));group.append(h);
    const list=node('ul');for(const issue of entries.slice(0,input.value.trim()||active!=='all'?8:2)){const li=node('li'),b=node('button',null,'help-search-issue');b.type='button';b.append(node('span',issue.title),node('span',en?(data.mode==='guides'?'Read guide →':'View solution →'):(data.mode==='guides'?'افتح الدليل ←':'شوف الحل ←'),'help-search-open'));b.addEventListener('click',()=>openIssue(issue,b));li.append(b);list.append(li);}group.append(list);results.append(group);}
   positionPanel();
   if(!visible.length){const link=node('a',en?'Contact support':'تواصل مع الدعم','help-search-contact');link.href='/'+data.language+'/contact';results.append(link);}
  }
  function openIssue(issue,trigger){
   if(data.mode==='guides'){window.location.assign(issue.href);return;}
   if(!dialog){dialog=node('dialog',null,'help-solution');dialog.setAttribute('aria-labelledby','help-solution-title');dialog.innerHTML='<header><div><small data-solution-category></small><h2 id="help-solution-title"></h2></div><button type="button" data-solution-close>×</button></header><div data-solution-body></div><footer></footer>';document.body.append(dialog);dialog.querySelector('[data-solution-close]').setAttribute('aria-label',en?'Close solution':'إغلاق الحل');dialog.querySelector('[data-solution-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});}
   returnFocus=trigger;dialog.querySelector('h2').textContent=issue.title;dialog.querySelector('[data-solution-category]').textContent=data.categories.find(c=>c.id===issue.category)?.title||'';const answer=data.documents[issue.topic],body=dialog.querySelector('[data-solution-body]');body.replaceChildren();body.append(node('p',en?'From the current Mrsaal guide: '+answer.title:'من دليل مرسال الحالي: '+answer.title,'help-solution-source'));for(const paragraph of answer.answer.split(/\n\n+/))body.append(node('p',paragraph));
   const footer=dialog.querySelector('footer');footer.replaceChildren();const guide=node('a',en?'More practical guides':'أدلة عملية أكتر');guide.href=answer.href||'/'+data.language+'/blog';const support=node('a',en?'Contact support':'تواصل مع الدعم');support.href='/'+data.language+'/contact';footer.append(guide,support);dialog.showModal();dialog.querySelector('[data-solution-close]').focus();
  }
  
  if(data.mode==='guides')document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.category;show();}));
  const hubs=[['cv-mobile','cv-versions','profile','tour'],['import','arabic-csv','phones','cv-mobile'],['gmail-link','gmail-permissions','qr','wa-attachment'],['ai-connect','ai-quota','ai-slow','style','template','preview'],['opens','replies','sound','campaign','schedule'],['confirm','password','profile','ticket']];
  document.querySelectorAll('#categoriesGrid .category-card').forEach((card,index)=>{
   card.tabIndex=0;card.setAttribute('role','button');card.style.cursor='pointer';
   const entries=data.issues.filter(issue=>(hubs[index]||[]).includes(issue.id)),label=card.querySelector('h3')?.textContent||'';
   const count=card.querySelector('.mt-space-md span');if(count)count.textContent=entries.length+(en?' help topics':' موضوعات مساعدة');
   const launch=()=>{hide();const chooser=node('dialog',null,'help-solution');chooser.setAttribute('aria-label',label);const header=node('header'),title=node('h2',label),close=node('button','×');close.type='button';close.setAttribute('aria-label',en?'Close':'إغلاق');header.append(title,close);const body=node('div');body.setAttribute('data-solution-body','');for(const issue of entries){const b=node('button',issue.title,'help-search-issue');b.type='button';b.addEventListener('click',()=>{chooser.close();openIssue(issue,card);});body.append(b);}if(index===5){const a=node('a',en?'Read the privacy policy':'اقرأ سياسة الخصوصية');a.href='/'+data.language+'/privacy';body.append(a);}chooser.append(header,body);document.body.append(chooser);close.addEventListener('click',()=>chooser.close());chooser.addEventListener('click',e=>{if(e.target===chooser)chooser.close();});chooser.addEventListener('close',()=>{chooser.remove();card.focus({preventScroll:true});});chooser.showModal();close.focus();};
   card.addEventListener('click',launch);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();launch();}});
  });

  window.addEventListener('resize',positionPanel);window.addEventListener('scroll',positionPanel,{passive:true});window.visualViewport?.addEventListener('resize',positionPanel);window.visualViewport?.addEventListener('scroll',positionPanel);
  input.addEventListener('focus',show);input.addEventListener('input',show);clear?.addEventListener('click',()=>{input.value='';active='all';show();input.focus();});panel.querySelector('[data-help-search-close]').addEventListener('click',()=>{hide();input.focus({preventScroll:true});hide();});
  document.querySelectorAll('[data-quick-search]').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.quickSearch;active='all';show();input.focus();}));
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();show();results.querySelector('button')?.focus();}if(e.key==='Enter'){e.preventDefault();show();results.querySelector('button')?.click();}if(e.key==='Escape')hide();});
  panel.addEventListener('keydown',e=>{const buttons=[...results.querySelectorAll('button')],at=buttons.indexOf(document.activeElement);if(at>=0&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const next=at+(e.key==='ArrowDown'?1:-1);if(next<0)input.focus();else buttons[Math.min(next,buttons.length-1)]?.focus();}if(e.key==='Escape'){hide();input.focus();hide();}});
  document.addEventListener('pointerdown',e=>{if(!panel.contains(e.target)&&!searchRow.contains(e.target)&&!dialog?.contains(e.target))hide();});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();show();}});
 }
 return {normalize,tokens,search,mount};
});
