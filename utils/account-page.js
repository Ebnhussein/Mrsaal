'use strict';
const fs=require('fs'),path=require('path');
const form=fs.readFileSync(path.join(__dirname,'../public/account.html'),'utf8').match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
function accountContent(lang,page){
 const en=lang==='en',signup=page==='signup';
 const title=en?(signup?'Your next step starts here.':'Welcome back.'):(signup?'خطوتك الجاية تبدأ هنا.':'أهلًا بيك من تاني.');
 const desc=en?(signup?'Create your account, verify your email, then prepare your applications in one place.':'Sign in and pick up your applications where you left off.'):(signup?'اعمل حسابك، أكّد إيميلك، وبعدها جهّز تقديمك للشركات من مكان واحد.':'ادخل حسابك وكمّل تقديمك للشركات من مكان ما وقفت.');
 const items=en?['Your CV and companies in one place.','Your voice, with review before sending.','Connect Gmail or WhatsApp when you need them.']:['سيرتك وشركاتك في مكان واحد.','رسالة بأسلوبك، تراجعها قبل الإرسال.','اربط Gmail أو واتساب وقت ما تحتاجهم.'];
 let html=form;
 const values={
 'account-title':en?(signup?'Create your account':'Sign in'):(signup?'اعمل حسابك في مرسال':'تسجيل الدخول'),
 'account-description':desc,'name-label':en?'Name':'الاسم','email-label':en?'Email':'الإيميل','phone-label':en?'Phone with country code':'الموبايل بكود الدولة','password-label':en?'Password':'كلمة المرور','confirm-password-label':en?'Confirm password':'تأكيد كلمة المرور','account-submit':en?(signup?'Create account':'Sign in'):(signup?'إنشاء حساب':'دخول'),
 'account-signin':en?'Already have an account? Sign in':'عندك حساب؟ ادخل','account-signup':en?'New here? Create an account':'أول مرة؟ اعمل حساب','account-forgot':en?'Forgot password?':'نسيت كلمة المرور؟','account-google-label':en?'Continue with Google':'كمّل باستخدام Google','account-privacy':en?'Privacy':'الخصوصية','account-legal':en?'Terms':'الشروط'};
 for(const [id,value]of Object.entries(values))html=html.replace(new RegExp('(<[^>]+id="'+id+'"[^>]*>)[^<]*(</[^>]+>)'),(_,a,b)=>a+value+b);
 html=html.replace('href="/ar/"','href="/'+lang+'/"').replace('href="/ar/privacy"','href="/'+lang+'/privacy"').replace('href="/ar/terms"','href="/'+lang+'/terms"');
 if(en)html=html.replace('مرسال · Mrsaal','Mrsaal');
 // Initial HTML matches the destination even before the controller loads.
 for(const key of ['name','phone','confirm-password'])if(!signup){html=html.replace('id="account-'+key+'-group"','id="account-'+key+'-group" hidden');}
 if(!signup)html=html.replace('id="account-terms-group"','id="account-terms-group" hidden');
 html=html.replace('<a class="btn btn-secondary account-google"','<p class="account-divider">'+(en?'or continue with':'أو كمّل باستخدام')+'</p><a class="btn btn-secondary account-google"');
 return `<main class="auth-layout" data-auth-page="${page}"><aside class="auth-story"><span class="auth-eyebrow">MRSAAL / ${en?'YOUR APPLICATION WORKSPACE':'مساحة تقديمك'}</span><h1>${title}</h1><p>${desc}</p><ul>${items.map(item=>'<li><span aria-hidden="true">✓</span>'+item+'</li>').join('')}</ul><small>${en?'Free during beta. You stay in control of every send.':'مجاني خلال التجربة. وقرار الإرسال دايمًا ليك.'}</small></aside><section class="account-page auth-panel" aria-label="${en?(signup?'Create account':'Sign in'):(signup?'إنشاء حساب':'تسجيل الدخول')}">${html}</section></main>`;
}
module.exports={accountContent};
