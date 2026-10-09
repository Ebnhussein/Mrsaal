'use strict';
const fs=require('fs'),path=require('path');const cache=new Map();const {mergeGuides}=require('./website-guides');
const {applyShell}=require('./website-shell');
const pages=new Set(['home','product','plans','login','signup','about','contact','help','blog','privacy','terms','article']);
function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const categories={writing:{ar:'كتابة الرسائل',en:'Writing messages'},sheets:{ar:'تجهيز القوائم',en:'Preparing lists'},channels:{ar:'قنوات الإرسال',en:'Sending channels'},ai:{ar:'إعداد الذكاء الاصطناعي',en:'AI setup'}};
function categoryKey(value){return Object.keys(categories).find(k=>k===value||Object.values(categories[k]).includes(value))||'other';}
function renderExact(page,legacy,{posts=[],post=null}={},language='ar'){
 if(!pages.has(page))return legacy;const lang=language==='en'?'en':'ar',key=lang+':'+page;
 if(!cache.has(key))cache.set(key,fs.readFileSync(path.join(__dirname,'stitch-pages',...(lang==='en'?['en']:[]),(page==='signup'?'login':page)+'.html'),'utf8'));
 let html=cache.get(key).replaceAll('ابدأ مجاناً بحساب Google','اعمل حسابك مجانًا').replaceAll('لا يلزم بطاقة ائتمانية • تفعيل فوري عبر حساب Google','بدون بطاقة بنكية • سجل بإيميلك أو Google').replaceAll('Start free with Google','Create your free account').replaceAll('No payment card required · Sign in with Google','No payment card required · Email or Google');
 if(page==='login'||page==='signup'){html=html.replace(/<main\b[\s\S]*?<\/main>/,()=>require('./account-page').accountContent(lang,page)).replace(/<title>[\s\S]*?<\/title>/,'<title>'+(lang==='en'?(page==='signup'?'Create account':'Sign in'):(page==='signup'?'إنشاء حساب':'تسجيل الدخول'))+' | Mrsaal</title>').replace('</head>','<meta name="robots" content="noindex"><link rel="stylesheet" href="/assets/account.css?v=auth-width-20261009-2"><script defer src="/assets/account.js?v=auth-width-20261009-2"></script></head>');}
 if(page==='blog'){
  const articles=mergeGuides(posts);html=html.replace('@@POSTS@@','<div class="sx-post-grid">'+articles.map(p=>{const key=categoryKey(p.category);return `<article class="sx-post" data-post-category="${key}">${p.image&&['draft','companies','channels'].includes(p.image)?`<img src="/assets/stitch-exact/mrsaal-${p.image}.webp" alt="" loading="lazy" width="1536" height="1024">`:''}<small>${escape(categories[key]?.[lang]||p.category)}</small><h2>${escape(p['title_'+lang])}</h2><p>${escape(p['excerpt_'+lang])}</p><a href="/${lang}/blog/${encodeURIComponent(p.slug)}">${lang==='en'?'Read the guide →':'اقرأ الدليل ←'}</a></article>`;}).join('')+'</div>');
 }
 if(['privacy','terms','article'].includes(page)){const content=legacy.match(/<main>([\s\S]*?)<\/main>/)?.[1]||'';html=html.replace('@@CONTENT@@','<div class="sx-content">'+content+'</div>');}
 if(post){
  const slug=encodeURIComponent(post.slug),other=lang==='en'?'ar':'en';
  html=html.replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+escape(post['title_'+lang])+' | Mrsaal</title>').replace(/<link[^>]*rel="canonical"[^>]*>/,()=>'<link rel="canonical" href="https://mrsaal.ebnhussein.co/'+lang+'/blog/'+slug+'">');
  html=html.replace(/(<a\b[^>]*data-language-toggle[^>]*href=")[^"]*("[^>]*>)/,(_,a,b)=>a+'/'+other+'/blog/'+slug+b);
 }
 const suffix=post?'blog/'+encodeURIComponent(post.slug):page==='home'?'':page;
 html=html.replace('</head>',`<link rel="alternate" hreflang="ar" href="https://mrsaal.ebnhussein.co/ar/${suffix}"><link rel="alternate" hreflang="en" href="https://mrsaal.ebnhussein.co/en/${suffix}"></head>`);
 return applyShell(html,lang,page,suffix);
}
module.exports={renderExact};
