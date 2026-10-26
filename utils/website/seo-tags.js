'use strict';
// Description, canonical and social-preview tags for the public pages. Titles stay in the page templates.
const ORIGIN='https://mrsaal.ebnhussein.co';
const IMAGE=ORIGIN+'/assets/stitch-exact/mrsaal-draft.webp';
const DESCRIPTIONS={
 ar:{
  home:'مرسال بيجهّز رسالة تقديم مناسبة لكل شركة من سيرتك الذاتية وقائمة الشركات، وإنت اللي بتراجع وتبعت من Gmail أو واتساب. جرّب مجانًا من غير بطاقة بنكية.',
  product:'اعرف إزاي مرسال بيحوّل سيرتك الذاتية وقائمة الشركات لمسودات مخصصة تراجعها بنفسك قبل الإرسال والجدولة من Gmail وواتساب.',
  plans:'باقات مرسال وحدود الإرسال والكتابة بالذكاء الاصطناعي لكل باقة. التجربة مجانية حاليًا من غير دفع أو بطاقة بنكية.',
  help:'مركز مساعدة مرسال: حلول لمشاكل ربط Gmail وواتساب والذكاء الاصطناعي ورفع الشركات وكتابة الرسائل.',
  blog:'أدلة مرسال العملية: تجهيز قوائم الشركات، كتابة رسائل التقديم، وإعداد قنوات الإرسال خطوة بخطوة.',
  about:'تعرّف على مرسال: أداة تساعدك تقدّم لشركات أكتر برسائل مخصصة، وإنت صاحب القرار في كل رسالة.',
  contact:'تواصل مع فريق مرسال لأي سؤال عن الحساب أو الباقات أو مشكلة في الإرسال.',
  privacy:'سياسة خصوصية مرسال: إزاي بنتعامل مع سيرتك الذاتية وبيانات الشركات وصلاحيات Gmail وواتساب.',
  terms:'شروط استخدام مرسال وقواعد الإرسال المسؤول والحدود المطبقة على الحسابات.'
 },
 en:{
  home:'Mrsaal drafts a tailored application message for each company from your CV and company list. You review and send through Gmail or WhatsApp. Try it free, no card.',
  product:'See how Mrsaal turns your CV and company list into personalised drafts you review before sending or scheduling through Gmail and WhatsApp.',
  plans:'Mrsaal plans, with the sending and AI writing limits of each. Free to try for now, with no payment or card required.',
  help:'Mrsaal help centre: fixes for connecting Gmail, WhatsApp and AI, importing companies and writing messages.',
  blog:'Practical Mrsaal guides: preparing company lists, writing application messages and setting up sending channels step by step.',
  about:'About Mrsaal: a tool that helps you apply to more companies with personalised messages while you stay in control of every one.',
  contact:'Contact the Mrsaal team about your account, plans or a sending problem.',
  privacy:'Mrsaal privacy policy: how your CV, company data and Gmail and WhatsApp permissions are handled.',
  terms:'Mrsaal terms of use, responsible-sending rules and the limits applied to accounts.'
 }
};
function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function clip(text,max=160){const value=String(text||'').replace(/\s+/g,' ').trim();return value.length>max?value.slice(0,max-1).replace(/\s+\S*$/,'')+'…':value;}
function seoTags({html,lang,page,post,suffix}){
 if(!html.includes('</head>')||/<meta\s+name="robots"\s+content="noindex"/.test(html))return html;
 const title=(html.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||'Mrsaal';
 const description=clip(post?post['excerpt_'+lang]||DESCRIPTIONS[lang].blog:(DESCRIPTIONS[lang][page]||DESCRIPTIONS[lang].home));
 const url=ORIGIN+'/'+lang+'/'+suffix;
 const tags=[];
 if(!/<meta\s+name="description"/.test(html))tags.push(`<meta name="description" content="${escape(description)}">`);
 if(!/<link[^>]*rel="canonical"/.test(html))tags.push(`<link rel="canonical" href="${escape(url)}">`);
 tags.push(
  `<meta property="og:type" content="${post?'article':'website'}">`,
  `<meta property="og:site_name" content="${lang==='en'?'Mrsaal':'مرسال'}">`,
  `<meta property="og:title" content="${title.replace(/"/g,'&quot;')}">`,
  `<meta property="og:description" content="${escape(description)}">`,
  `<meta property="og:url" content="${escape(url)}">`,
  `<meta property="og:locale" content="${lang==='en'?'en_US':'ar_AR'}">`,
  `<meta property="og:image" content="${IMAGE}">`,
  '<meta name="twitter:card" content="summary_large_image">'
 );
 return html.replace('</head>',tags.join('')+'</head>');
}
module.exports={seoTags,DESCRIPTIONS,ORIGIN};
