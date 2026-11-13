'use strict';
const {createHash}=require('crypto');
function fail(message){throw Object.assign(new Error(message),{status:400});}
function text(v,max=200){if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))fail('راجع طول الحقول والبيانات المكتوبة.');return v.trim();}
function url(v){const s=text(v,500);if(!s)return '';let u;try{u=new URL(s);}catch{fail('اكتب رابطًا كاملًا يبدأ بـ https://');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)fail('الرابط لازم يكون HTTP أو HTTPS ومن غير كلمة مرور.');return u.href;}
function list(v,limit,fn){if(v==null)return [];if(!Array.isArray(v)||v.length>limit)fail('عدد العناصر أكبر من الحد المتاح.');if(v.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('بيانات الصف غير صالحة.');return v.map(fn);}
function date(v){const s=text(v,7);if(s&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))fail('التاريخ بصيغة YYYY-MM.');return s;}
function normalize(input){
 if(!input||!['cv','portfolio'].includes(input.kind))fail('اختار CV أو برتفوليو.');
 const d={kind:input.kind,language:input.language==='ar'?'ar':'en',name:text(input.name),title:text(input.title),email:text(input.email,254),phone:text(input.phone,60),location:text(input.location),summary:text(input.summary,2400),website:url(input.website),skills:text(input.skills,1500),languages:text(input.languages,600)};
 if(!d.name||!d.title)fail('اكتب اسمك ومجالك أو المسمى الوظيفي.');
 if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))fail('راجع البريد الإلكتروني.');
 if(!d.email&&!d.phone)fail('اكتب وسيلة تواصل واحدة على الأقل.');
 d.experience=list(input.experience,12,r=>{const a={title:text(r.title),organization:text(r.organization),start:date(r.start),end:date(r.end),current:r.current===true,description:text(r.description,1800)};if(!a.title||!a.organization)fail('اكتب المسمى واسم الشركة لكل خبرة أو احذف الصف الفاضي.');if(a.start&&a.end&&!a.current&&a.end<a.start)fail('تاريخ النهاية قبل البداية.');return a;});
 d.education=list(input.education,8,r=>{const a={title:text(r.title),organization:text(r.organization),start:date(r.start),end:date(r.end),description:text(r.description,1200)};if(!a.title||!a.organization)fail('اكتب المؤهل وجهة الدراسة أو احذف الصف الفاضي.');if(a.start&&a.end&&a.end<a.start)fail('راجع تواريخ الدراسة.');return a;});
 d.projects=list(input.projects,12,r=>{const a={title:text(r.title),role:text(r.role),url:url(r.url),description:text(r.description,1800)};if(!a.title||!a.description)fail('كل مشروع محتاج اسم ووصف لدورك أو العمل.');if(d.kind==='portfolio'&&!a.url)fail('ضيف رابط لكل عمل في البرتفوليو.');return a;});
 if(d.kind==='portfolio'&&!d.projects.length)fail('ضيف عمل واحد على الأقل ورابطه.');
 if(Buffer.byteLength(JSON.stringify(d))>65000)fail('الملف كبير. اختصر التفاصيل.');return d;
}
const headings={en:{summary:'Professional Summary',experience:'Experience',education:'Education',skills:'Skills',languages:'Languages',projects:'Projects',present:'Present'},ar:{summary:'الملخص المهني',experience:'الخبرات العملية',education:'التعليم',skills:'المهارات',languages:'اللغات',projects:'المشروعات',present:'حتى الآن'}};
function content(d){const h=headings[d.language],lines=[d.name,d.title,[d.email,d.phone,d.location,d.website].filter(Boolean).join(' | ')];
 const section=(title,rows)=>{if(rows.length)lines.push('',title,...rows);};
 section(h.summary,d.summary?[d.summary]:[]);section(h.experience,d.experience.flatMap(r=>[r.title+' | '+r.organization,[r.start,r.current?h.present:r.end].filter(Boolean).join(' – '),r.description,''].filter(Boolean)));
 section(h.education,d.education.flatMap(r=>[r.title+' | '+r.organization,[r.start,r.end].filter(Boolean).join(' – '),r.description,''].filter(Boolean)));
 section(h.skills,d.skills?[d.skills]:[]);section(h.languages,d.languages?[d.languages]:[]);section(h.projects,d.projects.flatMap(r=>[r.title+(r.role?' | '+r.role:''),r.description,r.url,''].filter(Boolean)));return lines.join('\n');}
function fingerprint(d){return createHash('sha256').update(JSON.stringify(d)).digest('hex');}
function report(d,job=''){
 const checks=[['contact',!!d.email&&!!d.phone],['summary',!!d.summary],['skills',!!d.skills],['evidence',!!(d.experience.length||d.projects.length)],['education',!!d.education.length],['dates',d.experience.every(r=>r.start&&(r.current||r.end))&&d.education.every(r=>r.start&&r.end)],['layout',true],['text',true]];
 const stop=new Set('the and for with that this from have will your you our are job role work team skills experience في من على إلى مع عن أن ان أو او و هذا هذه العمل خبرة سنوات مطلوب شركة'.split(' '));
 const tokens=[...new Set(text(job,12000).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+#.\-]{1,40}/gu)||[])].filter(w=>!stop.has(w)&&!/^\d+$/.test(w)).slice(0,80);
 const words=new Set((content(d).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+#.\-]{1,40}/gu)||[]));
 return {checks:checks.map(([id,passed])=>({id,passed})),keywords:tokens.length?{matched:tokens.filter(w=>words.has(w)),missing:tokens.filter(w=>!words.has(w))}:null,advisory:true};
}
function facts(row){if(row?.kind!=='portfolio')return {cv:row?.content||'',cvSummary:require('./summary').approved(row)};
 return {cv:row.content,cvSummary:require('./summary').approved(row),applicationMode:'portfolio',portfolioLinks:JSON.parse(row.document_json||'{}').projects?.map(p=>p.url).filter(Boolean)||[]};}
function finalize(result,args){if(args.applicationMode!=='portfolio')return result;const links=args.portfolioLinks||[];const missing=links.filter(link=>!result.body.includes(link));return {...result,body:[result.body,...missing].join('\n\n')};}
async function attachment(row){if(!row||row.kind==='portfolio')return null;if(row.kind==='builder')return {data:await require('./document').render(JSON.parse(row.document_json)),filename:'CV.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};return row.pdf_data?{data:row.pdf_data,filename:row.filename||'CV.pdf',mimeType:'application/pdf'}:null;}
module.exports={normalize,content,fingerprint,report,facts,finalize,attachment,headings};
