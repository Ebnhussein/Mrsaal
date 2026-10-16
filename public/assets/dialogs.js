'use strict';
(()=>{
 const translations={
  'فصل حساب الإرسال؟ تسجيل دخولك وبيانات مرسال هيفضلوا موجودين. متابعة ردود هذا الحساب تتوقف حتى إعادة ربطه.':'Disconnect this sending account? Your sign-in and Mrsaal data stay available. Reply tracking pauses until you reconnect it.',
  'حذف مفتاح هذه المنصة واختياراتها؟':'Delete this provider key and its model selections?',
  'حفظ نص الرسالة كمرجع لأسلوبك؟ هيُستخدم كأسلوب فقط في طلبات الذكاء الاصطناعي القادمة.':'Save this message as a writing-style example? Future AI requests will use it for style only.',
  'فصل واتساب؟ هتحتاج تمسح QR من جديد عشان تربطه.':'Disconnect WhatsApp? You will need to link it again.'
 };
 let active=false;
 async function confirm(message){
  if(active)return false;active=true;
  const en=document.documentElement.lang==='en',previous=document.activeElement;
  return new Promise(resolve=>{
   const d=document.createElement('dialog');d.className='mrsaal-confirm';d.dir=en?'ltr':'rtl';d.dataset.userContent='';d.setAttribute('aria-labelledby','mrsaal-confirm-title');d.setAttribute('aria-describedby','mrsaal-confirm-message');
   const head=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button'),body=document.createElement('p'),actions=document.createElement('div'),cancel=document.createElement('button'),accept=document.createElement('button');
   title.id='mrsaal-confirm-title';title.textContent=en?'Confirm action':'تأكيد الإجراء';close.textContent='×';close.className='mrsaal-confirm-close';close.setAttribute('aria-label',en?'Close':'إغلاق');
   body.id='mrsaal-confirm-message';body.textContent=en?(translations[message]||message):message;
   cancel.textContent=en?'Cancel':'إلغاء';accept.textContent=en?'Confirm':'تأكيد';accept.className='mrsaal-confirm-accept';
   actions.className='mrsaal-confirm-actions';[close,cancel,accept].forEach(b=>b.type='button');head.append(title,close);actions.append(cancel,accept);d.append(head,body,actions);document.body.append(d);
   let finished=false;
   function finish(value){if(finished)return;finished=true;d.close();d.remove();active=false;previous?.focus({preventScroll:true});resolve(value);}
   close.onclick=cancel.onclick=()=>finish(false);accept.onclick=()=>finish(true);d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});d.addEventListener('close',()=>finish(false));
   d.showModal();cancel.focus();
  });
 }
 window.MrsaalDialog={confirm};
})();
