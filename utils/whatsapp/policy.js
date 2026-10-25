'use strict';
const messages={
 WA_RECIPIENT_FORMAT:'رقم المستلم لازم يكون بكود الدولة، مثل +201012345678 بدل 01012345678. عدّل رقم الشركة قبل الإرسال.',
 WA_NOT_CONNECTED:'واتساب غير متصل. انتظر الاتصال أو أعد الربط من الإعدادات.',
 WA_CONNECTION_CHANGED:'اتصال واتساب اتغيّر قبل الإرسال. لم تُرسل الرسالة؛ انتظر الاتصال وحاول تاني.',
 WA_LOOKUP_FAILED:'تعذر التحقق من رقم واتساب قبل الإرسال. لم تُرسل الرسالة؛ حاول لاحقًا.',
 WA_NUMBER_INVALID:'الرقم غير مسجل على واتساب.',
 WA_PREPARE_FAILED:'تعذر تجهيز رسالة واتساب قبل الإرسال. لم تُرسل الرسالة؛ حاول لاحقًا.',
 WA_SEND_UNCERTAIN:'قد تكون رسالة واتساب وصلت. راجع المحادثة والتقارير قبل إرسالها تاني.'
};
function error(code,status=409){return Object.assign(new Error(messages[code]||messages.WA_NOT_CONNECTED),{code,status,beforeSend:code!=='WA_SEND_UNCERTAIN',deliveryUncertain:code==='WA_SEND_UNCERTAIN'});}
function active(entry,sock){if(entry.cancelled||entry.sock!==sock||entry.status!=='connected')throw error('WA_CONNECTION_CHANGED');}
function reconnectDelay(attempt,random=Math.random){return Math.min(30000,1000*2**Math.min(attempt,5)+Math.floor(random()*500));}
async function lookup(sock,number,timeoutMs=20000){let timer;try{return await Promise.race([sock.onWhatsApp(number),new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('WA_LOOKUP_FAILED',503)),timeoutMs);})]);}catch(e){throw error('WA_LOOKUP_FAILED',503);}finally{clearTimeout(timer);}}
module.exports={error,active,reconnectDelay,lookup};
