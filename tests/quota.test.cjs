const test=require('node:test'),assert=require('node:assert/strict');
const {quota}=require('../utils/helpdesk');
test('quota limits a key per window and never locks out new keys when the table is full',()=>{
 for(let i=0;i<10050;i++)assert.equal(quota('flood:'+i,5),true);
 assert.equal(quota('fresh-visitor',5),true);
 for(let i=0;i<4;i++)quota('limited',5);
 assert.equal(quota('limited',5),true);
 assert.equal(quota('limited',5),false);
});
