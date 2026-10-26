'use strict';
const fs=require('fs'),path=require('path');
const form=fs.readFileSync(path.join(__dirname,'../../public/account.html'),'utf8').match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
function accountContent(lang,page){
 const en=lang==='en',signup=page==='signup';
 const title=en?(signup?'Your next step starts here.':'Welcome back.'):(signup?'خطوتك الجاية تبدأ هنا.':'أهلًا بيك من تاني.');
 const desc=en?(signup?'Create your account, verify your email, then prepare your applications in one place.':'Sign in and pick up your applications where you left off.'):(signup?'اعمل حسابك، أكّد إيميلك، وبعدها جهّز تقديمك للشركات من مكان واحد.':'ادخل حسابك وكمّل تقديمك للشركات من مكان ما وقفت.');
 const items=en?['Your CV and companies in one place.','Your voice, with review before sending.','Connect Gmail or WhatsApp when you need them.']:['سيرتك وشركاتك في مكان واحد.','رسالة بأسلوبك، تراجعها قبل الإرسال.','اربط Gmail أو واتساب وقت ما تحتاجهم.'];
 let html=form;
 const values={
 'account-title':en?(signup?'Create your account':'Sign in'):(signup?'اعمل حسابك في مرسال':'تسجيل الدخول'),
 'account-description':desc,'name-label':en?'Name':'الاسم','email-label':en?'Email':'الإيميل','phone-label':en?'Phone with country code':'الموبايل بكود الدولة','password-label':en?'Password':'كلمة المرور','confirm-password-label':en?'Confirm password':'تأكيد كلمة المرور','account-submit':en?(signup?'Create account':'Sign in'):(signup?'إنشاء حساب':'دخول'),
 'account-signin':en?'Already have an account? Sign in':'عندك حساب؟ ادخل','account-signup':en?'Sign up':'اعمل حسابك','account-forgot':en?'Forgot password?':'نسيت كلمة المرور؟','account-google-label':en?'Continue with Google':'كمّل باستخدام Google','account-privacy':en?'Privacy':'الخصوصية','account-legal':en?'Terms':'الشروط'};
 for(const [id,value]of Object.entries(values))html=html.replace(new RegExp('(<[^>]+id="'+id+'"[^>]*>)[^<]*(</[^>]+>)'),(_,a,b)=>a+value+b);
 html=html.replace('href="/ar/"','href="/'+lang+'/"').replace('href="/ar/privacy"','href="/'+lang+'/privacy"').replace('href="/ar/terms"','href="/'+lang+'/terms"');
 if(en)html=html.replace('مرسال · Mrsaal','Mrsaal');
 // Initial HTML matches the destination even before the controller loads.
 for(const key of ['name','phone','confirm-password'])if(!signup){html=html.replace('id="account-'+key+'-group"','id="account-'+key+'-group" hidden');}
 if(!signup)html=html.replace('id="account-terms-group"','id="account-terms-group" hidden');
 // Keep the same authentication IDs and flow; reorganise presentation only.
 html=html.replace(/<button id="account-language"[\s\S]*?<\/button>/,'');
 const google=html.match(/<a class="btn btn-secondary account-google"[\s\S]*?<\/a>/)?.[0]||'';
 html=html.replace(google,'').replace('<form id="account-form">',google+'<p class="account-divider" id="account-divider">'+(en?'or use your email':'أو استخدم إيميلك')+'</p><form id="account-form">');
 const forgot=html.match(/<button class="btn btn-secondary" id="account-forgot"[\s\S]*?<\/button>/)?.[0]||'';
 html=html.replace(forgot,'').replace(/<label for="account-password" id="password-label">([\s\S]*?)<\/label>/,(_,text)=>'<div class="auth-password-heading"><label for="account-password" id="password-label">'+text+'</label>'+forgot+'</div>');
 for(const id of ['account-password','account-confirm-password'])html=html.replace(new RegExp('(<input[^>]*id="'+id+'"[^>]*>)'),(_,input)=>'<div class="auth-password-control">'+input+'<button type="button" class="auth-password-toggle" data-auth-password="'+id+'" aria-controls="'+id+'" aria-pressed="false">'+(en?'Show':'إظهار')+'</button></div>');
 html=html.replace('<nav class="launch-actions" id="account-navigation">','<nav class="launch-actions" id="account-navigation"><span id="account-switch-label">'+(en?(signup?'Already have an account?':'New to Mrsaal?'):(signup?'عندك حساب بالفعل؟':'لسه معندكش حساب؟'))+'</span>');
 const journey=en?[
  ['Your list. Your experience.','Add your own company list and CV.'],['A message in your voice.','Mrsaal AI helps tailor your message for each company.'],['Review. Send. Follow up.','Choose email or WhatsApp, then track your applications.']
 ]:[['قائمتك وخبرتك.','ضيف الشركات اللي اخترتها وسيرتك الذاتية.'],['رسالة بطريقتك.','مرسال AI يساعدك تجهّز رسالة مناسبة لكل شركة.'],['راجع، وابعت، وتابع.','اختار الإيميل أو واتساب وتابع تقديماتك.']];
 return `<main class="auth-layout" data-auth-page="${page}" data-auth-mode="${signup?'signup':'signin'}"><aside class="auth-story"><span class="auth-eyebrow">${en?'YOUR NEXT STEP, IN YOUR VOICE':'خطوتك الجاية، بطريقتك'}</span><h2>${en?'Your experience.<br>Your voice. Your next step.':'قدّم خبرتك صح،<br>برسالة تناسب كل شركة.'}</h2><p>${en?'You bring the companies and your CV. Mrsaal brings your application steps together.':'إنت بتضيف الشركات وسيرتك الذاتية، ومرسال بينظّم خطوات تقديمك من مكان واحد.'}</p><ol class="auth-journey">${journey.map(([heading,body],i)=>`<li><span class="auth-journey-number" aria-hidden="true">0${i+1}</span><div><h3>${heading}</h3><p>${body}</p></div></li>`).join('')}</ol><div class="auth-beta-note"><span aria-hidden="true">✓</span><p>${en?'All features are free until launch. No payment card needed.':'كل المميزات مجانية لحد الإطلاق، من غير بطاقة بنكية.'}</p></div></aside><section class="account-page auth-panel" aria-label="${en?(signup?'Create account':'Sign in'):(signup?'إنشاء حساب':'تسجيل الدخول')}">${html}</section></main>`;
}
module.exports={accountContent};
