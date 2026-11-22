'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const ats=require('../utils/cv/ats');
const {renderText}=require('../utils/cv/export');
const {docx}=require('../utils/cv/read-document');

test('keyword coverage is an advisory overlap metric, not acceptance probability',()=>{
 const result=ats.keywords('Python SQL dashboards', 'Requirements: Python SQL Excel');
 assert.ok(result);
 assert.equal(result.matched.includes('python'),true);
 assert.equal(result.matched.includes('sql'),true);
 assert.equal(result.missing.includes('excel'),true);
 assert.equal(result.matchPercent,Math.round(result.matchedCount/result.totalCount*100));
 assert.equal(result.advisory,true);
});

test('Arabic keywords are normalized without adding fictional skills',()=>{
 const result=ats.keywords('مهارات: إدارة الحملات وتحليل البيانات','إدارة الحملات والإعلانات');
 assert.ok(result.matched.includes('ادارة'));
 assert.ok(result.missing.includes('والاعلانات'));
});

test('report keeps readability separate from job matching',()=>{
 const result=ats.report('Jane Smith\njane@example.com\n+201012345678\nProfessional Summary\nExperienced in Python\nSkills\nPython\nExperience\nEngineer\nEducation\nUniversity',{format:'text',layout:null},null,'Python SQL');
 assert.equal(typeof result.readability.status,'string');
 assert.equal(typeof result.keywords.matchPercent,'number');
 assert.equal(result.advisory,true);
});

test('generated Word export preserves extractable text',async()=>{
 const buffer=await renderText('Jane Smith\njane@example.com\nSkills\nPython, SQL');
 assert.equal(buffer.slice(0,2).toString(),'PK');
 const parsed=await docx(buffer);
 assert.match(parsed.text,/Jane Smith/);
 assert.match(parsed.text,/Python, SQL/);
});


test('recognizes conventional headings after whitespace and punctuation normalization',()=>{
 const sample=[
  'Ahmed Hussein','ahmed@example.com | +201001234567','PROFESSIONAL SUMMARY:',
  'Performance marketer with project experience.','TECHNICAL SKILLS:','Meta Ads, Google Sheets',
  'WORK EXPERIENCE','Marketing specialist','2023 - 2025','EDUCATION','University studies'
 ].join('\n');
 const report=ats.report(sample,{format:'text',layout:null});
 for(const key of ['summary','skills','evidence','education']){
  assert.equal(report.checks.find(item=>item.id===key).status,'pass',key);
 }
 assert.equal(report.checks.find(item=>item.id==='contact').status,'pass');
});

test('unknown PDF headings need manual review rather than claiming absence',()=>{
 const result=ats.report('Ahmed Hussein\nahmed@example.com\n+201001234567\nDigital marketing specialist with experience in paid advertising campaigns',
 {format:'pdf',pages:1,layout:null});
 assert.equal(result.checks.find(c=>c.id==='skills').status,'unknown');
 assert.equal(result.checks.find(c=>c.id==='summary').status,'unknown');
 assert.equal(result.checks.find(c=>c.id==='layout').status,'unknown');
});

test('separates semantic content diagnostics and parser reliability',()=>{
 const result=ats.report('Jane Smith\njane@example.com\n+201001234567\nSummary\nManaged digital projects\nSkills\nSQL\nExperience\n2022 - 2024',
 {format:'docx',layout:{tables:true,columns:false,textBoxes:false,images:false,headersFooters:false}});
 assert.equal(result.checks.find(c=>c.id==='layout').status,'warning');
 assert.equal(result.summary.critical>=0,true);
 assert.equal(result.groups.length,2);
 assert.equal(result.groups[0].id,'parsing');
 assert.equal(result.advisory,true);
});

test('print view escapes arbitrary uploaded text and uses semantic headings',()=>{
 const {renderPrintableHTML}=require('../utils/cv/export');
 const html=renderPrintableHTML('Jane <script>alert(1)</script>\nMarketing Analyst\njane@example.com\n\nProfessional Summary\nExperienced in SQL');
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/<h2>Professional Summary<\/h2>/);
 assert.match(html,/<h1>Jane/);
});
