'use strict';
const {createHash}=require('crypto');
const MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const hash=v=>createHash('sha256').update(v).digest('hex');
function error(message,code='CV_TAILOR_INPUT',status=422){throw Object.assign(new Error(message),{code,status});}
function input(v,max){if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))error('راجع المسمى ووصف الوظيفة.');return v.trim();}
function metadata(row){return typeof row?.tailoring_json==='string'?JSON.parse(row.tailoring_json):row?.tailoring_json;}
function validate(row,company){if(row?.kind==='tailored'&&metadata(row)?.companyId!==company.id)error('نسخة السيرة دي مخصصة لشركة مختلفة. افتح معاينة الشركة من جديد.','CV_TAILOR_COMPANY',409);return row;}
function validateSource(row,sourceId,company){if(!row||!(row.kind==='portfolio'?row.id===sourceId:row.kind==='tailored'&&metadata(row)?.sourceId===sourceId))error('راجع النسخة المخصصة من سيرة الحملة أولًا.','CV_TAILOR_REQUIRED',409);return validate(row,company);}
async function render(text,rtl){const {Document,Packer,Paragraph,TextRun}=require('docx');return Packer.toBuffer(new Document({creator:'Mrsaal',title:'Application CV',styles:{default:{document:{run:{font:'Arial',size:22},paragraph:{spacing:{line:276}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:850,bottom:850,left:850,right:850}}},children:text.split('\n').map(line=>new Paragraph({bidirectional:rtl,spacing:{after:90},children:[new TextRun({text:line,rightToLeft:rtl})]}))}]}));}
const sectionHeading=/^(?:professional summary|summary|profile|experience|work experience|professional experience|education|skills|technical skills|projects|languages|الملخص المهني|الخبرات العملية|التعليم|المهارات|المشروعات|المشاريع|اللغات)[:：]?$/i;
function focused(text,job){
 // Keep the identity block and every original section. Prioritise whole relevant sections;
 // never move individual employment dates away from their employer or invent keywords.
 const headings=sectionHeading;
 const chunks=[[]];for(const line of text.split(/\r?\n/)){if(headings.test(line.trim()))chunks.push([]);chunks.at(-1).push(line);}
 const score=lines=>require('./ats').keywords(lines.join('\n'),job)?.matched.length||0;
 return [chunks[0],...chunks.slice(1).map((lines,i)=>({lines,i,score:score(lines)})).sort((a,b)=>b.score-a.score||a.i-b.i).map(s=>s.lines)].map(lines=>lines.join('\n')).join('\n');
}
async function refreshSummary(db,userId,row,source){const summary=require('./summary'),text=summary.approved(source)||'';if((row.ai_summary||'')!==text){await db.run('UPDATE cv_profiles SET ai_summary=$1,ai_summary_source_hash=$2,ai_summary_approved_at=CASE WHEN length($1)>0 THEN NOW() ELSE NULL END WHERE id=$3 AND user_id=$4',[text,text?summary.hash(row.content):null,row.id,userId]);return {...row,ai_summary:text,ai_summary_source_hash:text?summary.hash(row.content):null,ai_summary_approved_at:text?new Date():null};}return row;}
async function prepare(userId,company,source,options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))error('اختيارات التخصيص غير صالحة.');
 const db=require('../db'),store=require('./store');if(!source)error('ضيف سيرة ذاتية أولًا.');
 if(source.kind==='portfolio')return source;
 if(source.kind==='tailored'){validate(source,company);if(!Object.keys(options).length){const original=await store.active(userId,metadata(source).sourceId);if(!original)error('السيرة الأصلية غير متاحة.');return refreshSummary(db,userId,source,original);}source=await store.active(userId,metadata(source).sourceId);if(!source)error('السيرة الأصلية غير متاحة.');}
 let jobDescription=input(options.jobDescription,12000),role=input(options.role,160),jobId=input(options.jobId,160);
 if(jobId){const job=await db.get('SELECT * FROM discovered_jobs WHERE id=$1 AND user_id=$2 AND company_id=$3',[jobId,userId,company.id]);if(!job||job.status==='needs_review')error('اختار إعلان وظيفة محفوظ لنفس الشركة.');jobDescription=input(job.description,12000);role=input(job.title,160);}
 if(!role){const t=await db.get('SELECT instructions FROM templates WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',[userId]);role=input(require('../ai/writing-profile').decode(t?.instructions).role,160);}
 const read=require('./read-document');let parsed;
 if(source.kind==='builder')parsed=await read.docx(await require('./document').render(JSON.parse(source.document_json)));
 else if(source.attachment_data)parsed=await read.docx(Buffer.from(source.attachment_data));
 else if(source.pdf_data)parsed=await read.pdf(Buffer.from(source.pdf_data));
 else parsed={text:source.content||'',format:'text'};
 if(parsed.partial||parsed.pagesWithNoText||!require('./ats').report(parsed.text).readable)error('المرفق غير مقروء بالكامل. ارفع نسخة نصية كاملة قبل تخصيص السيرة.','CV_TAILOR_UNREADABLE');
 if(parsed.text.length>180000)error('اختصر السيرة قبل تخصيصها.');
 const companyName=input(company.name,200),key=hash(JSON.stringify({version:2,source:source.id,text:hash(parsed.text),companyId:company.id,companyName,role,jobDescription,jobId}));
 const existing=await db.get("SELECT * FROM cv_profiles WHERE user_id=$1 AND kind='tailored' AND tailoring_json->>'key'=$2",[userId,key]);if(existing)return refreshSummary(db,userId,existing,source);
 const rtl=source.document_json?JSON.parse(source.document_json).language==='ar':(parsed.text.match(/[\u0600-\u06ff]/g)||[]).length>parsed.text.length/4;
 const target=(rtl?'جهة التقديم: ':'Application target: ')+companyName+(role?' · '+role:'');
 const ordered=focused(parsed.text,jobDescription||[role,company.field].filter(Boolean).join(' ')).split('\n'),sectionStart=ordered.findIndex((line,i)=>i>0&&sectionHeading.test(line.trim()));ordered.splice(sectionStart<0?ordered.length:sectionStart,0,'',target,'');
 const content=ordered.join('\n'),data=await render(content,rtl),checked=await read.docx(data);
 const report=require('./ats').report(checked.text,{...checked,text:undefined},null,jobDescription);report.keywords=require('./ats').keywords(parsed.text,jobDescription);report.keywordScope='source-facts';
 const name='CV-'+companyName.replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,70)+(role?'-'+role.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,40):'')+'.docx';
 const details={key,targetLine:target,companyId:company.id,companyName,sourceId:source.id,sourceFilename:source.filename,role,jobDescription,jobId,sourceFormat:parsed.format,report,method:'facts-only-section-order'};
 let id;try{id=await store.save(userId,{content:checked.text,filename:name,name,kind:'tailored',attachment_data:data,tailoring_json:JSON.stringify(details),ai_summary:require('./summary').approved(source)});}catch(e){if(e.code!=='23505')throw e;return db.get("SELECT * FROM cv_profiles WHERE user_id=$1 AND kind='tailored' AND tailoring_json->>'key'=$2",[userId,key]);}
 return store.active(userId,id);
}
function view(row){if(row.kind==='portfolio')return {id:row.id,portfolio:true};const m=metadata(row);return {id:row.id,filename:row.filename,companyId:m.companyId,companyName:m.companyName,role:m.role,jobId:m.jobId,jobDescription:m.jobDescription,sourceId:m.sourceId,sourceFilename:m.sourceFilename,content:row.content,report:m.report,url:'/api/cv/attachment?cvId='+encodeURIComponent(row.id)};}
module.exports={prepare,validate,validateSource,view,metadata,focused,render,MIME};
