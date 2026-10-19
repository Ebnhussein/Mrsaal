'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const guard=require('../middleware/recent-auth');
function check(middleware,session){let passed=false,code,status;middleware({session},{status(value){status=value;return this;},json(data){code=data.code;}},()=>passed=true);return {passed,code,status};}
test('WhatsApp accepts authentication within 24 hours without extending it; sensitive actions retain 15 minutes',()=>{
 const session={authenticatedAt:Date.now()-2*60*60000};const original=session.authenticatedAt;
 assert.equal(check(guard.whatsapp,session).passed,true);assert.equal(session.authenticatedAt,original);
 assert.equal(check(guard,session).passed,false);assert.equal(check(guard,{authenticatedAt:Date.now()-10*60000}).passed,true);
 assert.equal(check(guard.whatsapp,{authenticatedAt:Date.now()-23*60*60000}).passed,true);
 assert.deepEqual(check(guard.whatsapp,{authenticatedAt:Date.now()-24*60*60000-1000}),{passed:false,code:'REAUTH_REQUIRED',status:401});
});
test('WhatsApp rejects missing, forged or future authentication on other sessions',()=>{
 for(const session of [undefined,{}, {authenticatedAt:'1790000000000'},{authenticatedAt:NaN},{authenticatedAt:Infinity},{authenticatedAt:Date.now()+120000}])assert.equal(check(guard.whatsapp,session).passed,false);
});
