'use strict';
module.exports=function recentAuth(req,res,next){const time=req.session?.authenticatedAt;if(!Number.isFinite(time)||time>Date.now()+60000||Date.now()-time>15*60000)return res.status(401).json({error:'أكد هويتك بتسجيل الدخول من جديد قبل الإجراء ده.',code:'REAUTH_REQUIRED'});next();};
