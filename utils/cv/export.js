'use strict';
const {Document,Packer,Paragraph,TextRun,HeadingLevel,AlignmentType}=require('docx');
const headings=new Set(['professional summary','summary','experience','work experience','education','skills','projects','languages','الملخص المهني','الخبرات العملية','التعليم','المهارات','المشروعات','اللغات']);
async function renderText(content){
 const lines=String(content||'').slice(0,200000).split(/\r?\n/);
 const rtl=/[\u0600-\u06ff]/.test(lines.slice(0,12).join(' '));
 const paragraphs=lines.map((line,i)=>{
  const heading=headings.has(line.trim().toLowerCase());
  return new Paragraph({
   bidirectional:rtl,
   alignment:rtl?AlignmentType.RIGHT:AlignmentType.LEFT,
   heading:i===0?HeadingLevel.TITLE:heading?HeadingLevel.HEADING_2:undefined,
   spacing:{after:line.trim()?110:65},
   children:[new TextRun({text:line,rightToLeft:rtl})]
  });
 });
 return Packer.toBuffer(new Document({
  creator:'Mrsaal',
  title:'Application CV',
  styles:{default:{document:{run:{font:'Arial',size:21},paragraph:{spacing:{line:280}}}}},
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:950,bottom:950,left:950,right:950}}},children:paragraphs}]
 }));
}

function htmlEscape(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderPrintableHTML(content){
 const lines=String(content||'').slice(0,200000).replace(/\r\n?/g,'\n').split('\n');
 const name=(lines.shift()||'').trim(),role=(lines.shift()||'').trim(),contact=(lines.shift()||'').trim();
 const result=['<header class="cv-identity">','<h1>'+htmlEscape(name)+'</h1>'];
 if(role)result.push('<p class="cv-role">'+htmlEscape(role)+'</p>');
 if(contact)result.push('<p class="cv-contact">'+htmlEscape(contact)+'</p>');
 result.push('</header>');
 let sectionOpen=false,para=[];
 const flush=()=>{if(para.length){result.push('<p class="cv-paragraph">'+htmlEscape(para.join('\n'))+'</p>');para=[];}};
 for(const line of lines){
  const trimmed=line.trim();
  if(!trimmed){flush();continue;}
  if(headings.has(trimmed.toLowerCase())){
   flush();if(sectionOpen)result.push('</section>');
   result.push('<section class="cv-section"><h2>'+htmlEscape(trimmed)+'</h2>');sectionOpen=true;
  }else para.push(line);
 }
 flush();if(sectionOpen)result.push('</section>');
 return result.join('');
}
module.exports={renderText,renderPrintableHTML};

