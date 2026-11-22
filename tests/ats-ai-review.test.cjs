'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseJSON,verifyFacts}=require('../utils/cv/ai-review');

test('AI suggestions are parsed as a draft and limited to safe fields',()=>{
 const result=parseJSON(JSON.stringify({suggestions:[{category:'clarity',original:'Managed campaigns',suggestion:'Managed advertising campaigns',reason:'More specific',priority:'high'}],revisedText:'Jane Smith\njane@example.com\n+201000000000\nExperience\nManaged advertising campaigns'}));
 assert.equal(result.suggestions.length,1);
 assert.equal(result.suggestions[0].priority,'high');
 assert.match(result.revisedText,/Managed advertising campaigns/);
});

test('reject missing revised text',()=>assert.throws(()=>parseJSON('{"suggestions":[]}')));

test('flags new numerical claims for human review',()=>{
 const result=verifyFacts('Managed campaigns 2023-2025','Managed campaigns 2023-2025 increased ROAS by 80%');
 assert.equal(result.requiresReview,true);
 assert.ok(result.newNumbersOrEmails.includes('80%'));
});

test('preserved factual claims produce no numeric warning',()=>{
 const result=verifyFacts('Jane Smith +201000000000 2023','Jane Smith +201000000000 Experience 2023');
 assert.equal(result.requiresReview,false);
});
