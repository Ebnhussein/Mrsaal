const test=require('node:test'),assert=require('node:assert/strict');
const {renderExact}=require('../utils/stitch-render');
const {seoTags}=require('../utils/seo-tags');
const count=(html,pattern)=>(html.match(pattern)||[]).length;
for(const lang of ['ar','en'])for(const page of ['home','product','plans','help','about','contact']){
 test(`public ${lang}/${page} has description, canonical and social tags once`,()=>{
  const html=renderExact(page,'',{},lang);
  assert.equal(count(html,/<meta name="description" content="[^"]{40,160}">/g),1);
  assert.equal(count(html,/rel="canonical"/g),1);
  assert.equal(count(html,/property="og:title"/g),1);
  assert.equal(count(html,/property="og:image"/g),1);
  assert.ok(html.includes('href="https://mrsaal.ebnhussein.co/'+lang+'/'+(page==='home'?'':page)+'"'));
 });
}
test('noindex pages and pages with their own description are left alone',()=>{
 const noindex='<head><meta name="robots" content="noindex"></head>';
 assert.equal(seoTags({html:noindex,lang:'ar',page:'login',suffix:'login'}),noindex);
 const html=seoTags({html:'<head><title>T</title><meta name="description" content="mine"><link rel="canonical" href="x"></head>',lang:'en',page:'home',suffix:''});
 assert.equal(count(html,/name="description"/g),1);assert.equal(count(html,/rel="canonical"/g),1);
});
test('articles use their excerpt as description',()=>{
 const html=seoTags({html:'<head><title>Post</title></head>',lang:'en',page:'article',post:{excerpt_en:'A short excerpt about sending.'},suffix:'blog/x'});
 assert.match(html,/name="description" content="A short excerpt about sending\."/);assert.match(html,/og:type" content="article"/);
});
