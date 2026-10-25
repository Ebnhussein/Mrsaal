const test=require('node:test'),assert=require('node:assert/strict');
const {getAuthUrl,buildMimeMessage}=require('../utils/gmail/client');
const {canReadReplies}=require('../utils/gmail/accounts');
const SEND='https://www.googleapis.com/auth/gmail.send',READ='https://www.googleapis.com/auth/gmail.readonly';
process.env.GOOGLE_CLIENT_ID='id';process.env.GOOGLE_CLIENT_SECRET='secret';process.env.GOOGLE_REDIRECT_URI='https://example.com/cb';
const scopes=url=>new URL(url).searchParams.get('scope').split(' ');
test('linking asks for send only; reply tracking is requested explicitly and incrementally',()=>{
 const plain=new URL(getAuthUrl('s','link'));
 assert.ok(scopes(plain.href).includes(SEND));assert.ok(!scopes(plain.href).includes(READ));assert.equal(plain.searchParams.get('include_granted_scopes'),'true');
 assert.ok(scopes(getAuthUrl('s','link',{replies:true})).includes(READ));
 assert.ok(!scopes(getAuthUrl('s','login')).includes(SEND));
});
test('reply tracking is skipped only for accounts that were granted send without read',()=>{
 assert.equal(canReadReplies({scope:SEND+' email'}),false);
 assert.equal(canReadReplies({scope:SEND+' '+READ}),true);
 assert.equal(canReadReplies({}),true);
});
test('mail can be built without a Gmail profile call',()=>{assert.ok(buildMimeMessage({from:'a@b.co',to:'c@d.co',subject:'Hi',body:'Body'}).length>20);});
