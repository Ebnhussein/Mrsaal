'use strict';
const APP='https://mrsaal.ebnhussein.co';
let running=false;
chrome.action.onClicked.addListener(tab=>{
 // Open synchronously in the action gesture; awaiting storage first can lose it.
 chrome.sidePanel.open({windowId:tab.windowId}).catch(console.error);
 if(tab.url?.startsWith('http')&&!tab.url.startsWith(APP+'/'))chrome.storage.session.set({sourceTabId:tab.id,sourceTitle:tab.title||tab.url});
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
  const {sourceTabId}=await chrome.storage.session.get('sourceTabId');
  if(sourceTabId)await chrome.scripting.executeScript({target:{tabId:sourceTabId},func:()=>globalThis.MrsaalExtractor?.cancel()});
  return {};
 }
 if(message.action!=='collect')throw new Error('إجراء غير معروف.');
 if(running)throw new Error('في عملية جمع شغالة بالفعل.');
 const state=await chrome.storage.session.get(['sourceTabId','account']);
 if(!state.account?.id)throw new Error('اربط حساب مرسال أولًا.');
 if(!state.sourceTabId)throw new Error('افتح صفحة النتائج واضغط أيقونة مرسال في شريط المتصفح.');
 const sourceTab=await chrome.tabs.get(state.sourceTabId);
 if(!sourceTab.url?.startsWith('http')||sourceTab.url.startsWith(APP+'/'))throw new Error('اختار صفحة الشركات أو الوظائف، ثم اضغط أيقونة مرسال عليها.');
 running=true;
 try{
  await chrome.storage.session.set({lastError:'',phase:'collecting'});
  await chrome.scripting.executeScript({target:{tabId:state.sourceTabId},files:['extractor.js']});
  const [result]=await chrome.scripting.executeScript({target:{tabId:state.sourceTabId},func:options=>globalThis.MrsaalExtractor.run(options),args:[{limit:message.limit,selector:message.selector||'',kind:message.kind,autoScroll:!!message.autoScroll}]});
  const data=result?.result;
  if(!data?.rows?.length)throw new Error(data?.warning||'لم نجد نتائج قابلة للاستيراد. جرّب جدولًا أو حدد CSS selector للكروت.');
  if(data.cancelled){await chrome.storage.session.set({phase:'stopped',lastRows:[],lastResult:null});return {stopped:true};}
  await chrome.storage.session.set({phase:'importing',lastRows:data.rows,lastSource:data.source});
  const imported=await appCall('/api/discovery/import','POST',{expectedUserId:state.account.id,rows:data.rows,source:{...data.source,query:message.query||'',country:message.country||''}});
  const summary={...imported,warning:data.warning||'',collected:data.rows.length,at:new Date().toISOString()};
  await chrome.storage.session.set({phase:'complete',lastResult:summary});return summary;
 }catch(error){
  const text=error.message.includes('Cannot access')?'اضغط أيقونة مرسال على صفحة المصدر لمنح الإضافة الوصول لهذه الصفحة فقط.':error.message;
  await chrome.storage.session.set({phase:'failed',lastError:text});throw new Error(text);
 }finally{running=false;}
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 // Collected websites cannot invoke privileged import actions.
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('panel.html'))return false;
 dispatch(message).then(data=>sendResponse({ok:true,data}),error=>sendResponse({ok:false,error:error.message}));return true;
});
