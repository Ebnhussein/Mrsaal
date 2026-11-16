'use strict';
const MAX_XML=2*1024*1024,MAX_TEXT=200000,MAX_PAGES=20;
function invalid(message,code='CV_PARSE_FAILED'){throw Object.assign(new Error(message),{status:422,code});}
function decode(s){return s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,x=>{const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(named[x])return named[x];const n=x[2]?.toLowerCase()==='x'?parseInt(x.slice(3,-1),16):Number(x.slice(2,-1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';});}
function xmlText(xml){return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<\/w:p\s*>|<w:(?:br|tab)\b[^>]*\/?>/g)].map(m=>m[1]!==undefined?decode(m[1]):m[0].includes('tab')?'\t':'\n').join('').replace(/\n{3,}/g,'\n\n').trim();}
async function entryText(entry){return new Promise((resolve,reject)=>{let length=0;const chunks=[],stream=entry.nodeStream('nodebuffer');stream.on('data',chunk=>{length+=chunk.length;if(length>MAX_XML){stream.destroy();reject(Object.assign(new Error('ملف Word يحتوي على بيانات أكبر من حد القراءة. اختصره أو صدّره PDF نصيًا.'),{status:422,code:'CV_PARSE_LIMIT'}));}else chunks.push(chunk);});stream.on('error',reject);stream.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));});}
async function docx(buffer){
 let zip;try{zip=await require('jszip').loadAsync(buffer);}catch{invalid('ملف Word تالف أو مشفر. أعد تصديره بصيغة DOCX.');}
 if(Object.keys(zip.files).length>3000||Object.keys(zip.files).some(n=>/vbaProject|\.bin$/i.test(n)))invalid('ارفع ملف DOCX نصيًا بدون وحدات ماكرو أو ملفات مضمنة.');
 const entry=zip.file('word/document.xml');if(!entry||!zip.file('[Content_Types].xml')||!zip.file('_rels/.rels'))invalid('الملف ليس مستند Word DOCX صالحًا.');const packageTypes=await entryText(zip.file('[Content_Types].xml'));if(/macroEnabled|<!DOCTYPE|<!ENTITY/i.test(packageTypes))invalid('ارفع ملف DOCX عاديًا بدون وحدات ماكرو.');const xml=await entryText(entry);if(/<!DOCTYPE|<!ENTITY/i.test(xml))invalid('بنية ملف Word غير مدعومة. أعد تصديره بدون محتوى مضمّن.');
 let text=xmlText(xml);const auxiliary=Object.values(zip.files).filter(f=>/^word\/(?:header|footer)\d+\.xml$/.test(f.name));if(auxiliary.length>30)invalid('الملف يحتوي على أجزاء كثيرة. صدّره كـ DOCX مبسط.');
 for(const part of auxiliary){text+='\n'+xmlText(await entryText(part));if(text.length>MAX_TEXT)invalid('نص الملف أكبر من حد القراءة.','CV_PARSE_LIMIT');}
 if(text.length>MAX_TEXT)invalid('نص الملف أكبر من حد القراءة.','CV_PARSE_LIMIT');
 return {text:text.trim(),format:'docx',bytes:buffer.length,layout:{tables:/<w:tbl\b/.test(xml),columns:[...xml.matchAll(/<w:cols\b[^>]*w:num=["'](\d+)["']/g)].some(m=>Number(m[1])>1),textBoxes:/<w:txbxContent\b/.test(xml),images:/<w:(?:drawing|pict)\b/.test(xml),headersFooters:auxiliary.length>0}};
}
async function pdf(buffer){
 let pagesWithNoText=0;const pages=[];let result;
 try{result=await require('pdf-parse')(new Uint8Array(buffer),{max:MAX_PAGES,pagerender:async page=>{const tc=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});let lastY=null,lastEnd=null,text='';for(const item of tc.items){const y=item.transform?.[5],x=item.transform?.[4];if(lastY!==null&&Math.abs(y-lastY)>2){text+='\n';}else if(lastEnd!==null&&x-lastEnd>1)text+=' ';text+=item.str||'';lastY=y;lastEnd=Number.isFinite(x)?x+(item.width||0):null;}if(!text.trim())pagesWithNoText++;pages.push(text);return text;}});}catch{invalid('تعذر قراءة PDF. قد يكون تالفًا أو محميًا بكلمة مرور. أعد تصديره كـ PDF نصي.');}
 const text=result.text||'';if(text.length>MAX_TEXT)invalid('نص الملف أكبر من حد القراءة.','CV_PARSE_LIMIT');return {text,format:'pdf',bytes:buffer.length,pages:result.numpages,scannedPages:result.numrender,partial:result.numpages>MAX_PAGES,pagesWithNoText:pagesWithNoText+Math.max(0,result.numrender-pages.length),layout:null};
}
async function upload(file){const kind=require('../upload-files').cvKind(file);if(kind==='pdf')return pdf(file.buffer);if(kind==='docx')return docx(file.buffer);const text=require('../upload-files').textFile(file.buffer);if(text.length>MAX_TEXT)invalid('نص الملف أكبر من حد القراءة.','CV_PARSE_LIMIT');return {text,format:'text',bytes:file.buffer.length,layout:null};}
module.exports={pdf,docx,upload,MAX_PAGES,MAX_TEXT};
