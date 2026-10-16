'use strict';
(()=>{
 const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 let options=null,optionsUntil=0,selected='baileys',method='qr',canDisconnect=false,canCancel=false,busy=false,root,notice,code;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 async function request(path,body){const r=await fetch('/api/whatsapp/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Mrsaal-WA':'1'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw window.MrsaalErrors?window.MrsaalErrors.from(data,r.status):Object.assign(new Error(data.error),{code:data.code});return data;}
 function error(e){notice.replaceChildren(node('span',e.message));if(['REAUTH_REQUIRED','ADMIN_GOOGLE_REQUIRED'].includes(e.code)){const a=node('a',tr('تأكيد هويتي','Verify my identity'),'btn btn-secondary');a.href='/'+(document.documentElement.lang==='en'?'en':'ar')+'/login?reauth=1';notice.append(a);}}
 function init(){if(root)return;const host=document.getElementById('wa-status')?.parentElement;if(!host)return;
  root=node('div',null,'mrsaalwa-options');root.dataset.userContent='';
  const label=node('label',tr('طريقة ربط واتساب','WhatsApp connection method'),'label');const select=node('select',null,'select');select.id='wa-provider';label.htmlFor=select.id;
  select.append(new Option(tr('Baileys · الطريقة البديلة','Baileys · Alternative connection'),'baileys'),new Option('MrsaalWA · '+tr('موصى به · تجريبي','Recommended · Beta'),'mrsaalwa'));root.append(label,select,node('p',tr('لتغيير الطريقة، افصل الربط الحالي وأنهِ الإرسال والجدولة أولًا.','To change methods, disconnect and finish active sends and schedules first.'),'hint'));
  notice=node('div',null,'mrsaalwa-notice');notice.setAttribute('role','status');root.append(notice);
  const beta=node('div');beta.id='mrsaalwa-pairing';beta.hidden=true;
  beta.append(node('p',tr('كل حساب له جلسة مستقلة. الإرسال والمرفقات والردود تظهر في نفس تقاريرك.','Each account has its own session. Sends, attachments and replies use your existing Reports.'),'hint'));
  const methods=node('div',null,'row'),qr=node('button','QR Code','btn btn-secondary'),phoneButton=node('button',tr('كود برقم الموبايل','Link with phone number'),'btn btn-secondary');qr.type=phoneButton.type='button';
  const phoneBox=node('div');phoneBox.id='mrsaalwa-phone-box';phoneBox.hidden=true;const phoneLabel=node('label',tr('رقم واتساب اللي هتربطه — بكود الدولة','Your WhatsApp number — include country code'),'label'),phone=node('input',null,'input');phone.id='mrsaalwa-phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel';phone.dir='ltr';phone.placeholder='201012345678';phoneLabel.htmlFor=phone.id;
  const ackLabel=node('label',null,'mrsaalwa-ack'),ack=node('input');ack.type='checkbox';ack.id='mrsaalwa-pair-ack';ackLabel.append(ack,node('span',tr('فاهم إن طلب كود ممكن يفصل جلسة مرتبطة لنفس الرقم. لو عايز تحافظ عليها استخدم QR.','I understand requesting a code may unlink an existing linked session for this number. Use QR to preserve it.')));
  phoneBox.append(phoneLabel,phone,ackLabel,node('p',tr('من واتساب: الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف، واكتب الكود اللي هيظهر هنا.','In WhatsApp: Linked devices → Link a device → Link with phone number, then enter the code shown here.'),'hint'));
  code=node('output',null,'mrsaalwa-code');code.hidden=true;code.setAttribute('aria-live','polite');code.dir='ltr';
  function choose(value){method=value;phoneBox.hidden=value!=='phone';qr.setAttribute('aria-pressed',String(value==='qr'));phoneButton.setAttribute('aria-pressed',String(value==='phone'));code.hidden=true;code.textContent='';if(value==='phone')document.getElementById('wa-qr').style.display='none';}
  qr.onclick=()=>choose('qr');phoneButton.onclick=()=>choose('phone');methods.append(qr,phoneButton);beta.append(methods,phoneBox,code);root.append(beta);
  const help=node('button',tr('بلّغ عن مشكلة في الربط','Report a connection issue'),'btn btn-secondary');help.type='button';help.onclick=()=>window.MrsaalTickets?.open();const cancel=node('button',tr('إلغاء محاولة الربط','Cancel linking attempt'),'btn btn-secondary');cancel.id='mrsaalwa-cancel';cancel.type='button';cancel.hidden=true;cancel.onclick=()=>disconnect(true);root.append(help,cancel);host.insertBefore(root,document.getElementById('wa-status'));
  select.onchange=async()=>{if(busy)return;busy=true;select.disabled=true;notice.textContent=tr('جاري تغيير طريقة الربط…','Changing connection method…');try{await request('provider',{provider:select.value});selected=select.value;options=null;choose('qr');notice.textContent=tr('تم تغيير الطريقة. اضغط ربط واتساب للبدء.','Method changed. Press Connect WhatsApp to begin.');await loadWhatsAppStatus();}catch(e){select.value=selected;error(e);}finally{busy=false;select.disabled=false;}};
  choose('qr');
 }
 async function render(state){init();if(!root)return;if(!options||Date.now()>optionsUntil){options=await request('options');optionsUntil=Date.now()+30000;}selected=options.provider;
  const select=document.getElementById('wa-provider');select.value=selected;select.options[1].disabled=!options.betaAvailable&&selected!=='mrsaalwa';document.getElementById('mrsaalwa-pairing').hidden=selected!=='mrsaalwa';
  if(selected==='mrsaalwa'&&method==='phone')document.getElementById('wa-qr').style.display='none';
  canCancel=!state.phone&&state.status!=='connected'&&(state.hasSession||['qr','connecting'].includes(state.status));document.getElementById('mrsaalwa-cancel').hidden=!canCancel;
  canDisconnect=state.status==='connected'||!!state.phone;const disconnectButton=document.getElementById('wa-disconnect');disconnectButton.disabled=!canDisconnect||busy;disconnectButton.title=canDisconnect?tr('فصل حساب واتساب المرتبط','Disconnect the linked WhatsApp account'):tr('لا يوجد حساب واتساب مرتبط','No WhatsApp account is linked');
  if(state.status==='connected'){code.hidden=true;code.textContent='';}
  if(!options.betaAvailable&&selected!=='mrsaalwa'&&!notice.textContent)notice.textContent=tr('MrsaalWA غير متاح لهذا الحساب حاليًا. تواصل مع الدعم.','MrsaalWA is currently unavailable for this account. Contact support.');
 }
 async function connect(){init();if(busy)return;busy=true;const button=document.getElementById('wa-connect');button.disabled=true;notice.textContent=tr('جاري تجهيز الربط… استنى ظهور QR أو الكود.','Preparing your connection… wait for the QR or pairing code.');try{
  const phone=document.getElementById('mrsaalwa-phone').value.replace(/^\+/,'').replace(/[\s()-]/g,'');const acknowledge=document.getElementById('mrsaalwa-pair-ack').checked;
  if(selected==='mrsaalwa'&&method==='phone'&&(!/^[1-9]\d{7,14}$/.test(phone)||!acknowledge))throw new Error(tr('اكتب الرقم بكود الدولة ووافق على تنبيه الربط بالكود.','Enter your number with country code and acknowledge the pairing warning.'));
  const result=await request('connect',selected==='mrsaalwa'?{method,phone,acknowledge}:{});notice.textContent=tr('اتبع خطوات الربط، ثم حدّث الحالة.','Follow the linking steps, then refresh status.');
  if(result.pairingCode){code.textContent=result.pairingCode;code.hidden=false;}
  await loadWhatsAppStatus();
 }catch(e){error(e);}finally{busy=false;button.disabled=false;}}
 async function disconnect(cancelAttempt=false){init();if(busy||!(canDisconnect||(cancelAttempt&&canCancel)))return;const accepted=await window.MrsaalDialog.confirm(cancelAttempt?tr('إلغاء محاولة الربط الحالية؟','Cancel the current linking attempt?'):tr('فصل واتساب؟ هتحتاج تربطه من جديد.','Disconnect WhatsApp? You will need to link it again.'));if(!accepted)return;busy=true;try{await request('disconnect',{});code.hidden=true;code.textContent='';notice.textContent=tr('تم فصل الربط.','Disconnected.');await loadWhatsAppStatus();}catch(e){error(e);}finally{busy=false;}}
 window.MrsaalWA={render,connect,disconnect};
 document.addEventListener('mrsaal:language',()=>{options=null;root?.remove();root=null;loadWhatsAppStatus();});
})();
