'use strict';
const APP='https://mrsaal.ebnhussein.co';
let running=null;
chrome.action.onClicked.addListener(tab=>{
 // Open synchronously in the action gesture; awaiting storage first can lose it.
 chrome.sidePanel.open({windowId:tab.windowId}).catch(console.error);
 if(!running&&tab.url?.startsWith('http')&&!tab.url.startsWith(APP+'/'))chrome.storage.session.set({sourceTabId:tab.id,sourceTitle:tab.title||tab.url});
});
async function appCall(path,method='GET',body=null){
 // Run the fetch in the Mrsaal tab. Existing same-origin session and CSRF
 // protections remain intact; no cookies, API tokens or CORS exemptions added.
 let tabs=await chrome.tabs.query({url:APP+'/*'});
 if(!tabs.length){const tab=await chrome.tabs.create({url:APP+'/app'});throw new Error('سجّل الدخول في تبويب مرسال ثم اضغط ربط الحساب. Tab '+tab.id);}
 const saved=await chrome.storage.session.get('appTabId');
 const tab=tabs.find(t=>t.id===saved.appTabId)||tabs[0];
 const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:async(origin,path,method,body)=>{
  if(location.origin!==origin)throw new Error('تبويب مرسال تغيّر.');
  const response=await fetch(origin+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Mrsaal-Request':'1'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();return {ok:response.ok,status:response.status,data};
 },args:[APP,path,method,body]});
 if(!result?.result?.ok)throw new Error(result?.result?.data?.error||'افتح مرسال وسجّل الدخول، ثم اربط الحساب من جديد.');
 await chrome.storage.session.set({appTabId:tab.id});return result.result.data;
}
async function dispatch(message){
 if(message.action==='state')return chrome.storage.session.get(null);
 if(message.action==='connect'){
  const {user}=await appCall('/api/discovery/session');
  const previous=await chrome.storage.session.get('account');
  await chrome.storage.session.set({account:user,...(previous.account?.id!==user.id?{lastRows:[],lastSource:null,lastResult:null,lastError:'',phase:'idle'}:{})});return {account:user};
 }
 if(message.action==='openApp'){await chrome.tabs.create({url:APP+'/app'});return {};}
 if(message.action==='saved')return appCall('/api/discovery/jobs');
 if(message.action==='stop'){
  const sourceTabId=running?.tabId;
  if(sourceTabId)await chrome.scripting.executeScript({target:{tabId:sourceTabId},func:()=>globalThis.MrsaalExtractor?.cancel()});
  return {};
 }
 if(message.action!=='collect')throw new Error('إجراء غير معروف.');
 if(running)throw new Error('في عملية جمع شغالة بالفعل.');
 running={id:crypto.randomUUID(),tabId:null,limit:Math.min(250,Math.max(1,Math.floor(Number(message.limit)||100))),count:0};
 try{
 const state=await chrome.storage.session.get(['sourceTabId','account']);
 if(!state.account?.id)throw new Error('اربط حساب مرسال أولًا.');
 if(!state.sourceTabId)throw new Error('افتح صفحة النتائج واضغط أيقونة مرسال في شريط المتصفح.');
 const sourceTab=await chrome.tabs.get(state.sourceTabId);
 if(!sourceTab.url?.startsWith('http')||sourceTab.url.startsWith(APP+'/'))throw new Error('اختار صفحة الشركات أو الوظائف، ثم اضغط أيقونة مرسال عليها.');
 running.tabId=state.sourceTabId;
  await chrome.storage.session.set({lastError:'',lastRows:[],lastResult:null,phase:'collecting',progress:{stage:'scanning',count:0,limit:running.limit,pass:0,elapsedMs:0,latest:[]}});
  await chrome.action.setBadgeText?.({text:'0'});
  await chrome.action.setBadgeBackgroundColor?.({color:'#196c4c'});
  await chrome.scripting.executeScript({target:{tabId:state.sourceTabId},files:['extractor.js']});
  const [result]=await chrome.scripting.executeScript({target:{tabId:state.sourceTabId},func:options=>globalThis.MrsaalExtractor.run(options),args:[{limit:running.limit,selector:message.selector||'',kind:message.kind,autoScroll:message.autoScroll!==false,runId:running.id,language:message.language==='en'?'en':'ar'}]});
  const data=result?.result;
  if(data?.cancelled){await chrome.storage.session.set({phase:'stopped',lastRows:[],lastResult:null});await chrome.action.setBadgeText?.({text:''});return {stopped:true};}
  if(!data?.rows?.length)throw new Error(data?.warning||'لم نجد نتائج قابلة للاستيراد. جرّب جدولًا أو حدد CSS selector للكروت.');
  await chrome.storage.session.set({phase:'importing',lastRows:data.rows,lastSource:data.source,progress:{stage:'importing',count:data.rows.length,limit:running.limit,pass:data.passes||0,latest:data.rows.slice(-3).map(row=>row.name||row.title)}});
  const imported=await appCall('/api/discovery/import','POST',{expectedUserId:state.account.id,rows:data.rows,source:{...data.source,query:message.query||'',country:message.country||''}});
  const summary={...imported,warning:data.warning||'',collected:data.rows.length,reason:data.reason||'',at:new Date().toISOString()};
  await chrome.storage.session.set({phase:'complete',lastResult:summary,progress:{stage:'complete',count:data.rows.length,limit:running.limit,latest:[]}});await chrome.action.setBadgeText?.({text:String(data.rows.length)});return summary;
 }catch(error){
  const text=error.message.includes('Cannot access')?'اضغط أيقونة مرسال على صفحة المصدر لمنح الإضافة الوصول لهذه الصفحة فقط.':error.message;
  await chrome.storage.session.set({phase:'failed',lastError:text});
  await chrome.action.setBadgeText?.({text:'!'});
  await chrome.action.setBadgeBackgroundColor?.({color:'#a42d2d'});throw new Error(text);
 }finally{running=null;}
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 // Content scripts can report progress only for the exact active run/tab.
 if(message.event==='collection-progress'){
  if(!running||sender.id!==chrome.runtime.id||sender.tab?.id!==running.tabId||message.runId!==running?.id)return false;
  const p=message.progress;
  if(!p||!['scanning','scrolling','waiting','complete','stopped'].includes(p.stage)||!Number.isInteger(p.count)||p.count<running.count||p.count>running.limit)return false;
  running.count=p.count;
  const progress={stage:p.stage,count:p.count,limit:running.limit,pass:Math.min(100,Math.max(0,Number(p.pass)||0)),elapsedMs:Math.min(180000,Math.max(0,Number(p.elapsedMs)||0)),latest:Array.isArray(p.latest)?p.latest.slice(0,3).filter(s=>typeof s==='string').map(s=>s.slice(0,200)):[]};
  chrome.storage.session.set({progress}).then(()=>chrome.action.setBadgeText?.({text:String(progress.count)})).then(()=>sendResponse({ok:true}),()=>sendResponse({ok:false}));return true;
 }
 // Collected websites cannot invoke privileged import actions.
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('panel.html'))return false;
 dispatch(message).then(data=>sendResponse({ok:true,data}),error=>sendResponse({ok:false,error:error.message}));return true;
});
