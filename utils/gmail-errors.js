'use strict';
function gmailError(error){
 const message=String(error?.message||'');
 if(/Gmail API has not been used|gmail\.googleapis\.com.*disabled|SERVICE_DISABLED/i.test(message)){
  const e=new Error('خدمة Gmail غير مفعّلة في مشروع Google الخاص بمرسال. تواصل مع الدعم لتفعيل Gmail API، ثم جرّب بعد دقائق.');e.code='GMAIL_API_DISABLED';e.status=503;return e;
 }
 return error;
}
module.exports={gmailError};
