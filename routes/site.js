'use strict';
const router=require('express').Router();const path=require('path');const {all,get}=require('../utils/db');const wrap=require('../middleware/async-handler');const {render,escapeHTML}=require('../utils/site-template');const {isAdmin}=require('../utils/helpdesk');const {checkToolAccess}=require('../utils/access-control');
const {guides,mergeGuides}=require('../utils/website-guides');
const publicDir=path.join(__dirname,'../public');
router.get('/',wrap(async(req,res)=>{const q=new URLSearchParams();for(const k of ['error','linked'])if(typeof req.query[k]==='string')q.set(k,req.query[k].slice(0,80));res.redirect((req.session?.userId?(q.has('linked')?'/app':await isAdmin(req.session.userId)?'/admin':'/app'):q.has('error')?'/ar/login':'/ar/')+(q.size?'?'+q:' ' ).trim());}));
router.get('/app',wrap(async(req,res)=>{
 res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex'});
 if(!req.session?.userId)return res.redirect('/ar/login');
 try{await checkToolAccess(req.session.userId);}catch(e){return res.status(e.status||403).send(render('ar','suspended',{custom:'<section class="m-section"><h1>الأداة غير متاحة حاليًا</h1><p>'+escapeHTML(e.message)+'</p><button class="m-button" id="blocked-support">تواصل مع الدعم</button><a class="m-button" href="/auth/logout">خروج</a><script src="/assets/tickets.js" defer></script><script src="/assets/blocked-support.js" defer></script></section>'}));}
 res.sendFile(path.join(publicDir,'index.html'));
}));
router.get('/admin',wrap(async(req,res)=>{
 res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex'});if(!req.session?.userId)return res.redirect('/ar/login');if(!await isAdmin(req.session.userId))return res.status(403).send('للإدارة فقط');
 res.send(render(req.query.lang==='en'?'en':'ar','admin',{custom:'<div class="admin-shell"><aside class="admin-rail"><a class="m-brand" href="/ar/"><span class="m-mark"><img src="/assets/favicon.svg" alt=""></span><span>مرسال<small>لوحة الإدارة</small></span></a><nav class="admin-tabs" aria-label="أقسام الإدارة"><button class="m-button" data-tab="overview">نظرة عامة</button><button class="m-button" data-tab="users">المستخدمون</button><button class="m-button" data-tab="posts">المقالات</button><button class="m-button" data-tab="support">الدعم والأخطاء</button><button class="m-button" data-tab="settings">التشغيل والسجل</button></nav><div class="admin-rail-footer"><a href="/app">فتح مساحة مرسال ←</a><a href="/auth/logout">تسجيل خروج</a></div></aside><section class="admin-main"><header class="admin-top"><div><h1>إدارة مرسال</h1><p>المستخدمون والدعم والمحتوى، في مكان واحد.</p></div><div class="m-tools"><button class="m-button" data-admin-theme>تبديل المظهر</button><a class="m-button" href="/app">فتح التطبيق</a></div></header><p role="status" aria-live="polite" id="admin-message"></p><div id="admin-content" class="admin-panel"></div></section></div>'}));
}));
const pages=new Set(['product','blog','plans','help','login','about','contact','privacy','terms']);
router.get('/:lang(ar|en)/blog/:slug',wrap(async(req,res)=>{const post=await get("SELECT * FROM website_posts WHERE slug=$1 AND status='published'",[req.params.slug])||guides.find(g=>g.slug===req.params.slug);if(!post)return res.status(404).send('Article not found');res.send(render(req.params.lang,'article',{post}));}));
router.get('/:lang(ar|en)/:page?',wrap(async(req,res,next)=>{
 const page=req.params.page||'home';if(page!=='home'&&!pages.has(page))return next();
 if(page==='login'&&req.session?.userId)return res.redirect(await isAdmin(req.session.userId)?'/admin':'/app');
 
 const posts=page==='blog'?await all("SELECT slug,category,title_ar,title_en,excerpt_ar,excerpt_en FROM website_posts WHERE status='published' ORDER BY published_at DESC"):[];
 let html=render(req.params.lang,page,{posts});if(page==='login'&&req.query.error)html=html.replace(/<main[^>]*>/,'$&<div class="m-inline-notice" role="alert">'+(req.params.lang==='ar'?'تعذر تسجيل الدخول. حاول مرة أخرى؛ إذا استمرت المشكلة تواصل مع إدارة مرسال.':'Sign-in failed. Please try again or contact the Mrsaal administrator.')+'</div>');res.send(html);
}));
router.get('/sitemap.xml',wrap(async(req,res)=>{const posts=mergeGuides(await all("SELECT slug FROM website_posts WHERE status='published'"));const urls=['home','product','blog','plans','help','about','contact','privacy','terms'];res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['ar','en'].flatMap(l=>[...urls.map(p=>`<url><loc>https://mrsaal.ebnhussein.co/${l}/${p==='home'?'':p}</loc></url>`),...posts.map(p=>`<url><loc>https://mrsaal.ebnhussein.co/${l}/blog/${escapeHTML(encodeURIComponent(p.slug))}</loc></url>`)]).join('')+'</urlset>');}));
module.exports=router;
