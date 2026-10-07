'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function load(file,deps={}){const context={__dirname:path.dirname(path.join(__dirname,'..',file)),module:{exports:{}},require:id=>Object.hasOwn(deps,id)?deps[id]:require(id),Buffer,URL,URLSearchParams,Date,Map,console,process:{env:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);return context.module.exports;}
const mail=load('utils/gmail.js',{googleapis:{google:{}}});
test('MIME parses as plain/HTML alternatives and byte-identical PDF with Arabic filename',()=>{
 const bytes=Buffer.from('%PDF-1.4\noriginal CV bytes\x00\xff');
 const raw=mail.buildMimeMessage({from:'sender@gmail.com',to:'jobs@example.com',subject:'طلب تقديم أحمد حسين',body:'أهلًا <script>\nالسطر الثاني\n\nفقرة تانية',trackingPixelUrl:'https://mrsaal.ebnhussein.co/track/open/id.gif',attachment:{data:bytes,filename:'سيرتي.pdf'}});
 const code=`import sys,email,json,base64\nfrom email.policy import default\nm=email.message_from_bytes(base64.urlsafe_b64decode(sys.stdin.read()+'==='),policy=default)\np=list(m.walk())\nprint(json.dumps({'subject':str(m['Subject']),'filename':p[-1].get_filename(),'pdf':base64.b64encode(p[-1].get_payload(decode=True)).decode(),'plain':p[2].get_content(),'html':p[3].get_content(),'types':[x.get_content_type() for x in p],'defects':[str(x.defects) for x in p]}))`;
 const parsed=JSON.parse(execFileSync('python3',['-c',code],{input:raw,encoding:'utf8'}));
 assert.deepEqual(parsed.types,['multipart/mixed','multipart/alternative','text/plain','text/html','application/pdf']);assert.equal(parsed.pdf,bytes.toString('base64'));assert.equal(parsed.filename,'سيرتي.pdf');assert.equal(parsed.subject,'طلب تقديم أحمد حسين');assert(parsed.plain.includes('\n\nفقرة'));assert(parsed.html.includes('&lt;script&gt;'));assert(parsed.html.includes('dir="rtl"'));assert(!parsed.html.includes('display:none'));assert(parsed.defects.every(x=>x==='[]'));
 const decoded=Buffer.from(raw,'base64url').toString();assert(decoded.split('\r\n').every(l=>l.length<=998));
});
test('MIME rejects header injection and unusable attachment rather than silently dropping CV',()=>{
 assert.throws(()=>mail.buildMimeMessage({from:'a@gmail.com\r\nBcc: evil',to:'b@test.com',body:'x'}));
 assert.throws(()=>mail.buildMimeMessage({from:'a@gmail.com',to:'b@test.com',subject:'x\r\nBcc:evil',body:'x'}));
 assert.throws(()=>mail.buildMimeMessage({from:'a@gmail.com',to:'b@test.com',body:'x',attachment:{data:'not a PDF'}}));
});
test('editing CV text atomically retains uploaded PDF and filename',async()=>{
 const bytes=Buffer.from('original'),queries=[];
 const client={query:async(sql,args)=>{queries.push({sql,args});return sql.startsWith('SELECT filename')?{rows:[{filename:'cv.pdf',pdf_data:bytes}]}:{rowCount:1};},release(){}};
 const api=load('utils/user-records.js',{'./db':{pool:{connect:async()=>client}}});await api.replaceLatest('cv_profiles','owner',{content:'edited',filename:'manual',pdf_data:null},{preservePDF:true});
 const insert=queries.find(x=>x.sql.startsWith('INSERT'));assert.equal(insert.args[2],'edited');assert.equal(insert.args[3],'cv.pdf');assert.equal(insert.args[4],bytes);assert(queries[1].sql.includes('FOR UPDATE'));assert.equal(queries.at(-1).sql,'COMMIT');
});
const replies=load('utils/replyTracker.js',{googleapis:{google:{}},'./db':{},'./gmail':{},'./gmail-accounts':{}});
test('reply extraction decodes actual MIME body and removes Arabic quotation/entities/bidi',async()=>{
 const original='تمام\n\n\u202bفي الأربعاء، 7 أكتوبر 2026 تمت كتابة ما يلي بواسطة &lt;a@gmail.com&gt;:\u202c\nرسالة قديمة';
 const result=await replies.extractReply({id:'m',snippet:'wrong snippet',payload:{mimeType:'multipart/alternative',parts:[{mimeType:'text/plain',body:{data:Buffer.from(original).toString('base64url')}}]}},{});assert.equal(result,'تمام');
 assert.equal(replies.cleanReply('First\n\nSecond\nOn Wed someone wrote:\n> Old'),'First\n\nSecond');
 assert.equal(replies.htmlText('<div>My reply</div><blockquote>old</blockquote>'),'My reply\n');
});
test('reply synchronization is owner-scoped, checks full thread, updates latest reply and has overlap guard',async()=>{
 const writes=[];let query,params,requested;
 const api=load('utils/replyTracker.js',{googleapis:{google:{gmail:()=>({users:{threads:{get:async args=>{requested=args;return {data:{messages:[{id:'original',labelIds:['SENT'],internalDate:'2000'},{id:'reply',internalDate:'3000',payload:{mimeType:'text/plain',headers:[{name:'From',value:'other@example.com'}],body:{data:Buffer.from('Thanks').toString('base64url')}}}]}};}}}})}},'./db':{all:async(sql,args)=>{query=sql;params=args;return [{id:'log',user_id:'owner',thread_id:'thread',sent_at:2,message_id:'original',sender_account_id:'pinned',replied:1}];},run:async(sql,args)=>writes.push({sql,args})},'./gmail':{buildAuthClient:()=>({})},'./gmail-accounts':{resolveAccount:async(owner,id)=>{assert.equal(owner,'owner');assert.equal(id,'pinned');return {email:'sender@gmail.com'};}}});
 const a=api.syncReplies('owner');assert.equal(a,api.syncReplies('owner'));const result=await a;assert(query.includes('AND user_id=$1'));assert(!query.includes('replied=0'));assert.equal(params[0],'owner');assert.equal(requested.format,'full');assert.equal(result.updated,1);assert.equal(writes.find(w=>w.sql.includes('reply_text')).args[0],'Thanks');
});
test('admin login landing redirects to admin; linking accounts stays in tool',async()=>{
 let handler;const api=load('routes/site.js',{express:{Router:()=>({get:(route,fn)=>{if(route==='/')handler=fn;}})},path,'../utils/db':{},'../middleware/async-handler':f=>f,'../utils/site-template':{},'../utils/helpdesk':{isAdmin:async id=>id==='admin'},'../utils/access-control':{}});let location;const response={redirect:x=>location=x};await handler({session:{userId:'admin'},query:{}},response);assert.equal(location,'/admin');await handler({session:{userId:'admin'},query:{linked:'gmail'}},response);assert.equal(location,'/app?linked=gmail');
});
