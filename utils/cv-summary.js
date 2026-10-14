'use strict';
const {createHash}=require('crypto');
const MAX_CHARS=1800;
function hash(content){return createHash('sha256').update(String(content||'')).digest('hex');}
function approved(cv){return cv?.ai_summary_approved_at&&cv.ai_summary_source_hash===hash(cv.content)&&typeof cv.ai_summary==='string'&&cv.ai_summary.length<=MAX_CHARS?cv.ai_summary:'';}
// Extract only original text. This is a candidate, never an approved factual summary.
function propose(content){
 const source=String(content||'').replace(/\r/g,'').trim();if(source.length<=MAX_CHARS)return source;
 const seen=new Set();const lines=source.split(/\n+|(?<=[.!؟])\s+/).map(s=>s.trim()).filter(s=>s&&!seen.has(s)&&seen.add(s));
 const ranked=lines.map((text,index)=>({text,index,score:(index<2?10:0)+(/experience|skills|education|developer|marketing|university|degree|manager|خبر|مهار|تعليم|جامعة|مطور|تسويق|إدارة|مدير/i.test(text)?5:0)+( /\b(?:19|20)\d{2}\b/.test(text)?2:0)})).sort((a,b)=>b.score-a.score||a.index-b.index);
 const selected=[];let length=0;for(const line of ranked){if(length+line.text.length+1<=MAX_CHARS){selected.push(line);length+=line.text.length+1;}}
 return selected.sort((a,b)=>a.index-b.index).map(l=>l.text).join('\n');
}
function validate(text,confirmed){if(confirmed!==true||typeof text!=='string'||text.trim().length<30||text.trim().length>MAX_CHARS){const e=new Error('راجع الملخص وأكد صحته. الطول من 30 إلى 1800 حرف.');e.status=400;throw e;}return text.trim();}
module.exports={MAX_CHARS,hash,approved,propose,validate};
