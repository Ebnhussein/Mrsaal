'use strict';
window.MrsaalCVSummary=(()=>{
 let revision=0;
 const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 function node(tag,text,cls){const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
 async function render(cv){
  const stamp=++revision,versions=document.getElementById('cv-versions');if(!versions)return;
  let host=document.getElementById('cv-ai-summary');if(!host){host=node('section',null,'cv-summary');host.id='cv-ai-summary';versions.before(host);}host.replaceChildren();host.hidden=!cv;if(!cv)return;
  host.dataset.userContent='';const storage=node('p',null,'hint');api('/api/launch/resources').then(r=>{if(stamp===revision)storage.textContent=tr('مساحة ملفاتك: ','Your file storage: ')+(r.used.storageBytes/1048576).toFixed(1)+' / '+Math.round(r.limits.storageBytes/1048576)+' MB';}).catch(()=>{});host.append(storage);host.append(node('h3',tr('ملخص السيرة للكتابة الأسرع','CV summary for faster writing')),node('p',tr('للسير الطويلة، اعتماد الملخص مطلوب لذكاء مرسال المحلي بدل انتظار طلب طويل. راجعه الأول؛ ملف PDF الأصلي يفضل هو المرفق.','For longer CVs, local Mrsaal AI requires an approved summary to avoid slow full-text requests. Review it first; your original PDF remains the attachment.'),'hint'));
  const status=node('p',tr('جاري تحميل الملخص…','Loading summary…'),'hint');status.setAttribute('role','status');host.append(status);
  try{
   const data=await api('/api/cv/summary?cvId='+encodeURIComponent(cv.id));if(stamp!==revision)return;
   status.textContent=data.approved?tr('ملخص معتمد لهذه النسخة.','Approved summary for this version.'):tr('ده اقتراح مقتبس من نص سيرتك، مش تحليل AI. راجعه وزوّد أي خبرة أو مهارة ناقصة قبل الاعتماد.','This candidate is extracted from your CV, not AI analysis. Review it and add any missing experience or skills before approving.');
   const label=node('label',tr('الحقائق اللي تحب تظهر في رسائلك','Facts to include in your messages'));label.htmlFor='cv-summary-text';
   const text=node('textarea',null,'textarea');text.id='cv-summary-text';text.rows=7;text.maxLength=data.maxChars;text.value=data.text;text.dir='auto';text.setAttribute('aria-describedby','cv-summary-counter');
   const counter=node('p',null,'hint');counter.id='cv-summary-counter';
   const confirm=node('input');confirm.type='checkbox';confirm.id='cv-summary-confirm';const check=node('label',null,'cv-summary-confirm');check.htmlFor=confirm.id;check.append(confirm,document.createTextNode(tr('راجعت الملخص وبتأكد إنه بيعبر عن سيرتي من غير معلومات مضافة.','I reviewed this summary and confirm it matches my CV without invented facts.')));
   const actions=node('div',null,'cv-summary-actions');const save=node('button',tr('اعتمد الملخص','Approve summary'),'btn btn-primary');save.type='button';const reset=node('button',tr('استخدم النص الكامل','Use full CV text'),'btn btn-secondary');reset.type='button';reset.hidden=!data.approved;actions.append(save,reset);
   function update(){counter.textContent=text.value.length+' / '+data.maxChars+' '+tr('حرف','characters');save.disabled=!confirm.checked||text.value.trim().length<30;}
   text.oninput=()=>{confirm.checked=false;status.textContent=data.approved?tr('تعديل غير محفوظ؛ الملخص المعتمد سابقًا يفضل مستخدمًا لحد ما تعتمد التعديل.','Unsaved change; the previous approved summary remains in use until you approve this edit.'):tr('تعديل غير محفوظ. راجعه واعتمده عشان نستخدمه للكتابة.','Unsaved change. Review and approve it to use it for writing.');update();};confirm.onchange=update;update();
   save.onclick=async()=>{save.disabled=true;reset.disabled=true;status.textContent=tr('جاري الحفظ…','Saving…');try{await api('/api/cv/summary','POST',{cvId:cv.id,sourceHash:data.sourceHash,text:text.value,approved:confirm.checked});if(stamp!==revision)return;await render(cv);toast(tr('تم اعتماد الملخص؛ جرّب كتابة المسودة.','Summary approved. Try generating a draft.'),'success');}catch(e){if(stamp!==revision)return;status.textContent=e.message;reset.disabled=false;update();}};
   reset.onclick=async()=>{reset.disabled=true;save.disabled=true;try{await api('/api/cv/summary/reset','POST',{cvId:cv.id});if(stamp!==revision)return;await render(cv);}catch(e){status.textContent=e.message;reset.disabled=false;update();}};
   host.append(label,text,counter,check,actions);
  }catch(e){if(stamp!==revision)return;status.textContent=e.message;const retry=node('button',tr('إعادة المحاولة','Retry'),'btn btn-secondary');retry.type='button';retry.onclick=()=>render(cv);host.append(retry);}
 }
 return {render};
})();
