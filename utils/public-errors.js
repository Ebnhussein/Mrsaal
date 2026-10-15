'use strict';
const translations=require('./error-translations.json');
const reverse=new Map(Object.entries(translations).map(([ar,en])=>[en,ar]));
const messages={
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
 const fromPath=/^\/(ar|en)(?:\/|$)/.exec(req.path||'');if(fromPath)return fromPath[1];
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
