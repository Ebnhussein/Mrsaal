'use strict';
const APP='https://mrsaal.ebnhussein.co';
let running=null,launching=false;
function source(tab){return tab?.url?.startsWith('http')&&new URL(tab.url).origin!==APP;}
async function selectSource(tab){if(!running&&source(tab))await chrome.storage.session.set({sourceTabId:tab.id,sourceTitle:tab.title||tab.url,sourceUrl:tab.url});}
chrome.action.onClicked.addListener(tab=>{chrome.sidePanel.open({windowId:tab.windowId}).catch(console.error);selectSource(tab).catch(console.error);});
chrome.tabs.onActivated?.addListener(info=>chrome.tabs.get(info.tabId).then(selectSource).catch(()=>{}));
chrome.tabs.onUpdated?.addListener((id,change,tab)=>{
 if(tab.active)selectSource(tab).catch(()=>{});
 if(change.status==='complete')resumeSearch(id).catch(error=>chrome.storage.session.set({phase:'failed',lastError:error.message}));
});
async function appCall(path,method='GET',body=null,preferredTabId=null){
 const tabs=await chrome.tabs.query({url:APP+'/*'});
 if(!tabs.length){await chrome.tabs.create({url:APP+'/app'});throw new Error('افتح تبويب مرسال واربط الحساب أولًا.');}
 const saved=await chrome.storage.session.get('appTabId'),tab=preferredTabId?tabs.find(t=>t.id===preferredTabId):tabs.find(t=>t.id===saved.appTabId)||tabs[0];
 if(!tab)throw new Error('تبويب مرسال تغيّر. ارجع للموقع وابدأ مرة أخرى.');
 const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:async(origin,path,method,body)=>{
  if(location.origin!==origin)throw new Error('تبويب مرسال تغيّر.');
  const response=await fetch(origin+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Mrsaal-Request':'1'},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch{data={error:'خدمة Mrsaal Scraper غير متاحة على السيرفر. انشر تحديث السيرفر أولًا.'};}return {ok:response.ok,status:response.status,data};
 },args:[APP,path,method,body]});
 if(!result?.result?.ok)throw new Error(result?.result?.data?.error||'تعذر الاتصال بمرسال. افتح الموقع المرتبط بالإضافة وحدّثه.');
 await chrome.storage.session.set({appTabId:tab.id});return result.result.data;
}
async function persist(pending){
 if(pending.origin!==APP)throw new Error('الدفعة المعلقة تخص بيئة أخرى.');
 const {account}=await chrome.storage.session.get('account');
 if(account?.id!==pending.expectedUserId)throw new Error('اربط نفس الحساب صاحب الدفعة قبل تأكيد الحفظ.');
 await chrome.storage.session.set({phase:'importing',lastError:'',lastRows:pending.rows,lastSource:pending.source});
 const imported=await appCall('/api/discovery/import','POST',pending);
 if(!imported.receiptId)throw new Error('حدّث سيرفر مرسال؛ نسخة السيرفر لا تدعم تأكيد الحفظ.');
 pending.receiptId=imported.receiptId;await chrome.storage.local.set({pendingImport:pending});
 await chrome.storage.session.set({phase:'verifying'});
 const proof=await appCall('/api/discovery/imports/'+encodeURIComponent(imported.receiptId));
 if(!proof.verified||proof.receipt?.id!==imported.receiptId)throw new Error('لم يكتمل تأكيد قراءة الدفعة من قاعدة البيانات.');
 const summary={...proof.receipt.result,confirmed:true,collected:pending.rows.length,warning:pending.warning||'',at:proof.receipt.created_at};
 await chrome.storage.session.set({phase:'complete',lastResult:summary,lastError:'',progress:{stage:'complete',count:pending.rows.length,limit:pending.limit||pending.rows.length,latest:[]}});
 await chrome.storage.local.remove('pendingImport');await chrome.action.setBadgeText?.({text:String(pending.rows.length)});return summary;
}
async function resumeSearch(tabId){
 const {pendingSearch}=await chrome.storage.session.get('pendingSearch');
 if(!pendingSearch||pendingSearch.tabId!==tabId||running)return;
 await chrome.storage.session.set({pendingSearch:null});
 return dispatch({action:'collect',sourceTabId:tabId,...pendingSearch.options,expectedAccountId:pendingSearch.accountId});
}
async function collectDetails(){
 if(running)throw new Error('انتظر الدفعة الحالية.');
 running={id:crypto.randomUUID(),tabId:null,limit:10,count:0};
 try{
  if((await chrome.storage.local.get('pendingImport')).pendingImport)throw new Error('أكّد حفظ الدفعة المعلقة أولًا.');
  const state=await chrome.storage.session.get(null),links=(state.lastRows||[]).filter(r=>r.kind==='job'&&r.entryType==='link_only').slice(0,10),rows=[];
  if(!state.account||!links.length)throw new Error('اجمع روابط الوظائف أولًا.');
  running.limit=links.length;await chrome.storage.session.set({phase:'collecting',lastError:'',progress:{stage:'scanning',count:0,limit:links.length,latest:[]}});
  for(const link of links){
   if(running.cancelled)break;
   let tab;
   try{
    const origin=new URL(link.jobUrl).origin;
    if(!await chrome.permissions.contains({origins:[origin+'/*']}))continue;
    tab=await chrome.tabs.create({url:link.jobUrl,active:false});running.tabId=tab.id;
    const deadline=Date.now()+12000;
    while(tab.status!=='complete'&&Date.now()<deadline&&!running.cancelled){await new Promise(resolve=>setTimeout(resolve,300));tab=await chrome.tabs.get(tab.id);}
    if(running.cancelled||tab.status!=='complete')continue;
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['extractor.js']});
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.MrsaalExtractor.blocked(document)?{rows:[]} :globalThis.MrsaalExtractor.extract(document,location.href)});
    const candidates=(result?.result?.rows||[]).filter(r=>r.kind==='job'&&r.entryType!=='link_only');
    const detail=candidates.find(r=>{try{return new URL(r.jobUrl).pathname===new URL(tab.url).pathname;}catch{return false;}})||(candidates.length===1?candidates[0]:null);
    if(detail)rows.push({...detail,jobUrl:link.jobUrl,entryType:'details'});
   }catch{}finally{if(tab){try{if(!(await chrome.tabs.get(tab.id)).active)await chrome.tabs.remove(tab.id);}catch{}}}
   await chrome.storage.session.set({progress:{stage:'scanning',count:rows.length,limit:links.length,latest:[link.title]}});
  }
  if(running.cancelled){await chrome.storage.session.set({phase:'stopped'});return {stopped:true};}
  if(!rows.length)throw new Error('لم نستخرج تفاصيل مؤكدة؛ روابط البحث ما زالت محفوظة. قد يتطلب الموقع دخولًا أو تنسيقًا خاصًا.');
  const pending={origin:APP,requestKey:running.id,expectedUserId:state.account.id,rows,source:{...state.lastSource,adapter:'job-page'},limit:links.length};
  await chrome.storage.local.set({pendingImport:pending});return await persist(pending);
 }catch(error){await chrome.storage.session.set({phase:(await chrome.storage.local.get('pendingImport')).pendingImport?'save-pending':'failed',lastError:error.message});throw error;}finally{running=null;}
}
async function dispatch(message){
 if(message.action==='state'){
  const state=await chrome.storage.session.get(null),{pendingImport}=await chrome.storage.local.get('pendingImport');
  return {...state,appOrigin:APP,hasPendingImport:!!pendingImport};
 }
 if(message.action==='connect'){
  const {user}=await appCall('/api/discovery/session'),previous=await chrome.storage.session.get('account');
  await chrome.storage.session.set({account:user,...(previous.account?.id!==user.id?{lastRows:[],lastSource:null,lastResult:null,lastError:'',phase:'idle'}:{})});return {account:user};
 }
 if(message.action==='openApp'){await chrome.tabs.create({url:APP+'/app'});return {};}
 if(message.action==='saved')return appCall('/api/discovery/jobs');
 if(message.action==='details')return collectDetails();
 if(message.action==='retryImport'){
  if(running)throw new Error('انتظر العملية الحالية.');
  const {pendingImport}=await chrome.storage.local.get('pendingImport');if(!pendingImport)throw new Error('لا توجد دفعة معلقة.');
  running={id:pendingImport.requestKey,tabId:null};
  try{return await persist(pendingImport);}catch(error){await chrome.storage.session.set({phase:'save-pending',lastError:error.message});throw error;}finally{running=null;}
 }
 if(message.action==='search'){
  const url=new URL(message.url);if(url.origin!=='https://www.google.com'||!(url.pathname==='/search'||url.pathname.startsWith('/maps/search/')))throw new Error('رابط بحث غير صحيح.');
  const {account}=await chrome.storage.session.get('account');if(!account)throw new Error('اربط حسابك قبل البحث والجمع التلقائي.');
  if(running||(await chrome.storage.session.get('pendingSearch')).pendingSearch)throw new Error('انتظر الدفعة الحالية.');
  const {pendingImport}=await chrome.storage.local.get('pendingImport');if(pendingImport)throw new Error('أكّد حفظ الدفعة المعلقة أولًا.');
  const tab=await chrome.tabs.create({url:url.href});
  await chrome.storage.session.set({sourceTabId:tab.id,sourceTitle:url.pathname.startsWith('/maps/')?'نتائج الشركات على Maps':'نتائج البحث عن وظائف',sourceUrl:url.href,phase:'opening',searchOptions:{...message.options,id:crypto.randomUUID()},pendingSearch:{tabId:tab.id,accountId:account.id,options:message.options||{}}});
  if((await chrome.tabs.get(tab.id)).status==='complete')await resumeSearch(tab.id);
  return {opening:true};
 }
 if(message.action==='stop'){
  await chrome.storage.session.set({pendingSearch:null});
  if(running)running.cancelled=true;
  if(running?.tabId)await chrome.scripting.executeScript({target:{tabId:running.tabId},func:()=>globalThis.MrsaalExtractor?.cancel()});
  else if(!running)await chrome.storage.session.set({phase:'stopped'});return {};
 }
 if(message.action!=='collect')throw new Error('إجراء غير معروف.');
 if(running)throw new Error('في عملية جمع شغالة بالفعل.');
 running={id:crypto.randomUUID(),tabId:null,limit:Math.min(250,Math.max(1,Math.floor(Number(message.limit)||100))),count:0};
 try{
  if((await chrome.storage.local.get('pendingImport')).pendingImport)throw new Error('أكّد حفظ الدفعة المعلقة قبل جمع دفعة جديدة.');
  const state=await chrome.storage.session.get(['sourceTabId','account']);
  if(!state.account?.id)throw new Error('اربط حساب مرسال أولًا.');
  if(message.expectedAccountId&&message.expectedAccountId!==state.account.id)throw new Error('الحساب تغيّر أثناء فتح البحث.');
  const tabId=message.sourceTabId||state.sourceTabId;if(!tabId)throw new Error('اختار صفحة النتائج أولًا.');
  const tab=await chrome.tabs.get(tabId);if(!source(tab))throw new Error('اختار صفحة الشركات أو الوظائف.');
  running.tabId=tabId;
  await chrome.storage.session.set({sourceTabId:tabId,sourceUrl:tab.url,sourceTitle:tab.title||tab.url,lastError:'',lastRows:[],lastResult:null,phase:'collecting',progress:{stage:'scanning',count:0,limit:running.limit,latest:[]}});
  await chrome.action.setBadgeText?.({text:'0'});await chrome.action.setBadgeBackgroundColor?.({color:'#196c4c'});
  await chrome.scripting.executeScript({target:{tabId},files:['extractor.js']});
  const [result]=await chrome.scripting.executeScript({target:{tabId},func:options=>globalThis.MrsaalExtractor.run(options),args:[{limit:running.limit,selector:message.selector||'',kind:message.kind,autoScroll:message.autoScroll!==false,runId:running.id,language:message.language==='en'?'en':'ar'}]});
  const data=result?.result;
  if(data?.cancelled){await chrome.storage.session.set({phase:'stopped',lastRows:[],lastResult:null});await chrome.action.setBadgeText?.({text:''});return {stopped:true};}
  if(!data?.rows?.length)throw new Error(data?.warning||'لم نجد نتائج قابلة للجمع في هذه الصفحة. جرّب صفحة إعلان أو حدد الكروت يدويًا.');
  const pending={origin:APP,requestKey:running.id,expectedUserId:state.account.id,rows:data.rows,source:{...data.source,query:message.query||'',country:message.country||''},warning:data.warning||'',limit:running.limit};
  await chrome.storage.local.set({pendingImport:pending});
  return await persist(pending);
 }catch(error){
  const hasPending=!!(await chrome.storage.local.get('pendingImport')).pendingImport;
  const text=error.message.includes('Cannot access')?'اسمح للإضافة بقراءة هذا الموقع من زر الجمع. قد يطلب Chrome السماح مرة واحدة.':error.message;
  await chrome.storage.session.set({phase:hasPending?'save-pending':'failed',lastError:text});await chrome.action.setBadgeText?.({text:'!'});throw new Error(text);
 }finally{running=null;}
}
function appSender(sender){
 try{const u=new URL(sender.url);return sender.id===chrome.runtime.id&&sender.frameId===0&&sender.tab?.id&&u.origin===APP&&u.pathname==='/app';}catch{return false;}
}
function launchOptions(input){
 const countries={EG:'Egypt',SA:'Saudi Arabia',AE:'United Arab Emirates',KW:'Kuwait',QA:'Qatar',BH:'Bahrain',OM:'Oman'};
 if(!input||!['maps','jobs'].includes(input.mode)||!countries[input.country]||!['','remote','hybrid','onsite'].includes(input.workMode||''))throw new Error('راجع إعدادات البحث.');
 if(typeof input.query!=='string'||!input.query.trim()||input.query.length>200||typeof input.expectedAccountId!=='string'||input.expectedAccountId.length>200)throw new Error('راجع إعدادات البحث والحساب.');
 const city=typeof input.city==='string'?input.city.trim().slice(0,100):'',query=input.query.trim();
 const options={query,country:input.country,city,workMode:input.workMode||'',limit:Math.min(250,Math.max(1,Math.floor(Number(input.limit)||100))),autoScroll:input.autoScroll!==false,language:input.language==='en'?'en':'ar'};
 const terms=[query,countries[input.country],city,...(input.mode==='jobs'?['jobs',options.workMode]:[])].filter(Boolean).join(' ');
 return {options,url:input.mode==='maps'?'https://www.google.com/maps/search/'+encodeURIComponent(terms):'https://www.google.com/search?q='+encodeURIComponent(terms),expectedAccountId:input.expectedAccountId};
}
async function launchFromApp(input,tabId,permission,panel){
 try{
  if(!await permission)throw new Error('السماح بقراءة Google مطلوب لبدء الجمع التلقائي.');
  if((await chrome.storage.local.get('pendingImport')).pendingImport)throw new Error('أكّد حفظ الدفعة المعلقة أولًا من الإضافة.');
  if(running||(await chrome.storage.session.get('pendingSearch')).pendingSearch)throw new Error('انتظر الدفعة الحالية.');
  const {user}=await appCall('/api/discovery/session','GET',null,tabId);
  if(user?.id!==input.expectedAccountId)throw new Error('الحساب تغيّر. حدّث صفحة مرسال قبل البدء.');
  await chrome.storage.session.set({account:user,appTabId:tabId});
  const result=await dispatch({action:'search',url:input.url,options:input.options});
  return {...result,panelOpened:await panel};
 }finally{launching=false;}
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message.action==='appState'||message.action==='launchFromApp'){
  if(!appSender(sender))return false;
  if(message.action==='appState'){
   chrome.storage.session.get(null).then(state=>{
    const same=state.account?.id===message.expectedAccountId;
    sendResponse({ok:true,data:{version:chrome.runtime.getManifest().version,phase:same?state.phase:'idle',count:same?state.progress?.count||0:0,limit:same?state.progress?.limit||100:100,error:same?state.lastError||'':''}});
   },()=>sendResponse({ok:false}));return true;
  }
  let input;try{input=launchOptions(message);if(launching||running)throw new Error('انتظر الدفعة الحالية.');}catch(error){sendResponse({ok:false,error:error.message});return false;}
  launching=true;
  // Both gesture-gated calls start synchronously in the trusted content-click message.
  let panel,permission;
  try{panel=chrome.sidePanel.open({windowId:sender.tab.windowId}).then(()=>true,()=>false);}catch{panel=Promise.resolve(false);}
  try{permission=chrome.permissions.request({origins:['https://www.google.com/*']});}catch(error){launching=false;sendResponse({ok:false,error:error.message});return false;}
  launchFromApp(input,sender.tab.id,permission,panel).then(data=>sendResponse({ok:true,data}),error=>sendResponse({ok:false,error:error.message}));return true;
 }

 if(message.event==='collection-progress'){
  if(!running||sender.id!==chrome.runtime.id||sender.tab?.id!==running.tabId||message.runId!==running.id)return false;
  const p=message.progress;if(!p||!['scanning','scrolling','waiting','complete','stopped'].includes(p.stage)||!Number.isInteger(p.count)||p.count<running.count||p.count>running.limit)return false;
  running.count=p.count;const progress={stage:p.stage,count:p.count,limit:running.limit,latest:Array.isArray(p.latest)?p.latest.slice(0,3).filter(s=>typeof s==='string').map(s=>s.slice(0,200)):[]};
  chrome.storage.session.set({progress}).then(()=>chrome.action.setBadgeText?.({text:String(p.count)})).then(()=>sendResponse({ok:true}),()=>sendResponse({ok:false}));return true;
 }
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('panel.html'))return false;
 dispatch(message).then(data=>sendResponse({ok:true,data}),error=>sendResponse({ok:false,error:error.message}));return true;
});
