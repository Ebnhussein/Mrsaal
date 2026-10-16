'use strict';
// One responsive navigation shell for the public website (not the workspace).
const copy={ar:{brand:'مرسال',menu:'فتح القائمة',close:'إغلاق القائمة',theme:'تبديل المظهر',language:'تبديل اللغة',start:'ابدأ تقديمك',login:'تسجيل الدخول',tag:'شركاتك، ورسائلك، ومتابعتك في مكان واحد',nav:'التنقل الرئيسي',bottom:'التنقل السريع',links:['الرئيسية','المميزات','الخطط','الدليل','الدعم','عن مرسال','تواصل معنا']},en:{brand:'Mrsaal',menu:'Open menu',close:'Close menu',theme:'Change appearance',language:'Change language',start:'Start applying',login:'Sign in',tag:'Your companies, messages and follow-ups in one workspace',nav:'Main navigation',bottom:'Quick navigation',links:['Home','Features','Plans','Guides','Help','About','Contact']}};
const pages=['home','product','plans','blog','help','about','contact'];
const icons=['home','apps','payments','auto_stories','support_agent','info','alternate_email'];
function shell(lang,page,suffix){
 const c=copy[lang],other=lang==='ar'?'en':'ar';
 const href=p=>'/'+lang+'/'+(p==='home'?'':p);
 const selected=p=>p===page||(page==='article'&&p==='blog');
 const links=(list,mode)=>list.map(p=>{const i=pages.indexOf(p);return `<a href="${href(p)}" class="sx-nav-link${selected(p)?' is-current':''}"${selected(p)?' aria-current="page"':''}>${mode==='desktop'?'':`<span class="material-symbols-outlined" aria-hidden="true">${icons[i]}</span>`}<span>${c.links[i]}</span></a>`;}).join('');
 const brand=`<a class="sx-site-brand" href="${href('home')}"><img src="/assets/favicon.svg" alt="" width="32" height="32"><span>${c.brand}</span></a>`;
 const header=`<header class="sx-site-header"><div class="sx-header-inner"><div class="sx-header-brand"><button id="mrsaal-drawer-toggle" class="sx-icon-button sx-drawer-button" aria-controls="mrsaal-drawer" aria-expanded="false" aria-label="${c.menu}"><span class="material-symbols-outlined" aria-hidden="true">menu</span></button>${brand}</div><nav class="sx-desktop-nav" aria-label="${c.nav}">${links(pages.slice(0,5),'desktop')}</nav><div class="sx-header-actions"><a class="sx-language-button" data-language-toggle href="/${other}/${suffix}" aria-label="${c.language}">${other==='en'?'EN':'عربي'}</a><button class="sx-icon-button" data-theme-toggle aria-label="${c.theme}"><span class="material-symbols-outlined" aria-hidden="true">dark_mode</span></button><a class="sx-header-login" href="${href('login')}">${c.login}</a><a class="sx-header-start" href="${href('signup')}">${c.start}</a></div></div></header><div id="mrsaal-drawer-overlay" class="sx-drawer-overlay" hidden></div><aside id="mrsaal-drawer" class="sx-site-drawer" role="dialog" aria-modal="true" aria-label="${c.nav}" hidden><div class="sx-drawer-top">${brand}<button id="mrsaal-drawer-close" class="sx-icon-button" aria-label="${c.close}"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></div><p class="sx-drawer-tag">${c.tag}</p><nav aria-label="${c.nav}">${links(pages,'drawer')}</nav><div class="sx-drawer-preferences"><a class="sx-language-button" href="/${other}/${suffix}" aria-label="${c.language}">${other==='en'?'EN':'عربي'}</a><button class="sx-icon-button" data-theme-toggle aria-label="${c.theme}"><span class="material-symbols-outlined" aria-hidden="true">dark_mode</span></button></div><div class="sx-drawer-actions"><a class="sx-header-login" href="${href('login')}">${c.login}</a><a class="sx-header-start" href="${href('signup')}">${c.start}</a></div></aside>`;
 const bottom=`<nav class="sx-bottom-nav" aria-label="${c.bottom}"><div>${links(pages.slice(0,5),'bottom')}</div></nav>`;
 const footer=`<footer class="sx-mobile-footer">${brand}<p>${c.tag}</p><details class="sx-footer-more"><summary>${lang==='ar'?'روابط مرسال':'Explore Mrsaal'}</summary><nav aria-label="${c.nav}">${links(pages.slice(1),'desktop')}</nav></details><div class="sx-footer-legal"><a href="${href('privacy')}">${lang==='ar'?'الخصوصية':'Privacy'}</a><a href="${href('terms')}">${lang==='ar'?'الشروط والأحكام':'Terms'}</a></div><small>© ${new Date().getUTCFullYear()} ${c.brand}</small></footer>`;
 return {header,bottom,footer};
}
function applyShell(html,lang,page,suffix){
 html=html.replace(/<a\b[^>]*href="\/(ar|en)\/login"[^>]*>[\s\S]*?<\/a>/g,tag=>/ابدأ|ابدأ الآن|إنشاء حساب|سجل مجان|Start|Get started|Try free|Create account/i.test(tag.replace(/<[^>]*>/g,''))?tag.replace('/'+lang+'/login','/'+lang+'/signup'):tag);
 const {header,bottom,footer}=shell(lang,page,suffix);
 // The old blog includes its drawer between header and main and its bottom nav after main.
 html=html.replace(/<header\b[\s\S]*?<\/header>([\s\S]*?)(?=<main\b)/,header);
 html=html.replace(/<\/main><nav\b[\s\S]*?<\/nav>(?=<\/body>)/,'</main>');
 html=html.replace('</body>',footer+bottom+'</body>');
 // Inactive footer spans from the imported design must be real links.
 html=html.replace(/<span class="hover:text-on-surface cursor-pointer">(الخصوصية|Privacy)<\/span>/g,`<a href="/${lang}/privacy">$1</a>`).replace(/<span class="hover:text-on-surface cursor-pointer">(الشروط والأحكام|Terms(?: and conditions)?)<\/span>/g,`<a href="/${lang}/terms">$1</a>`);
 return html.replaceAll('v=bilingual-1','v=responsive-2');
}
module.exports={applyShell};
