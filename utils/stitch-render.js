'use strict';
const fs=require('fs'),path=require('path');const cache=new Map();
const pages=new Set(['home','product','plans','login','about','contact','help','blog','privacy','terms','article']);
function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderExact(page,legacy,{posts=[],post=null}={}){
 if(!pages.has(page))return legacy;
 if(!cache.has(page))cache.set(page,fs.readFileSync(path.join(__dirname,'stitch-pages',page+'.html'),'utf8'));
 let html=cache.get(page);
 if(page==='blog')html=html.replace('@@POSTS@@',posts.length?'<div class="sx-post-grid">'+posts.map(p=>`<article class="sx-post" data-post-category="${escape(p.category)}"><small>${escape(p.category)}</small><h2>${escape(p.title_ar)}</h2><p>${escape(p.excerpt_ar)}</p><a href="/ar/blog/${encodeURIComponent(p.slug)}">قراءة المقال ←</a></article>`).join('')+'</div>':'<p class="sx-empty">المقالات قريبًا.</p>');
 if(['privacy','terms','article'].includes(page)){
  const content=legacy.match(/<main>([\s\S]*?)<\/main>/)?.[1]||'';
  html=html.replace('@@CONTENT@@','<div class="sx-content">'+content+'</div>');
 }
 if(post)html=html.replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+escape(post.title_ar)+' | مرسال</title>').replace(/<link[^>]*rel="canonical"[^>]*>/,()=>'<link rel="canonical" href="https://mrsaal.ebnhussein.co/ar/blog/'+encodeURIComponent(post.slug)+'">');
 return html;
}
module.exports={renderExact};
