 'use strict';
const {topics}=require('../public/assets/product-guide');
const {guides}=require('./website-guides');const fs=require('fs'),path=require('path');
const categories=[['account','الحساب والدخول','Account and sign-in','person'],['files','السي في والشركات','CV and company files','description'],['gmail','Gmail والإيميل','Gmail and email','mail'],['whatsapp','واتساب','WhatsApp','chat'],['ai','الذكاء الاصطناعي','AI providers and writing','auto_awesome'],['sending','الإرسال والحملات','Sending and campaigns','send'],['reports','التقارير والإشعارات','Reports and notifications','notifications'],['support','المساعدة والدعم','Help and support','support_agent']];
// Issue titles are navigation labels; answers always come from the published product guide.
const issues=[
 ['confirm','account','account-email','رسالة تأكيد البريد مش بتوصل','Confirmation email is not arriving','تسجيل حساب جديد تفعيل كود لينك تأكيد سبام','signup register verification code link spam confirmation'],
 ['password','account','account-email','نسيت كلمة المرور أو مش عارف أدخل','Forgot password or cannot sign in','دخول تسجيل موبايل باسورد كلمة سر نسيت','login sign in mobile password reset forgot'],
 ['profile','account','setup','أكمّل بيانات الحساب إزاي؟','How do I finish account setup?','اسم رقم موبايل إعدادات بيانات حساب','name phone profile settings setup'],
 ['cv-mobile','files','cv','ملف PDF مش بيترفع من الموبايل','PDF will not upload from my phone','سيرة cv pdf رفع موبايل هاتف ملف درايف','cv resume pdf upload mobile phone file drive'],
 ['cv-attachment','files','preview','السي في مش ظاهر كمرفق','My CV attachment is missing','مرفق سيرة cv pdf ايميل واتساب رفع','cv resume pdf attachment email whatsapp upload'],
 ['cv-versions','files','cv-versions','اختيار أو حذف نسخة من السي في','Choose or delete a saved CV version','نسخة نسخ حذف مسح سيرة cv','cv resume version delete remove active'],
 ['import','files','companies','استوردت الشيت والشركات مش ظاهرة','Imported companies are not showing','شركات استيراد شيت اكسيل ملف excel xlsx csv أعمدة مطابقة','companies import sheet excel xlsx csv columns mapping missing'],
 ['arabic-csv','files','csv-encoding','حروف العربي في CSV مش مظبوطة','Arabic text in CSV looks incorrect','عربي حروف ترميز csv utf8 اكسيل','arabic text encoding csv utf8 excel'],
 ['phones','files','companies','أرقام الشركات ناقصة أو مش صحيحة','Company phone numbers are incomplete','رقم ارقام موبايل واتساب صفر كود دولة اكسيل','phone number whatsapp leading zero country code excel'],
 ['gmail-link','gmail','google','ربط Gmail أو التبديل بين حسابات الإرسال','Connect Gmail or switch sender accounts','ربط حساب جوجل google oauth gmail ميل ايميل ارسال حسابات','connect google oauth gmail email sender switch accounts'],
 ['gmail-permissions','gmail','channel-guide','Gmail بيرفض الإرسال أو بيطلب صلاحيات','Gmail rejects sending or needs permissions','gmail api disabled صلاحيات تفعيل جوجل بريد فشل ارسال','gmail api disabled permissions enable google email sending failed'],
 ['email-spam','gmail','email-guide','الإيميل بيروح Spam','Email is going to spam','ايميل بريد ميل spam سبام غير مرغوب','email mail spam inbox delivery'],
 ['qr','whatsapp','whatsapp','QR واتساب مش ظاهر أو الاتصال اتفصل','WhatsApp QR is missing or disconnected','واتساب whatsapp qr ربط اتصال فصل مسح كود','whatsapp qr pairing connect disconnected scan code'],
 ['wa-attachment','whatsapp','preview','إرسال السي في مع رسالة واتساب','Send a CV with a WhatsApp message','واتساب whatsapp مرفق cv pdf سيرة رسالة','whatsapp cv pdf resume document attachment message'],
 ['ai-connect','ai','ai','أربط API وأختار الموديلات إزاي؟','How do I connect an API and choose models?','api ai مفتاح ربط موديل منصة gemini openrouter groq openai','api ai key connect model provider gemini openrouter groq openai'],
 ['ai-quota','ai','ai','المفتاح مرفوض أو الرصيد والكوته خلصوا','API key rejected or quota exceeded','api ai مفتاح رصيد كوته حصة 401 403 402 429 quota','api ai key credits quota 401 403 402 429 rejected'],
 ['ai-slow','ai','ai','كتابة الرسالة بطيئة أو انتهت المهلة','Writing is slow or the request timed out','ai كتابة رسالة بطيء بطئ وقت مهلة timeout موبايل','ai writing draft slow timeout mobile time'],
 ['style','ai','style','أخلي الرسالة بأسلوبي وأعدّل المسودة','Write in my own voice and edit the draft','ai كتابة اسلوب تعليمات رسالة تعديل مسودة إعادة','ai writing style instructions edit draft rewrite voice'],
 ['template','ai','template','استخدام قالب ثابت بدل AI','Use a fixed template instead of AI','قالب ثابت متغير رسالة ai','fixed template variables message ai'],
 ['preview','sending','preview','مراجعة الرسالة والمرفق قبل الإرسال','Review a message and attachment before sending','معاينة مراجعة رسالة مسودة مرفق ارسال','preview review message draft attachment send'],
 ['skip','sending','send','شركة اتعمل لها تخطي في الإرسال','A company was skipped during sending','تخطي اسكيب رقم ايميل ناقص ارسال واتساب','skip skipped sending missing phone email whatsapp'],
 ['schedule','sending','send','جدولة الرسائل أو فشل الإرسال','Schedule messages or investigate failed sends','جدولة موعد فشل ارسال رسالة campaign','schedule scheduled failed sending message campaign'],
 ['campaign','sending','campaigns','إدارة حملة الإرسال ومسوداتها','Manage a campaign and its drafts','حملة ارسال إيقاف مسودات مراجعة','campaign sending pause drafts review'],
 ['opens','reports','reports','مؤشر فتح الإيميل معناه إيه؟','What does the email open indicator mean?','فتح ايميل قراءة تراك تتبع seen tracking','open email read tracking seen indicator'],
 ['replies','reports','reports','رد الإيميل مش ظاهر في التقارير','An email reply is not showing in reports','رد ايميل تقرير تقارير مزامنة متأخر','reply email report sync delayed'],
 ['sound','reports','notifications','الإشعارات أو صوت التنبيه مش شغال','Notifications or notification sound do not work','اشعار اشعارات صوت تنبيه متصفح موبايل صلاحية','notification notifications sound browser mobile permission'],
 ['ticket','support','tickets','إرسال شكوى ومتابعة رد الدعم','Submit a ticket and follow support replies','شكوى تكت دعم مشكلة تواصل مساعدة','ticket support problem issue contact help'],
 ['tour','support','tour','إعادة شرح الصفحة والجولة','Replay the page walkthrough','شرح صفحة جولة دليل تور','page walkthrough guide tour replay']
];
function catalogue(lang){const en=lang==='en',used=new Set(issues.map(x=>x[2])),documents=Object.fromEntries(topics.filter(t=>used.has(t.id)).map(t=>[t.id,{title:en?t.title_en:t.title,answer:en?t.answer_en:t.answer}]));
 for(const [id,slug]of [['channel-guide','email-or-whatsapp'],['email-guide','application-email']]){const g=guides.find(x=>x.slug===slug);documents[id]={title:g['title_'+(en?'en':'ar')],answer:g['body_'+(en?'en':'ar')],href:'/'+(en?'en':'ar')+'/blog/'+slug};}
 const html=fs.readFileSync(path.join(__dirname,'stitch-pages',...(en?['en']:[]),'help.html'),'utf8'),content=html.match(/class="faq-content[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
 documents['csv-encoding']={title:en?'CSV UTF-8 encoding':'ترميز CSV UTF-8',answer:content.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').trim()};
 return {language:en?'en':'ar',categories:categories.map(([id,ar,eng,icon])=>({id,title:en?eng:ar,icon})),issues:issues.map(([id,category,topic,ar,eng,kwAr,kwEn])=>({id,category,topic,title:en?eng:ar,keywords:en?kwEn:kwAr})),documents};}

function markup(lang){const en=lang==='en',data=JSON.stringify(catalogue(lang)).replace(/</g,'\\u003c');return `<section id="help-search-results" class="help-search-results" aria-label="${en?'Suggested help topics':'المشاكل والتصنيفات المقترحة'}" hidden><div class="help-search-heading"><h2>${en?'Find the right solution':'وصل للحل المناسب'}</h2><button type="button" data-help-search-close aria-label="${en?'Close suggestions':'إغلاق الاقتراحات'}">×</button></div><div data-help-categories class="help-search-categories"></div><p data-help-search-status role="status" aria-live="polite"></p><div data-help-results></div></section><script id="help-search-data" type="application/json">${data}</script>`;}
module.exports={catalogue,markup};
