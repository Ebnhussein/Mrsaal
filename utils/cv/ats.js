'use strict';
const {createHash}=require('crypto');
function fail(message){throw Object.assign(new Error(message),{status:400,code:'ATS_INPUT'});}
function normalize(text){return String(text||'').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,n=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))).replace(/[۰-۹]/g,n=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n))).toLowerCase();}
function tokens(text){return (normalize(text).match(/[\p{L}\p{N}][\p{L}\p{N}+#.\-]{0,40}/gu)||[]).map(w=>w.replace(/^[.\-]+|[.\-]+$/g,''));}
function keywords(text,job=''){
 if(typeof job!=='string'||job.length>12000)fail('وصف الوظيفة يجب أن يكون نصًا لا يزيد عن 12000 حرف.');
 const stop=new Set('the and for with that this from have will your you our are job role work team skills experience to of in on as be is at or a an we who what when where highly ability strong good excellent must should preferred plus apply equal opportunity employer company responsibilities requirements qualifications required preferred position successful candidate years year knowledge understanding working etc في من علي على الي الى إلى مع عن ان أن او أو و هذا هذه العمل خبرة سنوات مطلوب شركة المؤهلات الشروط المهام المتطلبات المتقدم المرشح مطلوبه المطلوبة يفضل لديه لدينا'.split(' '));
 const clean=words=>words.filter(w=>(w.length>1||['c','r'].includes(w))&&!stop.has(w)&&!/^\d+$/.test(w));
 const terms=[...new Set(clean(tokens(job)))].slice(0,80);
 const words=new Set(tokens(text)),matched=terms.filter(w=>words.has(w)),missing=terms.filter(w=>!words.has(w));
 const percent=terms.length?Math.round(matched.length/terms.length*100):null;
 return terms.length?{matched,missing,matchPercent:percent,matchedCount:matched.length,totalCount:terms.length,method:'unique-terms',advisory:true}:null;
}

const CATEGORY={
 text:'parsing',contact:'identity',summary:'sections',skills:'sections',
 evidence:'experience',education:'sections',dates:'experience',layout:'formatting',
 achievements:'content',length:'content',job:'matching'
};
const HEADING_RULES={
 summary:/^(?:(?:professional|career|personal|executive)\s+(?:summary|profile)|summary|profile|about\s+me|objective|ملخص(?:\s+مهني)?|الملخص(?:\s+المهني)?|نبذة(?:\s+عنّي|\s+عني|\s+مهنية)?|النبذة|الهدف(?:\s+الوظيفي)?)$/iu,
 skills:/^(?:(?:(?:technical|core|key|professional|relevant)\s+)?skills|core\s+competencies|competencies|technologies|مهارات(?:ي|\s+(?:الاساسية|الأساسية|التقنية|الفنية))?|المهارات(?:\s+(?:الاساسية|الأساسية|التقنية|الفنية))?|المهارات\s+والكفاءات)$/iu,
 evidence:/^(?:(?:(?:work|professional|relevant|employment)\s+)?experience|work\s+history|employment(?:\s+history)?|projects|selected\s+projects|الخبرات(?:\s+(?:العملية|المهنية))?|الخبرة(?:\s+(?:العملية|المهنية))?|خبرات\s+العمل|المشروعات|المشاريع|الأعمال|اعمالي)$/iu,
 education:/^(?:education|academic\s+background|qualifications|academic\s+qualifications|التعليم|المؤهلات(?:\s+العلمية)?|الدراسة|المؤهل\s+العلمي)$/iu
};
function headingLines(text){
 const raw=normalize(text).split(/\r?\n/);
 const lines=[];
 for(const original of raw){
  const line=original.trim().replace(/^[•●▪\-–|:：\s]+|[:：\s]+$/g,'').replace(/\s+/g,' ');
  if(line.length<95)lines.push(line);
  // PDF parsers occasionally place adjacent sections on one text item.
  // Detect headings at the start of a text line but never inside arbitrary prose.
  const prefix=line.match(/^(professional summary|career summary|work experience|professional experience|technical skills|core skills|education|experience|projects|skills|الملخص المهني|الخبرات العملية|المهارات|التعليم)\s*[:：\-–]\s*.+/iu);
  if(prefix)lines.push(prefix[1]);
 }
 return lines;
}
function sectionPresent(lines,id){
 return lines.some(line=>HEADING_RULES[id].test(line));
}
function meaningfulEvidence(text){
 const n=normalize(text);
 return /(?:increased|reduced|improved|delivered|managed|built|launched|optimized|saved|achieved|حققت|ادرت|طورت|انشات|نفذت|زودت|خفضت|حسنت)/iu.test(n)
  && /(?:\d+\s*%|\d[\d,.]*\s*(?:users|clients|customers|campaigns|projects|عميل|مشروع|حملة|جنيه|دولار)|\d{2,})/iu.test(n);
}
function report(text,source={},structured=null,job=''){
 const raw=String(text||''),n=normalize(raw),lines=headingLines(raw);
 const hasEmail=/[^\s@|<>]+@[^\s@|<>]+\.[\p{L}]{2,}/u.test(n);
 const hasPhone=(n.match(/\+?\d[\d ()-]{6,}\d/g)||[]).some(p=>{
  const d=p.replace(/\D/g,'');
  return d.length>=8&&d.length<=15&&!/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b/.test(p)
   &&!/(?:^|\s)(?:0?[1-9]|1[0-2])[-/](?:19|20)\d{2}/.test(p);
 });
 const readable=(n.match(/[\p{L}\p{N}]/gu)||[]).length>=40;
 const layout=source.layout,partial=!!(source.partial||source.pagesWithNoText),format=source.format||'text';
 const structuredList=key=>Array.isArray(structured?.[key])?structured[key]:[];
 const completeness=structured?
  [...structuredList('experience'),...structuredList('education')].every(item=>item.start&&(item.current||item.end)):null;
 const years=[...n.matchAll(/\b(?:19|20)\d{2}\b/g)].length;
 const detectedHeadings=Object.keys(HEADING_RULES).filter(id=>sectionPresent(lines,id));
 const kws=keywords(raw,job);
 const check=(id,status,detail,priority='medium')=>({
  id,status,passed:status==='pass',category:CATEGORY[id],priority,
  detail,action:id==='text'?'verify-extraction':id==='layout'?'review-layout':id==='job'?'compare-job':'edit-section'
 });
 const hasSummary=structured?!!structured.summary?.trim():detectedHeadings.includes('summary');
 const hasSkills=structured?!!structured.skills?.trim():detectedHeadings.includes('skills');
 const hasEvidence=structured?!!(structuredList('experience').length||structuredList('projects').length):detectedHeadings.includes('evidence');
 const hasEducation=structured?!!structuredList('education').length:detectedHeadings.includes('education');
 // Absence of a heading in a PDF does not prove the section is missing;
 // the parser may have merged its heading with the body.
 const pdfUncertain=format==='pdf';
 const optionalStatus=present=>present?'pass':pdfUncertain?'unknown':'warning';
 const checks=[
  check('text',readable&&!partial?'pass':'warning',readable&&!partial?'text-extracted':'missing-or-incomplete-text','high'),
  check('contact',hasEmail&&hasPhone?'pass':hasEmail||hasPhone?'warning':'warning',hasEmail&&hasPhone?'both-contact-methods':'missing-contact-method','high'),
  check('summary',optionalStatus(hasSummary),hasSummary?'section-detected':'section-not-confirmed'),
  check('skills',optionalStatus(hasSkills),hasSkills?'section-detected':'section-not-confirmed'),
  check('evidence',optionalStatus(hasEvidence),hasEvidence?'section-detected':'section-not-confirmed','high'),
  check('education',hasEducation?'pass':pdfUncertain?'unknown':'warning',hasEducation?'section-detected':'section-not-confirmed','low'),
  check('dates',structured?(completeness?'pass':'warning'):years?'unknown':'warning',structured?(completeness?'dates-complete':'dates-incomplete'):'dates-require-manual-review'),
  check('layout',layout?Object.values(layout).some(Boolean)?'warning':'pass':'unknown',layout?'layout-inspected':'layout-not-inspectable'),
  check('achievements',meaningfulEvidence(raw)?'pass':'unknown',meaningfulEvidence(raw)?'evidence-found':'verify-achievements','low'),
  check('length',tokens(raw).length>1600?'warning':'pass',tokens(raw).length>1600?'long-resume':'length-within-guideline','low')
 ];
 const warnings=checks.filter(c=>c.status==='warning'),uncertain=checks.filter(c=>c.status==='unknown');
 const issues=[];
 if(!readable)issues.push('No readable text was detected');
 if(partial)issues.push('Document parsing is incomplete');
 if(layout&&Object.values(layout).some(Boolean))issues.push('Complex layout may disrupt extraction');
 if(!hasEmail||!hasPhone)issues.push('Contact information needs review');
 const output={
  checks,keywords:kws,advisory:true,source,readable,
  readability:{status:!readable||partial?'needs-attention':layout&&Object.values(layout).some(Boolean)?'review':'readable',
   issues,wordCount:tokens(raw).length,detectedHeadings},
  groups:[
   {id:'parsing',checks:checks.filter(c=>['text','layout'].includes(c.id))},
   {id:'content',checks:checks.filter(c=>!['text','layout'].includes(c.id))}
  ],
  summary:{passed:checks.filter(c=>c.passed).length,needsAttention:warnings.length,manualReview:uncertain.length,
   critical:warnings.filter(c=>c.priority==='high').length,version:2},
  textPreview:raw.slice(0,20000),previewTruncated:raw.length>20000,scope:'local-readability',
  sourceHash:createHash('sha256').update(raw).digest('hex')
 };
 return output;
}

async function analyze(row,job=''){
 keywords('',job);if(row?.kind==='portfolio')throw Object.assign(new Error('فحص ATS خاص بالسيرة الذاتية. البرتفوليو يعتمد على روابط أعمالك.'),{status:422,code:'ATS_PORTFOLIO'});
 const read=require('./read-document');let source,structured=null;
 if(row?.kind==='builder'&&row.document_json){structured=JSON.parse(row.document_json);source=await read.docx(await require('./document').render(structured));}
 else if(row?.attachment_data)source=await read.docx(Buffer.from(row.attachment_data));
 else if(row?.pdf_data)source=await read.pdf(Buffer.from(row.pdf_data));
 else source={text:String(row?.content||''),format:'text',bytes:Buffer.byteLength(row?.content||''),layout:null};
 const text=source.text;delete source.text;source.filename=row?.filename||'CV';source.attachment=!!(row?.pdf_data||row?.attachment_data||row?.kind==='builder');source.textDiffersFromSaved=source.attachment&&normalize(text).replace(/\s/g,'')!==normalize(row?.content).replace(/\s/g,'');const result=report(text,source,structured,job);if(row?.kind==='tailored'){const m=require('./tailor').metadata(row);result.keywords=keywords(text.split('\n').filter(line=>line!==m?.targetLine).join('\n'),job);result.keywordScope='source-facts';}return result;
}
module.exports={report,analyze,keywords};
