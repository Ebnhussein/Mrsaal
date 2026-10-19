'use strict';
// Absolute age of the server-recorded authentication, never extended by activity.
function withMaxAge(maxAge){
 return function recentAuth(req,res,next){
  const time=req.session?.authenticatedAt,now=Date.now();
  if(!Number.isFinite(time)||time>now+60000||now-time>maxAge)return res.status(401).json({error:'أكد هويتك بتسجيل الدخول من جديد قبل الإجراء ده.',code:'REAUTH_REQUIRED'});
  next();
 };
}
const recentAuth=withMaxAge(15*60000);
// Only WhatsApp linking mutations use the longer, session-bound window.
recentAuth.whatsapp=withMaxAge(24*60*60000);
module.exports=recentAuth;
