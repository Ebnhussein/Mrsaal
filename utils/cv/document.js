'use strict';
const {Document,Packer,Paragraph,TextRun,HeadingLevel}=require('docx');
const {content,headings}=require('./builder');
async function render(data){const h=headings[data.language],rtl=data.language==='ar',titles=new Set(Object.values(h));
 const children=content(data).split('\n').map((line,i)=>new Paragraph({bidirectional:rtl,heading:i===0?HeadingLevel.TITLE:titles.has(line)?HeadingLevel.HEADING_1:undefined,spacing:{after:100},children:[new TextRun({text:line,rightToLeft:rtl})]}));
 return Packer.toBuffer(new Document({creator:'Mrsaal',title:'CV',styles:{default:{document:{run:{font:'Arial',size:22},paragraph:{spacing:{line:276}}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:850,bottom:850,left:850,right:850}}},children}]}));}
module.exports={render};
