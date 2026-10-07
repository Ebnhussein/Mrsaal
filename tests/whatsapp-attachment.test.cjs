'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {formatWhatsAppText,buildWhatsAppContent}=require('../utils/whatsapp-content');
test('WhatsApp PDF is a single document message with formatted caption and exact original bytes',()=>{
 const pdf=Buffer.from('%PDF-1.7\noriginal bytes'),text='أهلًا\r\n\r\nأنا مهتم بالتواصل.\r\n\r\nشكرًا.';
 const content=buildWhatsAppContent(text,{data:pdf,filename:'سيرتي.pdf',mimeType:'application/pdf'});
 assert.equal(content.document,pdf);assert.equal(content.fileName,'سيرتي.pdf');assert.equal(content.mimetype,'application/pdf');assert.equal(content.caption,'أهلًا\n\nأنا مهتم بالتواصل.\n\nشكرًا.');assert(!content.text);
});
test('WhatsApp text-only remains supported; invalid PDF is rejected instead of silently dropped',()=>{
 assert.deepEqual(buildWhatsAppContent(' أهلا '),{text:'أهلا'});assert.throws(()=>buildWhatsAppContent('hello',{data:'broken'}));assert.throws(()=>buildWhatsAppContent('hello',{data:Buffer.alloc(0)}));assert.throws(()=>buildWhatsAppContent('hello',{data:Buffer.from('x'),mimeType:'text/html'}));
});
test('long single-line WhatsApp gains paragraphs without adding or losing words',()=>{
 const original=('This is my professional experience and my real work history. ').repeat(8).trim(),formatted=formatWhatsAppText(original);assert(formatted.includes('\n\n'));assert.equal(formatted.replace(/\s+/g,' '),original);
});
test('Gmail and WhatsApp attachment preview use actual saved PDF metadata',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/assets/app.js'),'utf8');const start=source.indexOf('async function refreshPreviewAttachment'),end=source.indexOf('async function previewChangeChannel',start);let label='',children=[];
 const el={hidden:false,set textContent(x){label=x;},get textContent(){return label;},replaceChildren(){children=[];},append(...x){children.push(...x);}};
 let pdf=true;
 const ctx={previewChannel:'whatsapp',prevCompanyId:'company',document:{getElementById:()=>el,createTextNode:x=>x,createElement:()=>({})},api:async()=>pdf?{has_attachment:true,filename:'cv.pdf'}:{has_attachment:false}};
 vm.runInNewContext(source.slice(start,end),ctx);await ctx.refreshPreviewAttachment('whatsapp','company');assert.equal(el.hidden,false);assert(children[0].includes('cv.pdf'));assert.equal(children[1].href,'/api/cv/pdf');pdf=false;await ctx.refreshPreviewAttachment('whatsapp','company');assert(label.includes('بدون مرفق'));
});
test('preview generation enables sending after draft loads without referencing an undefined channel',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/assets/app.js'),'utf8');const start=source.indexOf('async function genPreview('),end=source.indexOf('function closePrev',start);const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},dataset:{}});return nodes.get(id);};
 const ctx={previewRequest:0,prevCompanyId:'company',previewChannel:'whatsapp',document:{getElementById:node,querySelector:node},api:async()=>({channel:'whatsapp',body:'Draft\n\nThank you'}),writingBusy(){},writingReview(){},toast(){}};
 vm.runInNewContext(source.slice(start,end),ctx);await ctx.genPreview('company');assert.equal(node('btn-confirm').disabled,false);assert.equal(node('#preview-overlay .modal').dataset.channel,'whatsapp');assert.equal(node('prev-body').value,'Draft\n\nThank you');
});
