'use strict';
(()=>{
 const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 let options=null,optionsUntil=0,selected='baileys',method='qr',canDisconnect=false,canCancel=false,busy=false,lastState={status:'disconnected'},root,notice,code,steps;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 async function request(path,body){const r=await fetch('/api/whatsapp/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Mrsaal-WA':'1'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw window.MrsaalErrors?window.MrsaalErrors.from(data,r.status):Object.assign(new Error(data.error),{code:data.code});return data;}
 function safeText(text){return String(text||'').replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/ig,tr('معرّف داخلي مخفي','Internal ID hidden'));}
 let pairingError=null,pairingDialog,dialogTitle,dialogStatus,dialogQR,dialogCode,dialogHint,dialogCancel;
 function ensurePairingDialog(){
  if(pairingDialog)return;
  pairingDialog=node('dialog',null,'mrsaalwa-dialog');pairingDialog.id='wa-pairing-dialog';pairingDialog.setAttribute('aria-labelledby','wa-pairing-title');
  const header=node('header');dialogTitle=node('h2');dialogTitle.id='wa-pairing-title';const close=node('button','×','mrsaalwa-dialog-close');close.type='button';close.setAttribute('aria-label',tr('إغلاق','Close'));close.onclick=()=>pairingDialog.close();header.append(dialogTitle,close);
  dialogStatus=node('p',null,'mrsaalwa-dialog-status');dialogStatus.setAttribute('role','status');dialogStatus.setAttribute('aria-live','polite');dialogQR=node('img');dialogQR.alt=tr('رمز ربط واتساب','WhatsApp pairing QR');dialogQR.hidden=true;
  dialogCode=node('output',null,'mrsaalwa-code');dialogCode.dir='ltr';dialogCode.hidden=true;
  dialogHint=node('p',null,'mrsaalwa-dialog-hint');dialogCancel=node('button',tr('إلغاء محاولة الربط','Cancel linking attempt'),'btn btn-secondary');dialogCancel.type='button';dialogCancel.onclick=()=>{pairingDialog.close();disconnect(true);};
  pairingDialog.append(header,dialogStatus,dialogQR,dialogCode,dialogHint,dialogCancel);document.body.append(pairingDialog);
 }
 function openPairingDialog(){pairingError=null;ensurePairingDialog();pairingDialog.dir=document.documentElement.lang==='en'?'ltr':'rtl';if(!pairingDialog.open)pairingDialog.showModal();paintPairing(lastState);}
 function paintPairing(state){
  if(!pairingDialog?.open)return;
  if(pairingError&&state.status!=='connected'){dialogStatus.textContent=pairingError;dialogStatus.dataset.loading='false';dialogCancel.disabled=busy||!canCancel;return;}
  const connected=state.status==='connected',connecting=state.status==='connecting',phoneMode=selected==='mrsaalwa'&&method==='phone';
  dialogTitle.textContent=connected?tr('واتساب متصل','WhatsApp connected'):phoneMode?tr('الربط بكود الموبايل','Link with phone number'):tr('ربط واتساب بالـQR','Connect WhatsApp with QR');
  const waiting=busy||connecting||(!state.qr&&!code?.textContent&&!connected);
  dialogStatus.dataset.loading=String(waiting);
  dialogStatus.textContent=connected?tr('تم الربط. تقدر تبدأ الإرسال.','Connected. You can start sending.'):connecting?tr('جاري الاتصال… بنكمل مزامنة واتساب.','Connecting… Finishing WhatsApp setup.'):phoneMode&&code?.textContent?tr('اكتب الكود ده في واتساب على موبايلك.','Enter this code in WhatsApp on your phone.'):state.qr?tr('امسح الرمز من الأجهزة المرتبطة في واتساب.','Scan this QR from Linked devices in WhatsApp.'):tr('جاري تجهيز الربط…','Preparing connection…');
  dialogQR.hidden=connected||connecting||phoneMode||!state.qr;if(!dialogQR.hidden)dialogQR.src=state.qr;else dialogQR.removeAttribute('src');
  dialogCode.hidden=connected||connecting||!phoneMode||!code?.textContent;dialogCode.textContent=dialogCode.hidden?'':code.textContent;
  dialogHint.textContent=connected?tr('تقدر تقفل النافذة وتكمل شغلك.','Close this window and continue your work.'):tr('واتساب ← الأجهزة المرتبطة ← ربط جهاز. الحالة بتتحدّث تلقائيًا. إغلاق النافذة لا يلغي المحاولة.','WhatsApp → Linked devices → Link a device. Status updates automatically. Closing this window keeps the attempt active.');
  dialogCancel.hidden=connected;dialogCancel.disabled=busy||!canCancel;
 }
 function statusMessage(text,kind='info'){notice.dataset.kind=kind;notice.hidden=!text;notice.replaceChildren(...(text?[node('span',safeText(text))]:[]));}
 function error(e){
  if(['REAUTH_REQUIRED','ADMIN_GOOGLE_REQUIRED'].includes(e.code)){
   pairingDialog?.close();statusMessage('','identity');
   const verify=()=>window.MrsaalDialog.identity({onContinue:()=>{try{sessionStorage.setItem('mrsaal-wa-return',method);}catch{}}});
   void verify();
  }else {statusMessage(e.message,'error');if(pairingDialog?.open){pairingError=safeText(e.message);dialogStatus.textContent=pairingError;dialogStatus.dataset.loading='false';}}
 }
 function guidance(state=lastState){
  lastState=state;if(!steps)return;
  const connected=state.status==='connected',phoneMode=selected==='mrsaalwa'&&method==='phone';
  const lines=phoneMode?[
   tr('اكتب رقم واتساب بكود الدولة، ثم اضغط «إظهار كود الربط».','Enter your WhatsApp number with country code, then press “Show pairing code”.'),
   tr('من واتساب على موبايلك: الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف.','On your phone: WhatsApp → Linked devices → Link a device → Link with phone number.'),
   tr('اكتب كود الربط اللي هيظهر هنا داخل واتساب. هنحدّث الحالة تلقائيًا.','Enter the pairing code shown here into WhatsApp. The connection status updates automatically.')
  ]:[
   tr('اضغط «إظهار QR» واستنى رمز الربط يظهر.','Press “Show QR” and wait for the pairing image.'),
   tr('من واتساب على موبايلك: الأجهزة المرتبطة ← ربط جهاز.','On your phone: WhatsApp → Linked devices → Link a device.'),
   tr('وجّه كاميرا واتساب للرمز هنا. هنأكد الاتصال تلقائيًا بعد اكتمال الربط.','Point the WhatsApp camera at the QR shown here. We will confirm the connection automatically.')
  ];
  document.getElementById('wa-provider').disabled=busy;document.getElementById('mrsaalwa-pairing')?.querySelectorAll('button').forEach(b=>b.disabled=busy||connected);
  steps.hidden=connected;steps.replaceChildren(...lines.map(text=>node('li',text)));
  const button=document.getElementById('wa-connect');button.disabled=busy||connected;button.textContent=connected?tr('واتساب متصل','WhatsApp connected'):busy?tr('جاري تجهيز الربط…','Preparing connection…'):phoneMode?tr('إظهار كود الربط','Show pairing code'):tr('إظهار QR','Show QR');
 }
 function progress(state){
  if(['identity','validation'].includes(notice.dataset.kind)||(notice.dataset.kind==='error'&&state.status!=='connected'))return;
  if(state.status==='connected')statusMessage(tr('واتساب جاهز. تقدر ترسل الرسائل والمرفقات وتتابع الردود من التقارير.','WhatsApp is ready. Send messages and attachments, and follow replies in Reports.'),'success');
  else if(method==='phone'&&code?.textContent)statusMessage(tr('كود الربط جاهز. اكتبه في واتساب على موبايلك لإكمال الاتصال.','Your pairing code is ready. Enter it in WhatsApp on your phone to finish connecting.'));
  else if(state.status==='qr'&&method==='phone')statusMessage(tr('اضغط «إظهار كود الربط» واتبعه من واتساب على موبايلك.','Press “Show pairing code”, then continue in WhatsApp on your phone.'));
  else if(state.status==='qr')statusMessage(tr('رمز الربط جاهز. امسحه من «الأجهزة المرتبطة» في واتساب على موبايلك.','Your QR is ready. Scan it from Linked devices in WhatsApp on your phone.'));
  else if(state.status==='connecting')statusMessage(tr('بنكمل الاتصال بواتساب. سيب الصفحة مفتوحة؛ الحالة بتتحدّث تلقائيًا.','Connecting to WhatsApp. Keep this page open; the status updates automatically.'));
  else if(!busy&&code?.textContent)statusMessage(tr('كود الربط جاهز. اكتبه في واتساب على موبايلك لإكمال الاتصال.','Your pairing code is ready. Enter it in WhatsApp on your phone to finish connecting.'));
  else if(!busy)statusMessage(tr('اختار طريقة الربط واتبع الخطوات اللي تحت.','Choose a connection method and follow the steps below.'));
 }
 const normalisePhone=value=>String(value||'').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).trim().replace(/^\+/,'').replace(/[\s()-]/g,'');
 function fieldError(id,message){const field=document.getElementById(id),hint=document.getElementById(id+'-error');field.setAttribute('aria-invalid',String(!!message));hint.textContent=message;hint.hidden=!message;if(id==='mrsaalwa-pair-ack')field.parentElement.dataset.invalid=String(!!message);}
 function validatePhone(focus=false){
  const field=document.getElementById('mrsaalwa-phone'),ack=document.getElementById('mrsaalwa-pair-ack'),value=normalisePhone(field.value);
  const phoneError=!value?tr('اكتب رقم واتساب اللي عايز تربطه.','Enter the WhatsApp number you want to connect.'):!/^[1-9]\d{7,14}$/.test(value)?tr('اكتب الرقم بكود الدولة، مثل +201012345678. ما تبدأش بصفر محلي.','Include the country code, for example +201012345678. Do not start with a local zero.'):'';
  const ackError=ack.checked?'':tr('علّم على مربع الموافقة بعد قراءة تنبيه الربط بالكود.','Tick the checkbox after reading the phone-pairing warning.');
  fieldError(field.id,phoneError);fieldError(ack.id,ackError);
  const first=phoneError?field:ackError?ack:null;
  if(first&&focus){statusMessage('','validation');first.focus();first.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}
  else if(!first&&notice.dataset.kind==='validation')statusMessage('');
  return !first;
 }
 function init(){if(root)return;const host=document.getElementById('wa-status')?.parentElement;if(!host)return;
  root=node('div',null,'mrsaalwa-options');root.dataset.userContent='';
  const label=node('label',tr('طريقة ربط واتساب','WhatsApp connection method'),'label');const select=node('select',null,'select');select.id='wa-provider';label.htmlFor=select.id;
  select.append(new Option(tr('Baileys · الطريقة البديلة','Baileys · Alternative connection'),'baileys'),new Option('MrsaalWA · '+tr('موصى به · تجريبي','Recommended · Beta'),'mrsaalwa'));root.append(label,select);
  notice=node('div',null,'mrsaalwa-notice');notice.setAttribute('role','status');root.append(notice);steps=node('ol',null,'mrsaalwa-steps');root.append(steps);
  const beta=node('div');beta.id='mrsaalwa-pairing';beta.hidden=true;
  beta.append(node('p',tr('اربط حسابك لإرسال الرسائل والـCV، وتابع وصول الرسائل والردود من التقارير.','Connect your account to send messages and your CV, then track delivery and replies in Reports.'),'hint'));
  const methods=node('div',null,'row'),qr=node('button','QR Code','btn btn-secondary'),phoneButton=node('button',tr('كود برقم الموبايل','Link with phone number'),'btn btn-secondary');qr.type=phoneButton.type='button';
  const phoneBox=node('div');phoneBox.id='mrsaalwa-phone-box';phoneBox.hidden=true;const phoneLabel=node('label',tr('رقم واتساب اللي هتربطه — بكود الدولة','Your WhatsApp number — include country code'),'label'),phone=node('input',null,'input');phone.id='mrsaalwa-phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel';phone.dir='ltr';phone.placeholder='201012345678';phoneLabel.htmlFor=phone.id;phone.setAttribute('aria-describedby','mrsaalwa-phone-error');const phoneError=node('p',null,'mrsaalwa-field-error');phoneError.id=phone.id+'-error';phoneError.hidden=true;phoneError.setAttribute('role','alert');
  const ackLabel=node('label',null,'mrsaalwa-ack'),ack=node('input');ack.type='checkbox';ack.id='mrsaalwa-pair-ack';ack.setAttribute('aria-describedby','mrsaalwa-pair-ack-error');const ackError=node('p',null,'mrsaalwa-field-error');ackError.id=ack.id+'-error';ackError.hidden=true;ackError.setAttribute('role','alert');ackLabel.append(ack,node('span',tr('فاهم إن طلب كود ممكن يفصل جلسة مرتبطة لنفس الرقم. لو عايز تحافظ عليها استخدم QR.','I understand requesting a code may unlink an existing linked session for this number. Use QR to preserve it.')));
  phone.oninput=()=>{if(notice.dataset.kind==='validation'||!phoneError.hidden)validatePhone();};ack.onchange=()=>{if(notice.dataset.kind==='validation'||!ackError.hidden)validatePhone();};
  phoneBox.append(phoneLabel,phone,phoneError,ackLabel,ackError,node('p',tr('من واتساب: الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف، واكتب الكود اللي هيظهر هنا.','In WhatsApp: Linked devices → Link a device → Link with phone number, then enter the code shown here.'),'hint'));
  code=node('output',null,'mrsaalwa-code');code.setAttribute('aria-label',tr('كود ربط واتساب المؤقت — مش معرّف الجلسة','Temporary WhatsApp pairing code — not a session ID'));code.hidden=true;code.setAttribute('aria-live','polite');code.dir='ltr';
  function choose(value){method=value;fieldError(phone.id,'');fieldError(ack.id,'');if(notice.dataset.kind==='validation')statusMessage('');phoneBox.hidden=value!=='phone';qr.setAttribute('aria-pressed',String(value==='qr'));phoneButton.setAttribute('aria-pressed',String(value==='phone'));code.hidden=true;code.textContent='';if(value==='phone')document.getElementById('wa-qr').style.display='none';guidance();}
  qr.onclick=()=>choose('qr');phoneButton.onclick=()=>choose('phone');methods.append(qr,phoneButton);beta.append(methods,phoneBox,code);root.append(beta);
  const help=node('button',tr('بلّغ عن مشكلة في الربط','Report a connection issue'),'btn btn-secondary');help.type='button';help.onclick=()=>window.MrsaalTickets?.open();const cancel=node('button',tr('إلغاء محاولة الربط','Cancel linking attempt'),'btn btn-secondary');cancel.id='mrsaalwa-cancel';cancel.type='button';cancel.hidden=true;cancel.onclick=()=>disconnect(true);root.append(help,cancel);host.insertBefore(root,document.getElementById('wa-status'));
  select.onchange=async()=>{if(busy)return;busy=true;select.disabled=true;statusMessage(tr('جاري تغيير طريقة الربط…','Changing connection method…'),'loading');try{await request('provider',{provider:select.value});selected=select.value;options=null;choose('qr');statusMessage(tr('تم اختيار طريقة الربط. اتبع الخطوات الموضحة.','Connection method selected. Follow the steps shown.'));await loadWhatsAppStatus();}catch(e){select.value=selected;error(e);}finally{busy=false;select.disabled=false;}};
  choose('qr');
 }
 async function render(state){init();if(!root)return;if(!options||Date.now()>optionsUntil){options=await request('options');optionsUntil=Date.now()+30000;}selected=options.provider;guidance(state);progress(state);
  const select=document.getElementById('wa-provider');select.value=selected;select.options[1].disabled=!options.betaAvailable&&selected!=='mrsaalwa';document.getElementById('mrsaalwa-pairing').hidden=selected!=='mrsaalwa';
  if(selected==='mrsaalwa'&&method==='phone'){document.getElementById('wa-qr').style.display='none';if(['qr','connecting'].includes(state.status))document.getElementById('wa-status').textContent=code.textContent?tr('بانتظار إدخال كود الربط في واتساب','Waiting for the pairing code to be entered in WhatsApp'):tr('جاهز لطلب كود الربط','Ready to request a pairing code');}
  canCancel=!state.phone&&state.status!=='connected'&&(state.hasSession||['qr','connecting'].includes(state.status));document.getElementById('mrsaalwa-cancel').hidden=!canCancel;
  canDisconnect=state.status==='connected'||!!state.phone;const disconnectButton=document.getElementById('wa-disconnect');disconnectButton.disabled=!canDisconnect||busy;disconnectButton.title=canDisconnect?tr('فصل حساب واتساب المرتبط','Disconnect the linked WhatsApp account'):tr('لا يوجد حساب واتساب مرتبط','No WhatsApp account is linked');
  if(state.status==='connected'){code.hidden=true;code.textContent='';}
  document.getElementById('wa-qr').style.display='none';code.hidden=true;paintPairing(state);
  if(!options.betaAvailable&&selected!=='mrsaalwa'&&!notice.textContent)notice.textContent=tr('MrsaalWA غير متاح لهذا الحساب حاليًا. تواصل مع الدعم.','MrsaalWA is currently unavailable for this account. Contact support.');
 }
 async function connect(){init();if(busy)return;if(selected==='mrsaalwa'&&method==='phone'&&!validatePhone(true))return;busy=true;openPairingDialog();const button=document.getElementById('wa-connect');button.disabled=true;statusMessage(tr('بنجهّز وسيلة الربط. استنى لحظات…','Preparing your connection. Please wait…'),'loading');guidance();try{
  const phone=normalisePhone(document.getElementById('mrsaalwa-phone').value);const acknowledge=document.getElementById('mrsaalwa-pair-ack').checked;
  const result=await request('connect',selected==='mrsaalwa'?{method,phone,acknowledge}:{});statusMessage(method==='phone'?tr('بنجهّز كود الربط. بعد ظهوره اكتبه في واتساب على موبايلك.','Preparing your pairing code. Enter it in WhatsApp on your phone when it appears.'):tr('امسح QR من واتساب على موبايلك. الحالة بتتحدّث تلقائيًا.','Scan the QR with WhatsApp on your phone. The status updates automatically.'));
  if(/^[A-Z0-9-]{8,12}$/i.test(result.pairingCode||'')){code.textContent=result.pairingCode;code.hidden=true;paintPairing(lastState);}
  await loadWhatsAppStatus();
 }catch(e){error(e);}finally{busy=false;guidance();paintPairing(lastState);}}
 async function disconnect(cancelAttempt=false){init();if(busy||!(canDisconnect||(cancelAttempt&&canCancel)))return;const accepted=await window.MrsaalDialog.confirm(cancelAttempt?tr('إلغاء محاولة الربط الحالية؟','Cancel the current linking attempt?'):tr('فصل واتساب؟ هتحتاج تربطه من جديد.','Disconnect WhatsApp? You will need to link it again.'));if(!accepted)return;busy=true;try{await request('disconnect',{});code.hidden=true;code.textContent='';notice.textContent=tr('تم فصل الربط.','Disconnected.');await loadWhatsAppStatus();}catch(e){error(e);}finally{busy=false;}}
 window.MrsaalWA={render,connect,disconnect,safeText,statusUnavailable(message){if(pairingDialog?.open){dialogStatus.textContent=tr('تعذر تحديث الحالة: ','Could not update status: ')+safeText(message);dialogStatus.dataset.loading='false';}},pairingActive:()=>!!pairingDialog?.open&&lastState.status!=='connected',restoreMethod(value){if(value==='phone')document.getElementById('mrsaalwa-pairing')?.querySelectorAll('button')[1]?.click();}};
 document.addEventListener('mrsaal:language',()=>{options=null;pairingDialog?.close();pairingDialog?.remove();pairingDialog=null;root?.remove();root=null;loadWhatsAppStatus();});
})();
