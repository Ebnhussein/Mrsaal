'use strict';
const {TextDecoder}=require('util');
function invalid(message){const e=new Error(message);e.status=400;throw e;}
function extension(file){return String(file.originalname||'').toLowerCase().split('.').at(-1);}
function isPDF(file){return Buffer.isBuffer(file.buffer)&&/^\s*%PDF-/.test(file.buffer.subarray(0,1024).toString('latin1'));}
function textFile(buffer){try{let encoding='utf-8',bytes=buffer;if(buffer[0]===0xff&&buffer[1]===0xfe){encoding='utf-16le';bytes=buffer.subarray(2);}else if(buffer[0]===0xfe&&buffer[1]===0xff){encoding='utf-16be';bytes=buffer.subarray(2);}const text=new TextDecoder(encoding,{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');if(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text))invalid('الملف ليس نصًا صالحًا.');return text;}catch(e){if(e.status)throw e;invalid('احفظ الملف بترميز UTF-8 أو UTF-16 ثم ارفعه من جديد.');}}
function cvKind(file){if(isPDF(file))return 'pdf';if(extension(file)==='pdf'||file.mimetype==='application/pdf')invalid('الملف لا يحتوي على PDF صالح. نزّله من تطبيق الملفات ثم جرّب رفعه.');if(extension(file)==='txt'||file.mimetype==='text/plain'){textFile(file.buffer);return 'text';}invalid('ارفع PDF أو ملف نص TXT. ملفات Word والصور تحتاج تحويلًا إلى PDF نصي أولًا.');}
function spreadsheetRows(file,XLSX){
 if(!file?.buffer?.length)invalid('ملف الشركات فارغ.');const b=file.buffer,ext=extension(file);const zip=b[0]===0x50&&b[1]===0x4b&&b[2]===3&&b[3]===4;const ole=b.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));let workbook;
 try{
  if(zip||ole)workbook=XLSX.read(b,{type:'buffer',sheetRows:10002,cellText:true});
  else {if(!['csv','tsv','txt'].includes(ext)&&!/^text\//.test(file.mimetype||''))invalid('ارفع XLSX أو XLS أو CSV. ملف Excel يجب تنزيله كملف وليس مشاركته كرابط.');if(['xlsx','xls'].includes(ext))invalid('ملف Excel غير صالح.');const text=textFile(b);workbook=XLSX.read(text,{type:'string',raw:true,sheetRows:10002});}
 }catch(e){if(e.status)throw e;invalid('تعذر قراءة ملف الشركات. لو عليه كلمة مرور أزلها، أو صدّره كـ XLSX أو CSV UTF-8.');}
 const sheet=workbook.Sheets[workbook.SheetNames[0]];if(!sheet)invalid('الملف لا يحتوي على ورقة بيانات.');
 const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:false});if(rows.length<2)invalid('الملف يحتاج صف عناوين وصف بيانات على الأقل.');if(rows.length>10001)invalid('قسّم الملف إلى أجزاء لا تزيد عن 10,000 صف بيانات.');const width=rows.reduce((max,row)=>Math.max(max,row.length),0);if(width>200)invalid('الملف فيه أعمدة كثيرة؛ احتفظ بأعمدة الشركات فقط.');return {rows,width,sheetName:workbook.SheetNames[0]};
}
function column(value,width,required=false){if(value==null||value===''){if(required)invalid('اختار عمود اسم الشركة.');return -1;}const text=String(value);if(!/^\d+$/.test(text))invalid('اختيار عمود غير صالح.');const index=Number(text);if(index>=width)invalid('العمود المختار غير موجود في الملف.');return index;}
module.exports={isPDF,cvKind,textFile,spreadsheetRows,column};
