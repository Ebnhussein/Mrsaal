'use strict';
const {createHash}=require('crypto');
function fail(message){throw Object.assign(new Error(message),{status:400,code:'ATS_INPUT'});}
function normalize(text){return String(text||'').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,n=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).replace(/[۰-۹]/g,n=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n))).toLowerCase();}
function tokens(text){return (normalize(text).match(/[\p{L}\p{N}][\p{L}\p{N}+#.\-]{0,40}/gu)||[]).map(w=>w.replace(/^[.\-]+|[.\-]+$/g,''));}
function keywords(text,job=''){
 if(typeof job!=='string'||job.length>12000)fail('وصف الوظيفة يجب أن يكون نصًا لا يزيد عن 12000 حرف.');
 const stop=new Set('the and for with that this from have will your you our are job role work team skills experience to of in on as be is at or a an we في من علي على الي الى إلى مع عن ان أن او أو و هذا هذه العمل خبرة سنوات مطلوب شركة'.split(' '));
 const terms=[...new Set(tokens(job))].filter(w=>(w.length>1||['c','r'].includes(w))&&!stop.has(w)&&!/^\d+$/.test(w)).slice(0,80),words=new Set(tokens(text));return terms.length?{matched:terms.filter(w=>words.has(w)),missing:terms.filter(w=>!words.has(w))}:null;
}
function report(text,source={},structured=null,job=''){
 const n=normalize(text),lines=n.split(/\r?\n/).map(s=>s.trim().replace(/[:：]$/,'')).filter(s=>s.length<90);
 const heading=pattern=>lines.some(s=>pattern.test(s)),hasEmail=/[^\s@|]+@[^\s@|]+\.[\p{L}]{2,}/u.test(n),hasPhone=(n.match(/\+?\d[\d ()-]{6,}\d/g)||[]).some(p=>{const d=p.replace(/\D/g,'');return d.length>=8&&d.length<=15&&!/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b/.test(p)&&!/(?:^|\s)(?:0?[1-9]|1[0-2])[-/](?:19|20)\d{2}/.test(p);});
 const readable=(n.match(/[\p{L}\p{N}]/gu)||[]).length>=40,layout=source.layout;
 const check=(id,status)=>({id,status,passed:status==='pass'}),present=v=>v?'pass':'warning';
 const completeDates=structured?[...structured.experience,...structured.education].every(r=>r.start&&(r.current||r.end)):null;
 const checks=[check('text',present(readable&&!source.partial&&!source.pagesWithNoText)),check('contact',present(hasEmail&&hasPhone)),check('summary',present(structured?!!structured.summary:heading(/^(?:professional summary|summary|profile|about me|objective|personal profile|الملخص(?: المهني)?|ملخص(?: مهني)?|نبذة(?: عني| مهنية)?|النبذة|الهدف(?: الوظيفي)?)$/))),check('skills',present(structured?!!structured.skills:heading(/^(?:(?:technical |core |key )?skills|core competencies|المهارات(?: التقنية| الفنية| الاساسية)?|مهاراتي|المهارات والكفاءات)$/))),check('evidence',present(structured?!!(structured.experience.length||structured.projects.length):heading(/^(?:(?:work |professional |relevant )?experience|work history|employment(?: history)?|projects|selected projects|الخبرات(?: العملية| المهنية)?|الخبرة(?: العملية| المهنية)?|خبرات العمل|المشروعات|المشاريع|الاعمال|اعمالي)$/))),check('education',present(structured?!!structured.education.length:heading(/^(?:education|academic background|qualifications|التعليم|المؤهلات(?: العلمية)?|الدراسة|المؤهل العلمي)$/))),check('dates',structured?present(completeDates):/\b(?:19|20)\d{2}\b/.test(n)?'unknown':'warning'),check('layout',layout?Object.values(layout).some(Boolean)?'warning':'pass':'unknown')];
 return {checks,keywords:keywords(text,job),advisory:true,source,readable,textPreview:String(text||'').slice(0,20000),previewTruncated:String(text||'').length>20000,scope:'local-readability',sourceHash:createHash('sha256').update(String(text||'')).digest('hex')};
}
async function analyze(row,job=''){
 keywords('',job);if(row?.kind==='portfolio')throw Object.assign(new Error('فحص ATS خاص بالسيرة الذاتية. البرتفوليو يعتمد على روابط أعمالك.'),{status:422,code:'ATS_PORTFOLIO'});
 const read=require('./read-document');let source,structured=null;
 if(row?.kind==='builder'&&row.document_json){structured=JSON.parse(row.document_json);source=await read.docx(await require('./document').render(structured));}
 else if(row?.attachment_data)source=await read.docx(Buffer.from(row.attachment_data));
 else if(row?.pdf_data)source=await read.pdf(Buffer.from(row.pdf_data));
 else source={text:String(row?.content||''),format:'text',bytes:Buffer.byteLength(row?.content||''),layout:null};
 const text=source.text;delete source.text;source.filename=row?.filename||'CV';source.attachment=!!(row?.pdf_data||row?.attachment_data||row?.kind==='builder');source.textDiffersFromSaved=source.attachment&&normalize(text).replace(/\s/g,'')!==normalize(row?.content).replace(/\s/g,'');return report(text,source,structured,job);
}
module.exports={report,analyze,keywords};
