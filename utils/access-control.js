'use strict';
const {get}=require('./db');const {adminEmail}=require('./helpdesk');
async function checkToolAccess(id,allowIncomplete=false){
 const user=await get('SELECT email,suspended_at,suspension_reason,registration_required FROM users WHERE id=$1',[id]);
 if(!user){const e=new Error('انتهت الجلسة. سجّل الدخول مرة أخرى.');e.status=401;throw e;}
 if(adminEmail(user.email))return;
 if(user.suspended_at){const e=new Error('استخدام الأداة معلّق لهذا الحساب. تواصل مع الدعم.');e.status=403;e.code='ACCOUNT_SUSPENDED';throw e;}
 if(user.registration_required&&!allowIncomplete){const e=new Error('كمّل اسمك ورقم الموبايل قبل استخدام الأداة.');e.status=403;e.code='PROFILE_INCOMPLETE';throw e;}
 const settings=await get('SELECT tool_paused FROM website_settings WHERE id=1');
 if(settings?.tool_paused){const e=new Error('الأداة متوقفة مؤقتًا للصيانة. الدعم متاح.');e.status=503;e.code='TOOL_PAUSED';throw e;}
}
async function gate(req,res,next){try{if(/^\/api\/launch\/(export|delete)$/.test(req.path))return next();if(req.session?.userId&&req.path.startsWith('/api/')&&!/^\/api\/(tickets|admin|notifications)(\/|$)/.test(req.path))await checkToolAccess(req.session.userId);next();}catch(e){res.status(e.status||500).json({error:(!e.status||e.status===500)?'حصلت مشكلة مؤقتة. حاول مرة أخرى.':e.message,code:e.code});}}
module.exports={checkToolAccess,gate};
