'use strict';
const {isAdmin}=require('../utils/support/helpdesk');
module.exports=async function adminSession(req,res,next){
 if(!req.session?.userId||req.session.authMethod==='google'||!(/^\/api\//.test(req.path)||['/app','/admin'].includes(req.path))||/^\/api\/launch\/(export|delete)$/.test(req.path))return next();
 try{if(!await isAdmin(req.session.userId))return next();if(req.path.startsWith('/api/'))return res.status(401).json({error:'دخول الإدارة يحتاج تسجيل الدخول بحساب Google المعتمد. حساب البريد يظل لتسجيل المستخدمين العاديين.',code:'ADMIN_GOOGLE_REQUIRED'});return res.redirect('/ar/login?reauth=1');}catch(error){next(error);}
};
