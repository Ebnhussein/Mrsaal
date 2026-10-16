'use strict';
(()=>{
 const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 let options=null,optionsUntil=0,selected='baileys',method='qr',canDisconnect=false,canCancel=false,busy=false,lastState={status:'disconnected'},root,notice,code,steps;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 async function request(path,body){const r=await fetch('/api/whatsapp/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Mrsaal-WA':'1'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw window.MrsaalErrors?window.MrsaalErrors.from(data,r.status):Object.assign(new Error(data.error),{code:data.code});return data;}
 function safeText(text){return String(text||'').replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/ig,tr('معرّف داخلي مخفي','Internal ID hidden'));}
 function statusMessage(text,kind='info'){notice.dataset.kind=kind;notice.replaceChildren(node('span',safeText(text)));}
 function error(e){
  if(['REAUTH_REQUIRED','ADMIN_GOOGLE_REQUIRED'].includes(e.code)){
   notice.dataset.kind='identity';notice.replaceChildren(node('strong',tr('خطوة أمان قبل تغيير الربط','A security check before changing your connection')),node('p',tr('عشان نحمي حسابك، محتاجين نتأكد إنك صاحب الطلب. كمّل بنفس حساب Google اللي بتستخدمه في مرسال، وبعدها هنرجعك لإعدادات الربط.','To protect your account, confirm this request using the same Google account you use for Mrsaal. We will return you to connection settings afterwards.')));
   const a=node('a',tr('متابعة تأكيد الهوية','Continue identity verification'),'btn btn-primary');a.href='/'+(document.documentElement.lang==='en'?'en':'ar')+'/login?reauth=1';a.onclick=()=>{try{sessionStorage.setItem('mrsaal-wa-return',method);}catch{}};notice.append(a);
  }else statusMessage(e.message,'error');
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
  if(notice.dataset.kind==='identity'||(notice.dataset.kind==='error'&&state.status!=='connected'))return;
  if(state.status==='connected')statusMessage(tr('واتساب جاهز. تقدر ترسل الرسائل والمرفقات وتتابع الردود من التقارير.','WhatsApp is ready. Send messages and attachments, and follow replies in Reports.'),'success');
  else if(method==='phone'&&code?.textContent)statusMessage(tr('كود الربط جاهز. اكتبه في واتساب على موبايلك لإكمال الاتصال.','Your pairing code is ready. Enter it in WhatsApp on your phone to finish connecting.'));
  else if(state.status==='qr'&&method==='phone')statusMessage(tr('اضغط «إظهار كود الربط» واتبعه من واتساب على موبايلك.','Press “Show pairing code”, then continue in WhatsApp on your phone.'));
  else if(state.status==='qr')statusMessage(tr('رمز الربط جاهز. امسحه من «الأجهزة المرتبطة» في واتساب على موبايلك.','Your QR is ready. Scan it from Linked devices in WhatsApp on your phone.'));
  else if(state.status==='connecting')statusMessage(tr('بنكمل الاتصال بواتساب. سيب الصفحة مفتوحة؛ الحالة بتتحدّث تلقائيًا.','Connecting to WhatsApp. Keep this page open; the status updates automatically.'));
  else if(!busy&&code?.textContent)statusMessage(tr('كود الربط جاهز. اكتبه في واتساب على موبايلك لإكمال الاتصال.','Your pairing code is ready. Enter it in WhatsApp on your phone to finish connecting.'));
  else if(!busy)statusMessage(tr('اختار طريقة الربط واتبع الخطوات اللي تحت.','Choose a connection method and follow the steps below.'));
 }
 function init(){if(root)return;const host=document.getElementById('wa-status')?.parentElement;if(!host)return;
  root=node('div',null,'mrsaalwa-options');root.dataset.userContent='';
  const label=node('label',tr('طريقة ربط واتساب','WhatsApp connection method'),'label');const select=node('select',null,'select');select.id='wa-provider';label.htmlFor=select.id;
  select.append(new Option(tr('Baileys · الطريقة البديلة','Baileys · Alternative connection'),'baileys'),new Option('MrsaalWA · '+tr('موصى به · تجريبي','Recommended · Beta'),'mrsaalwa'));root.append(label,select);
  notice=node('div',null,'mrsaalwa-notice');notice.setAttribute('role','status');root.append(notice);steps=node('ol',null,'mrsaalwa-steps');root.append(steps);
  const beta=node('div');beta.id='mrsaalwa-pairing';beta.hidden=true;
  beta.append(node('p',tr('اربط حسابك لإرسال الرسائل والـCV، وتابع وصول الرسائل والردود من التقارير.','Connect your account to send messages and your CV, then track delivery and replies in Reports.'),'hint'));
  const methods=node('div',null,'row'),qr=node('button','QR Code','btn btn-secondary'),phoneButton=node('button',tr('كود برقم الموبايل','Link with phone number'),'btn btn-secondary');qr.type=phoneButton.type='button';
  const phoneBox=node('div');phoneBox.id='mrsaalwa-phone-box';phoneBox.hidden=true;const phoneLabel=node('label',tr('رقم واتساب اللي هتربطه — بكود الدولة','Your WhatsApp number — include country code'),'label'),phone=node('input',null,'input');phone.id='mrsaalwa-phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel';phone.dir='ltr';phone.placeholder='201012345678';phoneLabel.htmlFor=phone.id;
  const ackLabel=node('label',null,'mrsaalwa-ack'),ack=node('input');ack.type='checkbox';ack.id='mrsaalwa-pair-ack';ackLabel.append(ack,node('span',tr('فاهم إن طلب كود ممكن يفصل جلسة مرتبطة لنفس الرقم. لو عايز تحافظ عليها استخدم QR.','I understand requesting a code may unlink an existing linked session for this number. Use QR to preserve it.')));
  phoneBox.append(phoneLabel,phone,ackLabel,node('p',tr('من واتساب: الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف، واكتب الكود اللي هيظهر هنا.','In WhatsApp: Linked devices → Link a device → Link with phone number, then enter the code shown here.'),'hint'));
  code=node('output',null,'mrsaalwa-code');code.setAttribute('aria-label',tr('كود ربط واتساب المؤقت — مش معرّف الجلسة','Temporary WhatsApp pairing code — not a session ID'));code.hidden=true;code.setAttribute('aria-live','polite');code.dir='ltr';
  function choose(value){method=value;phoneBox.hidden=value!=='phone';qr.setAttribute('aria-pressed',String(value==='qr'));phoneButton.setAttribute('aria-pressed',String(value==='phone'));code.hidden=true;code.textContent='';if(value==='phone')document.getElementById('wa-qr').style.display='none';guidance();}
  qr.onclick=()=>choose('qr');phoneButton.onclick=()=>choose('phone');methods.append(qr,phoneButton);beta.append(methods,phoneBox,code);root.append(beta);
  const help=node('button',tr('بلّغ عن مشكلة في الربط','Report a connection issue'),'btn btn-secondary');help.type='button';help.onclick=()=>window.MrsaalTickets?.open();const cancel=node('button',tr('إلغاء محاولة الربط','Cancel linking attempt'),'btn btn-secondary');cancel.id='mrsaalwa-cancel';cancel.type='button';cancel.hidden=true;cancel.onclick=()=>disconnect(true);root.append(help,cancel);host.insertBefore(root,document.getElementById('wa-status'));
  select.onchange=async()=>{if(busy)return;busy=true;select.disabled=true;statusMessage(tr('جاري تغيير طريقة الربط…','Changing connection method…'),'loading');try{await request('provider',{provider:select.value});selected=select.value;options=null;choose('qr');statusMessage(tr('تم اختيار طريقة الربط. اتبع الخطوات الموضحة.','Connection method selected. Follow the steps shown.'));await loadWhatsAppStatus();}catch(e){select.value=selected;error(e);}finally{busy=false;select.disabled=false;}};
  choose('qr');
 }
 async function render(state){init();if(!root)return;if(!options||Date.now()>optionsUntil){options=await request('options');optionsUntil=Date.now()+30000;}selected=options.provider;guidance(state);progress(state);
  const select=document.getElementById('wa-provider');select.value=selected;select.options[1].disabled=!options.betaAvailable&&selected!=='mrsaalwa';document.getElementById('mrsaalwa-pairing').hidden=selected!=='mrsaalwa';
  if(selected==='mrsaalwa'&&method==='phone')document.getElementById('wa-qr').style.display='none';
  canCancel=!state.phone&&state.status!=='connected'&&(state.hasSession||['qr','connecting'].includes(state.status));document.getElementById('mrsaalwa-cancel').hidden=!canCancel;
  canDisconnect=state.status==='connected'||!!state.phone;const disconnectButton=document.getElementById('wa-disconnect');disconnectButton.disabled=!canDisconnect||busy;disconnectButton.title=canDisconnect?tr('فصل حساب واتساب المرتبط','Disconnect the linked WhatsApp account'):tr('لا يوجد حساب واتساب مرتبط','No WhatsApp account is linked');
  if(state.status==='connected'){code.hidden=true;code.textContent='';}
  if(!options.betaAvailable&&selected!=='mrsaalwa'&&!notice.textContent)notice.textContent=tr('MrsaalWA غير متاح لهذا الحساب حاليًا. تواصل مع الدعم.','MrsaalWA is currently unavailable for this account. Contact support.');
 }
 async function connect(){init();if(busy)return;busy=true;const button=document.getElementById('wa-connect');button.disabled=true;statusMessage(tr('بنجهّز وسيلة الربط. استنى لحظات…','Preparing your connection. Please wait…'),'loading');guidance();try{
  const phone=document.getElementById('mrsaalwa-phone').value.replace(/^\+/,'').replace(/[\s()-]/g,'');const acknowledge=document.getElementById('mrsaalwa-pair-ack').checked;
  if(selected==='mrsaalwa'&&method==='phone'&&(!/^[1-9]\d{7,14}$/.test(phone)||!acknowledge))throw new Error(tr('اكتب الرقم بكود الدولة ووافق على تنبيه الربط بالكود.','Enter your number with country code and acknowledge the pairing warning.'));
  const result=await request('connect',selected==='mrsaalwa'?{method,phone,acknowledge}:{});statusMessage(method==='phone'?tr('بنجهّز كود الربط. بعد ظهوره اكتبه في واتساب على موبايلك.','Preparing your pairing code. Enter it in WhatsApp on your phone when it appears.'):tr('امسح QR من واتساب على موبايلك. الحالة بتتحدّث تلقائيًا.','Scan the QR with WhatsApp on your phone. The status updates automatically.'));
  if(/^[A-Z0-9-]{8,12}$/i.test(result.pairingCode||'')){code.textContent=result.pairingCode;code.hidden=false;}
  await loadWhatsAppStatus();
 }catch(e){error(e);}finally{busy=false;guidance();}}
 async function disconnect(cancelAttempt=false){init();if(busy||!(canDisconnect||(cancelAttempt&&canCancel)))return;const accepted=await window.MrsaalDialog.confirm(cancelAttempt?tr('إلغاء محاولة الربط الحالية؟','Cancel the current linking attempt?'):tr('فصل واتساب؟ هتحتاج تربطه من جديد.','Disconnect WhatsApp? You will need to link it again.'));if(!accepted)return;busy=true;try{await request('disconnect',{});code.hidden=true;code.textContent='';notice.textContent=tr('تم فصل الربط.','Disconnected.');await loadWhatsAppStatus();}catch(e){error(e);}finally{busy=false;}}
 window.MrsaalWA={render,connect,disconnect,safeText,restoreMethod(value){if(value==='phone')document.getElementById('mrsaalwa-pairing')?.querySelectorAll('button')[1]?.click();}};
 document.addEventListener('mrsaal:language',()=>{options=null;root?.remove();root=null;loadWhatsAppStatus();});
})();
