const test=require('node:test'),assert=require('node:assert/strict');
const Module=require('module');
const dbPath=require.resolve('../utils/db');
let used=0;
const fake={get:async()=>({n:used}),run:async()=>{},all:async()=>[]};
require.cache[dbPath]=Object.assign(new Module(dbPath),{exports:fake,loaded:true,filename:dbPath});
const safety=require('../utils/whatsapp/safety');
const clean=()=>{delete process.env.WHATSAPP_DAILY_CAP;delete process.env.WHATSAPP_MIN_DELAY_SECONDS;};
test('WhatsApp campaigns are never paced faster than the safe minimum; email keeps the old floor',()=>{
 clean();
 assert.equal(safety.delayFor('whatsapp',5),45);assert.equal(safety.delayFor('whatsapp',undefined),45);assert.equal(safety.delayFor('whatsapp',120),120);
 assert.equal(safety.delayFor('whatsapp',9999),300);assert.equal(safety.delayFor('email',1),5);assert.equal(safety.delayFor('email',60),60);
 process.env.WHATSAPP_MIN_DELAY_SECONDS='90';assert.equal(safety.delayFor('whatsapp',10),90);
 process.env.WHATSAPP_MIN_DELAY_SECONDS='1';assert.equal(safety.minDelay(),45);clean();
});
test('daily cap blocks before any send, with a typed non-uncertain error',async()=>{
 clean();used=99;await safety.assertWithinDailyCap('u1');
 used=100;await assert.rejects(safety.assertWithinDailyCap('u1'),e=>e.code==='WA_DAILY_CAP'&&e.status===429&&e.beforeSend===true);
 process.env.WHATSAPP_DAILY_CAP='5';used=5;await assert.rejects(safety.assertWithinDailyCap('u1'),/5 رسالة/);
 process.env.WHATSAPP_DAILY_CAP='abc';assert.equal(safety.dailyCap(),100);clean();
});
