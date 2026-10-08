const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('crypto'),fs=require('fs'),path=require('path');
const headers=require('../middleware/security-headers');
function response(secure){const out={};let next=false;headers({secure},{setHeader:(k,v)=>out[k]=v},()=>next=true);assert.equal(next,true);return out;}
test('security headers prohibit framing and only enable HSTS over HTTPS',()=>{
 const h=response(true);assert.equal(h['X-Frame-Options'],'DENY');assert.equal(h['X-Content-Type-Options'],'nosniff');assert.match(h['Content-Security-Policy'],/frame-ancestors 'none'/);assert.ok(h['Strict-Transport-Security']);assert.equal(response(false)['Strict-Transport-Security'],undefined);
});
test('every shipped inline script has an exact CSP hash; arbitrary script is not permitted',()=>{
 const csp=response(true)['Content-Security-Policy'];
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/i.test(m[1]))assert.ok(csp.includes(createHash('sha256').update(m[2]).digest('base64')));
 const script=csp.split('; ').find(s=>s.startsWith('script-src '));assert.ok(!script.includes('unsafe-inline'));assert.ok(!script.includes('unsafe-eval'));
});
