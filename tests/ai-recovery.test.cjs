'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {withRecovery,retryAfter,hardQuota}=require('../utils/ai-retry');
test('temporary AI failure retries once, then succeeds; daily quota and auth never retried',async()=>{
 let calls=0;assert.equal(await withRecovery(async()=>{if(++calls===1)throw {code:'TEMPORARY',retryAfterMs:0};return 'OK';},Date.now()+10000),'OK');assert.equal(calls,2);
 for(const code of ['AUTH','QUOTA','CREDITS']){calls=0;await assert.rejects(withRecovery(async()=>{calls++;throw Object.assign(new Error('fail'),{code});},Date.now()+10000));assert.equal(calls,1);}
});
test('provider reset time is respected, not shortened into a rapid retry',async()=>{
 let calls=0;await assert.rejects(withRecovery(async()=>{calls++;throw Object.assign(new Error('limit'),{code:'RATE_LIMIT',retryAfterMs:60000});},Date.now()+75000));assert.equal(calls,1);assert.equal(retryAfter({get:()=> '60'}),60000);assert(hardQuota({error:{message:'Daily quota reached'}}));assert(!hardQuota({error:{message:'Too many requests per minute'}}));
});
function support(response,fail=false){const context={module:{exports:{}},Map,Set,console:{warn(){}},require:id=>id==='./support-knowledge'?require('../utils/support-knowledge'):{callGemini:async(prompt)=>{context.prompt=prompt;if(fail)throw new Error('temporary');return JSON.stringify(response);}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../utils/support.js'),'utf8'),context);return {api:context.module.exports,context};}
test('assistant returns generated product answer and uses bounded conversation, rather than copying FAQ',async()=>{
 const {api,context}=support({version:2,scope:'help',text:'افتح إعدادات السيرة، ثم جرّب الملف المحفوظ على جهازك. هل ظهر اسم الملف؟',topics:['cv']});const result=await api.respond('رفع السي في',{history:[{role:'user',content:'أنا على الموبايل'}]});assert.equal(result.mode,'ai');assert(result.text.includes('هل ظهر'));assert.equal(result.articles[0].text,'');assert(context.prompt.includes('أنا على الموبايل'));assert(!context.prompt.includes('السيرة الشخصية الخاصة'));
});
test('assistant refuses external content and provides useful local guide when AI is unavailable',async()=>{
 const outside=await support({version:2,scope:'outside',text:'arbitrary essay',topics:[]}).api.respond('اكتب قصة');assert.equal(outside.scope,'outside');assert(!outside.text.includes('essay'));
 const fallback=await support(null,true).api.respond('رفع السي في');assert.equal(fallback.mode,'local');assert.equal(fallback.scope,'help');assert.equal(fallback.articles[0].id,'cv');
});
function outbox(){const rows=new Map();const db={run:async(sql,args)=>{if(sql.startsWith('INSERT'))rows.set(args[0]+':'+args[1],{payload:args[2]});},get:async(sql,args)=>rows.get(args[0]+':'+args[1])};const secrets={seal:v=>Buffer.from(JSON.stringify(v)).toString('base64'),unseal:v=>JSON.parse(Buffer.from(v,'base64'))};const context={module:{exports:{}},Buffer,Map,Date,require:id=>id==='./db'?db:secrets};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../utils/whatsapp-retry-store.js'),'utf8'),context);const proto={Message:{encode:v=>({finish:()=>Buffer.from(JSON.stringify(v))}),decode:b=>JSON.parse(b)}};return {api:context.module.exports,rows,proto};}
test('WhatsApp retry returns the original caption/document, survives a fresh lookup and is isolated by user',async()=>{
 const {api,proto}=outbox();const message={key:{id:'same-id'},message:{documentMessage:{url:'media-url',caption:'رسالة\n\nCV',mediaKey:'original-key',fileName:'cv.pdf'}}};await api.saveMessage('owner',message,proto);assert.deepEqual(await api.getMessage('owner',{id:'same-id'},proto),message.message);assert.equal(await api.getMessage('other',{id:'same-id'},proto),undefined);
});
test('device cache can be refreshed for newly linked devices; prepared message saved before relay',()=>{
 const {api}=outbox(),cache=api.deviceCache();cache.set('jid',['old-device']);assert.deepEqual(cache.get('jid'),['old-device']);cache.flushAll();assert.equal(cache.get('jid'),undefined);
 const source=fs.readFileSync(path.join(__dirname,'../utils/whatsapp.js'),'utf8');assert(source.indexOf('await retryStore.saveMessage(userId,result')<source.indexOf('await entry.sock.relayMessage'));assert(source.includes('useUserDevicesCache:false'));assert(!source.includes('getMessage:async()=>undefined'));
});
test('WhatsApp transport persists before relay and reuses the generated ID for delivery reporting',async()=>{
 const trace=[],message={key:{id:'original-id',remoteJid:'recipient@s.whatsapp.net'},message:{documentMessage:{caption:'Hello',fileName:'cv.pdf'}}};
 const lib={proto:{},generateWAMessage:async(jid,content,options)=>{assert.equal(jid,'recipient@s.whatsapp.net');assert.equal(options.userJid,'sender@s.whatsapp.net');assert.equal(content.caption,'Hello');trace.push('prepare');return message;}};
 const sock={user:{id:'sender@s.whatsapp.net'},onWhatsApp:async()=>[{exists:true,jid:'recipient@s.whatsapp.net'}],relayMessage:async(jid,payload,options)=>{assert.equal(payload,message.message);assert.equal(options.messageId,'original-id');assert.equal(options.useUserDevicesCache,false);trace.push('relay');}};
 const dependencies={crypto:require('crypto'),'./whatsapp-content':require('../utils/whatsapp-content'),'./whatsapp-retry-store':{saveMessage:async(user,value)=>{assert.equal(user,'owner');assert.equal(value,message);trace.push('store');}},'./db':{},qrcode:{},pino:()=>({}),'./whatsappTracking':{}};
 const context={module:{exports:{}},require:id=>dependencies[id],Buffer,Map,Number,Promise,Date,process:{env:{}},console};
 let code=fs.readFileSync(path.join(__dirname,'../utils/whatsapp.js'),'utf8');code+='\nmodule.exports.testSession=(id,entry)=>sessions.set(id,entry);module.exports.testLibrary=lib=>libraryPromise=Promise.resolve(lib);';vm.runInNewContext(code,context);
 const api=context.module.exports;api.testLibrary(lib);api.testSession('owner',{status:'connected',cancelled:false,sock,sendQueue:Promise.resolve(),deviceCache:{flushAll:()=>trace.push('refresh')}});
 const result=await api.sendWhatsAppMessage('owner','201012345678','Hello',{data:Buffer.from('%PDF'),filename:'cv.pdf',mimeType:'application/pdf'});assert.deepEqual(trace,['prepare','store','refresh','relay']);assert.equal(result.messageId,'original-id');
});
