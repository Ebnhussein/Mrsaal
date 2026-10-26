const test=require('node:test'),assert=require('node:assert/strict');
const {repliesIn}=require('../utils/gmail/reply-tracker');
const account={email:'me@gmail.com'};
const msg=(id,t,labels,from)=>({id,internalDate:String(t),labelIds:labels,payload:{headers:[{name:'From',value:from}]}});
test('a normal outreach ignores the sender\'s own messages and keeps the recipient\'s reply',()=>{
 const log={message_id:'orig',sent_at:1,company_email:'hr@company.com'};
 const out=repliesIn([msg('orig',1500,['SENT'],'me@gmail.com'),msg('r1',3000,['INBOX'],'HR <hr@company.com>'),msg('own',4000,['SENT'],'me@gmail.com')],log,account);
 assert.deepEqual(out.map(m=>m.id),['r1']);
});
test('a self-addressed message treats a later message in the thread as the reply',()=>{
 const log={message_id:'orig',sent_at:1,company_email:'Me@Gmail.com'};
 const out=repliesIn([msg('orig',1500,['SENT','INBOX'],'me@gmail.com'),msg('reply',3000,['SENT','INBOX'],'Me <me@gmail.com>')],log,account);
 assert.deepEqual(out.map(m=>m.id),['reply']);
});
test('self-addressed: the original message and anything older than the send are never replies',()=>{
 const log={message_id:'orig',sent_at:10,company_email:'me@gmail.com'};
 assert.deepEqual(repliesIn([msg('orig',10500,['SENT'],'me@gmail.com'),msg('old',5000,['INBOX'],'x@y.com')],log,account),[]);
});
