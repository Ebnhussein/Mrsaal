const test=require('node:test'),assert=require('node:assert/strict');
const {linkFailureReason}=require('../utils/auth/link-failure');
test('failure reasons are short, secret-free and specific',()=>{
 assert.equal(linkFailureReason({response:{data:{error:'invalid_grant'}},message:'secret token abc'}),'invalid_grant');
 assert.equal(linkFailureReason(Object.assign(new Error('x'),{code:'ECONNRESET'})),'econnreset');
 assert.equal(linkFailureReason(new Error('أعد ربط Google ووافق على الصلاحيات للحصول على اتصال مستمر.')),'no_refresh_token');
 assert.equal(linkFailureReason(new Error('وافق على صلاحية الإرسال قبل ربط Gmail.')),'send_scope_missing');
 assert.equal(linkFailureReason(new Error('Google identity unavailable')),'identity_unavailable');
 assert.equal(linkFailureReason(new Error('Session changed')),'session_changed');
 assert.equal(linkFailureReason(new TypeError('something with token=abc123')),'typeerror');
 assert.equal(linkFailureReason(null),'error');
 for(const e of [new Error('a b c'),{response:{data:{error:'Bad Value!'}}},{code:'weird code!'}])assert.match(linkFailureReason(e),/^[a-z0-9_]{1,40}$/);
});
