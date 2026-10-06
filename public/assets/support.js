(()=>{'use strict';
let root,panel,messages,input,send,topics,opened=false,waiting=false,lastTopics=[],account='',previousFocus,locks=[],sequence=0;
const actions={tickets:()=>window.MrsaalTickets?.open(),cv:()=>openSettings('cv'),channels:()=>openSettings('channels'),template:()=>openSettings('template'),ai:()=>openSettings('ai'),account:()=>openSettings('account'),companies:()=>nav('companies'),send:()=>nav('send'),report:()=>nav('report'),tour:()=>window.MrsaalTour?.start()};
const suggestions=[['cv','أرفع السي في إزاي؟'],['companies','الشركات مش ظاهرة'],['style','أظبط أسلوبي إزاي؟'],['whatsapp','ربط واتساب'],['ai','الـAI مش بيكتب'],['reports','القراءة والردود']];
function user(){try{return currentUser?.email||'';}catch{return '';}}
function button(label,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;b.addEventListener('click',fn);return b;}
async function request(path,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),110000);try{const r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal});const data=await r.json();if(!r.ok)throw new Error(data.error||'تعذر تحميل الرد');return data;}finally{clearTimeout(timer);}}
function line(text,kind='assistant'){const wrap=document.createElement('div');wrap.className='support-message '+kind;const tag=document.createElement('strong');tag.textContent=kind==='user'?'أنت':'مساعد مرسال';const p=document.createElement('p');p.textContent=text;wrap.append(tag,p);messages.append(wrap);messages.scrollTop=messages.scrollHeight;return wrap;}
const TYPING_DELAY_MS=850; // minimum time before a fast reply begins
const TYPING_CHUNK_MS=28; // 4 characters per tick; no extra API calls
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function typeText(node,text,token){
 const chars=Array.from(String(text||''));
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){if(token!==sequence)return false;node.textContent=chars.join('');return true;}
 for(let i=0;i<chars.length;i+=4){if(token!==sequence)return false;const follow=messages.scrollHeight-messages.scrollTop-messages.clientHeight<80;node.textContent+=chars.slice(i,i+4).join('');if(follow)messages.scrollTop=messages.scrollHeight;await pause(TYPING_CHUNK_MS);}
 return token===sequence;
}
async function display(data,token){
 if(token!==sequence)return;
 const wrap=line('');wrap.setAttribute('aria-busy','true');
 const body=wrap.querySelector('p');
 try{
  if(!await typeText(body,data.text||'اختار موضوعًا من المساعدة.',token))return;
  for(const item of data.articles||[]){
   if(token!==sequence)return;
   const h=document.createElement('h3'),p=document.createElement('p');h.textContent=item.title;wrap.append(h,p);
   if(!await typeText(p,item.text,token))return;
   if(actions[item.action])wrap.append(button(item.action==='tour'?'ابدأ شرح الصفحة':'افتح القسم',()=>{close();actions[item.action]();},'support-action'));
  }
  if(token===sequence)lastTopics=(data.articles||[]).map(a=>a.id);
 }finally{wrap.setAttribute('aria-busy','false');}
}
function busy(value){waiting=value;send.disabled=value;input.disabled=value;root.querySelectorAll('[data-support-topic]').forEach(b=>b.disabled=value);root.querySelector('#support-busy').classList.toggle('is-typing',value);root.querySelector('#support-busy').textContent=value?'بفهم سؤالك وبراجع دليل مرسال…':'';}
async function ask(topic){if(waiting)return;const question=input.value.trim();if(!topic&&question.length<2)return;const token=++sequence,owner=account,started=Date.now();line(topic?((suggestions.find(x=>x[0]===topic)||[])[1]||'شرح الموضوع'):question,'user');input.value='';busy(true);try{const data=await request(topic?'/api/support/topics/'+encodeURIComponent(topic):'/api/support/chat',topic?null:{question,previousTopics:lastTopics});if(token!==sequence||owner!==account)return;await pause(Math.max(0,TYPING_DELAY_MS-(Date.now()-started)));if(token!==sequence||owner!==account)return;root.querySelector('#support-busy').textContent='مساعد مرسال بيكتب الرد…';await display(data,token);}catch(e){if(token===sequence&&owner===account)line(e.name==='AbortError'?'الرد اتأخر. جرّب شرح جاهز أو اسأل تاني بعد شوية.':e.message);}finally{if(token===sequence){busy(false);if(opened)input.focus();}}}
function clear(){messages.replaceChildren();lastTopics=[];line('أهلًا! أساعدك في استخدام مرسال: السي في، الشركات، أسلوب الكتابة، الإرسال والتقارير. مش بكتب محتوى عام ومش بنفّذ إجراءات على حسابك.');}
function close(){if(!opened)return;opened=false;panel.hidden=true;for(const [el,value] of locks)el.inert=value;locks=[];if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
function open(){sync();if(!account)return;if(opened)return;window.MrsaalTour?.stop();previousFocus=document.activeElement;opened=true;panel.hidden=false;locks=[...document.body.children].filter(el=>el!==root&&!['SCRIPT','STYLE'].includes(el.tagName)).map(el=>[el,el.inert]);locks.forEach(([el])=>el.inert=true);input.focus();}
function sync(){if(!root)return;const next=user();root.hidden=!next||!document.querySelector('.app.active');if(next!==account){close();account=next;sequence++;busy(false);input.value='';clear();}if(root.hidden)close();}
function setup(){if(root)return;root=document.createElement('div');root.id='mrsaal-support';root.hidden=true;root.innerHTML='<button class="support-launch" type="button" aria-label="افتح مساعدة مرسال">؟ <span>مساعدة</span></button><div class="support-cover" hidden><section class="support-panel" role="dialog" aria-modal="true" aria-labelledby="support-title"><header><div><h2 id="support-title">مساعد مرسال</h2><small>شرح البرنامج ومساعدتك في استخدامه</small></div><button type="button" id="support-close" aria-label="إغلاق المساعدة">×</button></header><div class="support-tools"><button type="button" id="support-tour">◎ ابدأ شرح الصفحة</button><button type="button" id="support-clear">محادثة جديدة</button></div><div id="support-messages" role="log" aria-live="polite" aria-relevant="additions"></div><div id="support-topics" aria-label="شروحات جاهزة بدون استهلاك AI"></div><div id="support-busy" role="status"></div><form id="support-form"><label for="support-question">سؤالك عن مرسال</label><div><input id="support-question" maxlength="1200" autocomplete="off" placeholder="مثلًا: ليه ملف الشركات مش ظاهر؟"><button type="submit" id="support-send">اسأل</button></div><small>سؤالك يُرسل لمزوّد AI لفهمه. بلاش مفاتيح أو بيانات حساسة. الرد من دليل مرسال المعتمد.</small></form></section></div>';document.body.append(root);panel=root.querySelector('.support-cover');messages=root.querySelector('#support-messages');input=root.querySelector('#support-question');send=root.querySelector('#support-send');topics=root.querySelector('#support-topics');for(const [id,label] of suggestions){const b=button(label,()=>ask(id));b.dataset.supportTopic=id;topics.append(b);}root.querySelector('.support-launch').addEventListener('click',()=>opened?close():open());root.querySelector('#support-close').addEventListener('click',close);root.querySelector('#support-tour').addEventListener('click',()=>{close();window.MrsaalTour?.start(document.querySelector('#preview-overlay.open')?'preview':undefined);});root.querySelector('#support-clear').addEventListener('click',()=>{sequence++;busy(false);clear();});root.querySelector('#support-form').addEventListener('submit',e=>{e.preventDefault();ask();});panel.addEventListener('click',e=>{if(e.target===panel)close();});clear();sync();new MutationObserver(sync).observe(document.querySelector('.app'),{attributes:true,attributeFilter:['class']});}
document.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const f=[...panel.querySelectorAll('button,input')].filter(x=>!x.disabled),i=f.indexOf(document.activeElement);e.preventDefault();e.stopImmediatePropagation();f[(i+(e.shiftKey?-1:1)+f.length)%f.length]?.focus();}},true);
window.MrsaalSupport={open,close,sync};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
