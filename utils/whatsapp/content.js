
'use strict';
function formatWhatsAppText(body){
 if(typeof body!=='string'||!body.trim())throw new Error('نص رسالة واتساب مطلوب');
 let text=body.replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 // Respect existing paragraph breaks. Add paragraphs only to a long single line.
 if(!text.includes('\n')&&text.length>240){
  const parts=text.split(/(?<=[.!?؟])\s+(?=[\p{L}])/u);const paragraphs=[];let current='';
  for(const part of parts){if(current.length>120){paragraphs.push(current);current='';}current+=(current?' ':'')+part;}
  if(current)paragraphs.push(current);text=paragraphs.join('\n\n');
 }
 return text;
}
function buildWhatsAppContent(body,attachment){
 const text=formatWhatsAppText(body);
 if(!attachment)return {text};
 if(!Buffer.isBuffer(attachment.data)||!attachment.data.length)throw new Error('ملف السيرة الذاتية غير صالح. أعد رفع PDF.');
 if(attachment.mimeType&&attachment.mimeType!=='application/pdf')throw new Error('مرفق السيرة الذاتية يجب أن يكون PDF.');
 let filename=String(attachment.filename||'CV.pdf').replace(/[\r\n\x00-\x1f/\\]/g,'').slice(0,150)||'CV.pdf';
 if(!/\.pdf$/i.test(filename))filename+='.pdf';
 return {document:attachment.data,mimetype:'application/pdf',fileName:filename,caption:text};
}
module.exports={formatWhatsAppText,buildWhatsAppContent};
