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
