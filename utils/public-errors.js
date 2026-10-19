'use strict';
const translations=require('./error-translations.json');
const reverse=new Map(Object.entries(translations).map(([ar,en])=>[en,ar]));
const messages={
 SCHEDULE_TIME_PAST:['موعد الجدولة عدى. اختار تاريخ ووقت جديدين في المستقبل، وبعدها جرّب تاني.','The scheduled time has passed. Choose a new date and time in the future, then try again.'],
 SCHEDULE_TIME_INVALID:['اختار تاريخ ووقت صحيحين للجدولة.','Choose a valid date and time for scheduling.'],
 EDIT_SEND_IN_PROGRESS:['الإرسال بدأ بالفعل أو نتيجته لسه غير مؤكدة؛ راجع التقارير قبل التعديل أو الإرسال من جديد.','Sending has already started or its outcome is uncertain. Check Reports before editing or resending.'],
 EDIT_INPUT:['راجع الشركة وقناة الإرسال.','Check the company and sending channel.'],
 EDIT_NOT_FOUND:['الشركة المطلوبة مش موجودة في حسابك.','This company was not found in your account.'],
 SCHEDULE_CANCELLED_EDIT:['اتلغت الجدولة بسبب تعديل الرسالة؛ تقدر تجدول من جديد أو تبعت يدويًا.','Schedule cancelled because the message is being edited. Schedule again or send manually.'],
 MRSAALWA_CONFIG:["إعدادات MrsaalWA ناقصة على السيرفر. تواصل مع الدعم.", "MrsaalWA server configuration is incomplete. Contact support."],
 MRSAALWA_TIMEOUT:["MrsaalWA لم يرد في المهلة. حدّث الحالة؛ لو كنت بتبعت راجع التقارير قبل المحاولة.", "MrsaalWA timed out. Refresh status; if sending, check Reports before retrying."],
 MRSAALWA_AUTH:["تعذر اعتماد اتصال MrsaalWA. الإدارة تحتاج مراجعة مفتاح الخدمة وصلاحياته.", "MrsaalWA could not authenticate. The administrator must check its service key and permissions."],
 MRSAALWA_RESPONSE:["رد MrsaalWA غير متوقع. حدّث الحالة أو تواصل مع الدعم.", "MrsaalWA returned an unexpected response. Refresh status or contact support."],
 MRSAALWA_SESSION:["جلسة MrsaalWA غير متاحة. تواصل مع الدعم قبل إعادة الربط.", "Your MrsaalWA session is unavailable. Contact support before relinking."],
 MRSAALWA_REJECTED:["MrsaalWA رفض العملية. راجع حالة الربط أو تواصل مع الدعم.", "MrsaalWA rejected the operation. Check connection status or contact support."],
 MRSAALWA_DISABLED:["MrsaalWA تحت التجربة ومش متاح لحسابك حاليًا. استخدم الربط الحالي أو تواصل مع الإدارة.", "MrsaalWA is in beta and is not currently available for your account. Use the current connection or contact the administrator."],
 MRSAALWA_INPUT:["راجع طريقة الربط المختارة.", "Check the selected connection method."],
 MRSAALWA_PHONE:["اكتب رقم واتساب بكود الدولة ووافق على تنبيه الربط بالكود.", "Enter your WhatsApp number with country code and acknowledge the pairing warning."],
 MRSAALWA_PAIR_WAIT:["استنى تجهيز الجلسة أو مرور دقيقة قبل طلب كود جديد. لو الحساب متصل استخدمه بدون ربط جديد.", "Wait for the session to initialise or a minute before requesting another code. Already connected accounts do not need relinking."],
 MRSAALWA_CAPACITY:["أماكن تجربة MrsaalWA ممتلئة حاليًا. حاول لاحقًا أو استخدم الربط الحالي.", "MrsaalWA beta slots are currently full. Try later or use the current connection."],
 MRSAALWA_BUSY:["في إرسال أو جدولة واتساب نشطة، أو إرسال نتيجته غير مؤكدة. راجع التقارير وأوقف الحملة قبل تغيير الربط.", "There is an active WhatsApp send or schedule, or an uncertain send. Review Reports and stop the campaign before changing the connection."],
 MRSAALWA_DISCONNECT_FIRST:["افصل الربط الحالي الأول، وبعدها اختار الطريقة الجديدة.", "Disconnect the current session before choosing a different method."],
 MRSAALWA_PDF:["راجع مرفق PDF: حتى 10 MB، ورسالة المرفق حتى 1024 حرفًا. اختصر الرسالة قبل الإرسال.", "Check the PDF attachment: up to 10 MB, with a caption up to 1,024 characters. Shorten the message before sending."],

 OPENWA_CONFIG:["إعدادات تجربة OpenWA ناقصة. راجع عنوان الخدمة والمفتاح والجلسة ورقم الاختبار في Coolify.", "OpenWA trial settings are incomplete. Check the service URL, API key, session ID and test recipient in Coolify."],
 OPENWA_TIMEOUT:["خدمة OpenWA لم ترد في المهلة. حدّث الحالة؛ لو ده طلب إرسال راجع المحادثة قبل تكراره.", "OpenWA did not respond in time. Refresh status; for a send request, check the chat before repeating it."],
 OPENWA_RESPONSE:["رد خدمة OpenWA غير متوقع. راجع إصدار الخدمة وحالتها.", "OpenWA returned an unexpected response. Check its version and health."],
 OPENWA_AUTH:["مفتاح OpenWA مرفوض أو لا يملك صلاحية الجلسة التجريبية.", "The OpenWA key is invalid or cannot access the trial session."],
 OPENWA_SESSION:["جلسة OpenWA التجريبية غير موجودة. راجع رقم الجلسة.", "The OpenWA trial session was not found. Check its session ID."],
 OPENWA_CONFLICT:["حالة جلسة OpenWA اتغيّرت. حدّث الحالة وانتظر اكتمال الاتصال.", "The OpenWA session state changed. Refresh status and wait for connection."],
 OPENWA_REJECTED:["خدمة OpenWA رفضت الطلب. راجع الجلسة من لوحة OpenWA.", "OpenWA rejected the request. Check the session in its dashboard."],
 OPENWA_INPUT:["راجع رسالة الاختبار والموافقة. الحد الأقصى 1000 حرف.", "Check the test message and consent. Maximum length is 1,000 characters."],
 OPENWA_CV:["ارفع نسخة PDF واخترها كسيرة نشطة قبل اختبار المرفق.", "Upload a PDF and select it as your active CV before testing attachments."],
 OPENWA_PDF_LIMIT:["تجربة OpenWA تدعم مرفق PDF حتى 10 MB.", "The OpenWA trial supports PDF attachments up to 10 MB."],
 OPENWA_KEY_REUSED:["مفتاح الاختبار مستخدم برسالة مختلفة. راجع المحادثة وجهّز اختبارًا جديدًا لو محتاج.", "This test key was used with different content. Check the chat and prepare another test if needed."],
 OPENWA_TRIAL_LIMIT:["وصلت لحد التجربة: 5 محاولات خلال 24 ساعة.", "Trial limit reached: five attempts per 24 hours."],
 OPENWA_SEND_UNCERTAIN:["نتيجة اختبار OpenWA غير مؤكدة. قد تكون الرسالة وصلت؛ راجع رقم الاستقبال قبل تجهيز اختبار جديد.", "The OpenWA test outcome is uncertain. The message may have arrived. Check the recipient before preparing another test."],

 WA_RECIPIENT_FORMAT:['رقم المستلم لازم يكون بكود الدولة، مثل +201012345678 بدل 01012345678. عدّل رقم الشركة قبل الإرسال.','The recipient number must include the country code, for example +201012345678 instead of 01012345678. Update the company phone number before sending.'],
 WA_NOT_CONNECTED:["واتساب غير متصل. انتظر الاتصال أو أعد الربط من الإعدادات.", "WhatsApp is disconnected. Wait for connection or reconnect in Settings."],
 WA_CONNECTION_CHANGED:["اتصال واتساب اتغيّر قبل الإرسال. لم تُرسل الرسالة؛ انتظر الاتصال وحاول تاني.", "The WhatsApp connection changed before sending. Nothing was sent. Wait for connection and try again."],
 WA_LOOKUP_FAILED:["تعذر التحقق من رقم واتساب قبل الإرسال. لم تُرسل الرسالة؛ حاول لاحقًا.", "Could not check the WhatsApp number before sending. Nothing was sent. Try later."],
 WA_NUMBER_INVALID:["الرقم غير مسجل على واتساب.", "The number is not registered on WhatsApp."],
 WA_PREPARE_FAILED:["تعذر تجهيز رسالة واتساب قبل الإرسال. لم تُرسل الرسالة؛ حاول لاحقًا.", "Could not prepare the WhatsApp message. Nothing was sent. Try later."],
 WA_SEND_UNCERTAIN:["قد تكون رسالة واتساب وصلت. راجع المحادثة والتقارير قبل إرسالها تاني.", "The WhatsApp message may have arrived. Check the chat and Reports before sending again."],

 AUTH:['مفتاح منصة الذكاء الاصطناعي مرفوض. راجعه من الإعدادات.','The AI provider rejected the API key. Check it in Settings.'],
 CREDITS:['رصيد منصة الذكاء الاصطناعي غير كافٍ. راجع الرصيد أو اختار منصة أخرى.','The AI provider has insufficient credits. Check your balance or choose another provider.'],
 QUOTA:['حد استخدام منصة الذكاء الاصطناعي مستهلك. انتظر إعادة التعيين أو اختار بديلًا.','The AI provider quota is exhausted. Wait for reset or choose another provider.'],
 MODEL_UNAVAILABLE:['الموديل غير متاح. حدّث قائمة الموديلات واختار بديلًا.','The model is unavailable. Refresh the model list and choose another one.'],
 TEMPORARY:['الموديل مزدحم أو غير متاح مؤقتًا. جرّب بديلًا أو حاول لاحقًا.','The model is busy or temporarily unavailable. Choose another model or try later.'],
 FORMAT:['الموديل رجّع تنسيقًا غير صالح. اختار بديلًا أو اكتب يدويًا.','The model returned an invalid format. Choose another model or write manually.'],
 TRUNCATED:['رد الموديل اتقطع قبل اكتماله. اختار ردًا أقصر أو موديلًا آخر.','The model response was cut off. Request a shorter answer or choose another model.'],
 EMPTY:['الموديل لم يرجع نصًا. اختار بديلًا أو حاول لاحقًا.','The model returned no text. Choose another model or try later.'],
 AUTH_INVALID_CREDENTIALS:['البريد الإلكتروني أو كلمة المرور غير صحيحة. راجعهم أو استخدم استعادة كلمة المرور.','The email address or password is incorrect. Check them or reset your password.'],
 AUTH_EMAIL_UNCONFIRMED:['أكد بريدك من رابط التأكيد اللي وصلك قبل تسجيل الدخول.','Confirm your email using the link you received before signing in.'],
 AUTH_CAPTCHA:['التحقق من أنك إنسان لم ينجح أو انتهت صلاحيته. أعد التحقق وحاول تاني.','Human verification failed or expired. Complete it again and retry.'],
 AUTH_EMAIL_RATE:['تم إرسال طلبات بريد كثيرة. انتظر قبل طلب رسالة جديدة.','Too many email requests were sent. Wait before requesting another email.'],
 INTERNAL:['حصل خطأ غير متوقع. تواصل مع الدعم واذكر الرقم المرجعي.','An unexpected error occurred. Contact support with the reference number.'],
 INVALID_REQUEST:['بيانات الطلب غير صالحة. راجع الحقول المطلوبة وحاول تاني.','The request is invalid. Check the required fields and try again.'],
 SESSION_EXPIRED:['انتهت الجلسة. سجّل الدخول مرة أخرى.','Your session expired. Sign in again.'],
 FORBIDDEN:['ليس لديك صلاحية لتنفيذ الطلب.','You do not have permission to perform this action.'],
 NOT_FOUND:['العنصر المطلوب غير موجود أو لم يعد متاحًا.','The requested item was not found or is no longer available.'],
 CONFLICT:['حالة العنصر اتغيرت. حدّث الصفحة وراجع حالته قبل المحاولة.','The item state changed. Refresh the page and check its status before retrying.'],
 FILE_TOO_LARGE:['الملف أو الطلب أكبر من الحجم المسموح. CV حتى 20 MB، وشيت الشركات حتى 10 MB.','The file or request is too large. CV uploads allow up to 20 MB; company sheets allow up to 10 MB.'],
 RATE_LIMIT:['طلبات كثيرة. انتظر قليلًا قبل المحاولة.','Too many requests. Wait a little before trying again.'],
 GMAIL_ACCOUNT_REQUIRED:['اختار أو أعد ربط حساب Gmail من الإعدادات ← قنوات التواصل.','Choose or reconnect a Gmail account in Settings → Communication channels.'],
 GMAIL_RECONNECT:['صلاحية اتصال Gmail انتهت أو اتلغت. افتح الإعدادات ← قنوات التواصل ← حسابات Gmail، وأعد ربط حساب الإرسال.','Your Gmail authorization expired or was revoked. Open Settings → Communication channels → Gmail accounts and reconnect the sender account.'],
 GMAIL_API_DISABLED:['خدمة Gmail API غير مفعّلة لمشروع مرسال. تواصل مع الدعم لتفعيلها.','Gmail API is disabled for Mrsaal. Contact support to enable it.'],
 GMAIL_PERMISSIONS:['ربط Gmail ناقص صلاحيات الإرسال أو متابعة الردود. أعد الربط ووافق على الصلاحيات المطلوبة.','The Gmail connection is missing sending or reply permissions. Reconnect Gmail and grant the requested permissions.'],
 GMAIL_CONFIG:['إعدادات Google الخاصة بمرسال مرفوضة. تواصل مع الدعم لمراجعة ربط Google.','Mrsaal’s Google configuration was rejected. Contact support to review the Google connection.'],
 GMAIL_BAD_REQUEST:['Google رفض طلب البريد أو المحادثة. جرّب تحديث الربط من قنوات التواصل؛ لو استمرت المشكلة تواصل مع الدعم.','Google rejected the email or thread request. Try reconnecting Gmail in Communication channels; contact support if it persists.'],
 GMAIL_THREAD_MISSING:['محادثة Gmail غير متاحة للحساب المختار. راجع حساب الإرسال المستخدم لهذه الرسالة.','This Gmail thread is unavailable to the selected account. Check which sender account was used for this message.'],
 GMAIL_LIMIT:['Gmail قيّد الطلبات أو الإرسال مؤقتًا. انتظر قبل إعادة المحاولة وراجع حالة الرسالة في التقارير.','Gmail temporarily limited requests or sending. Wait before retrying and check the message status in Reports.'],
 GMAIL_NETWORK:['تعذر الوصول إلى Gmail. جرّب لاحقًا وراجع المرسَل قبل تكرار الإرسال.','Gmail could not be reached. Try later and check Sent before repeating a send.'],
 DELIVERY_UNCERTAIN:['قد تكون الرسالة وصلت. راجع Gmail أو واتساب قبل إعادة الإرسال.','The message may have been delivered. Check Gmail or WhatsApp before sending again.'],
 AI_CV_SUMMARY_REQUIRED:['السيرة طويلة على ذكاء مرسال المحلي. افتح الإعدادات ← السيرة الذاتية، وراجع واعتمد ملخص السيرة أولًا. ملف PDF الأصلي هيفضل هو المرفق.','Your CV is too long for local Mrsaal AI. Open Settings → CV, review and approve your CV summary first. Your original PDF remains the attachment.'],
 AI_PROMPT_TOO_LONG:['إعدادات الأسلوب أو المسودة طويلة على الموديل المحلي. قلّل التعليمات والأمثلة أو استخدم منصة شخصية.','Your style settings or draft are too long for the local model. Shorten instructions and examples or use a personal provider.'],
 TIMEOUT:['ذكاء مرسال لم يرد خلال المهلة. اعتمد ملخص سيرة مختصرًا من الإعدادات أو اختار منصة أسرع. مسودتك الحالية محفوظة.','Mrsaal AI did not respond within the time limit. Approve a shorter CV summary in Settings or choose a faster provider. Your existing draft is unchanged.'],
 NETWORK:['الاتصال اتقطع. تأكد من الإنترنت وحاول تاني؛ لو كنت بتبعت راجع المرسَل والتقارير الأول.','The connection was interrupted. Check your internet and try again; if sending, check Sent and Reports first.'],
 AI_FORMAT:['الموديل رجّع مسودة بتنسيق غير صالح. اختار موديلًا آخر أو اكتبها يدويًا. المسودة السابقة محفوظة.','The model returned an invalid draft format. Choose another model or write manually. Your previous draft is unchanged.'],
 AI_TRUNCATED:['رد الموديل اتقطع قبل اكتماله. قلّل طول الرسالة أو اختار موديلًا آخر.','The model response was cut off. Request a shorter message or choose another model.'],
 AI_EMPTY:['الموديل لم يرجع نصًا قابلًا للاستخدام. اختار بديلًا أو اكتب الرسالة يدويًا.','The model returned no usable text. Choose another model or write manually.'],
 AI_CANCELLED:['اتلغى طلب الذكاء الاصطناعي.','The AI request was cancelled.'],
 AI_UNAVAILABLE:['خدمة الذكاء الاصطناعي غير متاحة حاليًا. جرّب لاحقًا أو اختار منصة أخرى.','The AI service is temporarily unavailable. Try later or choose another provider.']
};
function language(req){
 const explicit=req.get?.('X-Mrsaal-Language');if(['ar','en'].includes(explicit))return explicit;
 if(['ar','en'].includes(req.query?.lang))return req.query.lang;
 const fromPath=/^\/(ar|en)(?:\/|$)/.exec(req.path||'');if(fromPath)return fromPath[1];
 const cookie=/(?:^|;\s*)mrsaal-language=(ar|en)(?:;|$)/.exec(req.get?.('Cookie')||'');if(cookie)return cookie[1];
 try{const ref=new URL(req.get?.('Referer'));const match=/^\/(ar|en)(?:\/|$)/.exec(ref.pathname);if(match)return match[1];}catch{}
 return /^en(?:\b|[-_])/i.test(req.get?.('Accept-Language')||'')?'en':'ar';
}
function statusOf(error,fallback=500){const n=Number(error?.response?.status||error?.statusCode||error?.status);return Number.isInteger(n)&&n>=400&&n<=599?n:fallback;}
function known(message,lang){const value=String(message||'').trim(),ar=reverse.get(value)||value;
 if(translations[ar])return lang==='en'?translations[ar]:ar;
 // Only translate application-controlled prefixes; do not echo appended provider text.
 const prefixes=[['اختيار غير صالح: ','اختيار غير صالح.','Invalid option.'],['متغير ناقص أو غير مدعوم في القالب: ','متغير ناقص أو غير مدعوم في القالب.','The template has a missing or unsupported variable.'],['وصلت لحد نسخ السيرة (','وصلت لحد نسخ السيرة المتاحة. احذف نسخة غير مستخدمة.','You reached the CV version limit. Delete an unused version.'],['وصلت لحد حسابات Gmail المتصلة (','وصلت لحد حسابات Gmail المتصلة. افصل حسابًا غير مستخدم.','You reached the connected Gmail account limit. Disconnect an unused account.']];
 for(const [prefix,a,e] of prefixes)if(ar.startsWith(prefix))return lang==='en'?e:a;
 return null;
}
function describe(error,lang='ar',fallback=500){
 const status=statusOf(error,fallback),rawCode=typeof error?.code==='string'?error.code:'';
 let code=rawCode;
 if(error?.reason==='FORMAT')code='AI_FORMAT';
 if(code==='LIMIT_FILE_SIZE'||status===413)code='FILE_TOO_LARGE';
 const specific=known(error?.message,lang);
 if(messages[code]){const failures=safeFailures(error?.failures);const suffix=code==='AI_UNAVAILABLE'&&failures.length?' '+failures.map(f=>f.provider+' / '+f.model+': '+(messages[f.code]||messages.AI_UNAVAILABLE)[lang==='en'?1:0]).join(' | '):'';return {code,status,error:messages[code][lang==='en'?1:0]+suffix,...(failures.length?{failures}:{})};}
 if(specific)return {code:/^[A-Z][A-Z0-9_]{1,50}$/.test(code)?code:'VALIDATION',status:status===500?400:status,error:specific};
 code=status===401?'SESSION_EXPIRED':status===403?'FORBIDDEN':status===404?'NOT_FOUND':status===409?'CONFLICT':status===429?'RATE_LIMIT':status<500?'INVALID_REQUEST':'INTERNAL';
 return {code,status,error:messages[code][lang==='en'?1:0]};
}
function safeFailures(items){return (Array.isArray(items)?items:[]).slice(0,3).filter(f=>f&&['local','gemini','openrouter','openai','groq'].includes(f.provider)).map(f=>({provider:f.provider,model:String(f.model||'').replace(/[^a-zA-Z0-9_/:.\-]/g,'').slice(0,100),code:Object.hasOwn(messages,f.code)?f.code:'AI_UNAVAILABLE'}));}
function translate(text,lang,status=400,code){return describe({message:text,code,status},lang,status).error;}
function diagnostic(error){const data=error?.response?.data;const value=typeof data?.error==='string'?data.error:data?.error?.errors?.[0]?.reason||error?.code||error?.name||'UNKNOWN';return {status:statusOf(error),reason:String(value).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)};}
module.exports={language,statusOf,describe,translate,known,diagnostic,messages,safeFailures};
