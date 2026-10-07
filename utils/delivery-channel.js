'use strict';
function hasEmail(c){return typeof c.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim());}
function hasPhone(c){const n=String(c.phone||'').replace(/\D/g,'');return n.length>=7&&n.length<=15;}
function chooseChannel(c,requested){
 if(requested!==undefined&&requested!==null&&!['email','whatsapp'].includes(requested)){
  const e=new Error('اختار الإيميل أو الواتساب للإرسال');e.status=400;throw e;
 }
 // Legacy requests retain their previous behaviour; the UI always sends a channel.
 return requested||(hasEmail(c)?'email':'whatsapp');
}
function skipReason(c,channel){return channel==='email'?(hasEmail(c)?null:'تخطي: لا يوجد إيميل صالح للشركة'):(hasPhone(c)?null:'تخطي: لا يوجد رقم صالح للشركة');}
function destination(c,channel){return channel==='email'?c.email:c.phone;}
module.exports={hasEmail,hasPhone,chooseChannel,skipReason,destination};
