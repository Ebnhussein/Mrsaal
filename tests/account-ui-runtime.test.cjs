'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {render}=require('../utils/site-template');
async function harness(page='login',lang='ar'){
 const html=render(lang,page),nodes={};
 for(const m of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const attrs=m[2],events={};nodes[m[3]]={hidden:/\bhidden\b/.test(attrs),disabled:false,required:false,value:'',textContent:'',type:attrs.match(/\btype="([^"]+)"/)?.[1]||'text',dataset:{},attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,cb){events[k]=cb;},events,focus(){},getBoundingClientRect:()=>({width:400}),querySelectorAll:()=>[],set hidden(v){this._hidden=v;},get hidden(){return this._hidden;}};
 }
 const layout={setAttribute(){},dataset:{}},toggles=['account-password','account-confirm-password'].map(id=>({dataset:{authPassword:id},attrs:{},events:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;}}));
 let configured=false;
 const document={getElementById:id=>nodes[id],documentElement:{lang,dir:lang==='ar'?'rtl':'ltr',dataset:{}},body:{dataset:{theme:'light'}},querySelector:s=>s==='.auth-layout'?layout:s==='.account-divider'?nodes['account-divider']:null,querySelectorAll:s=>s==='[data-auth-password]'?toggles:[],head:{append(){}}};
 const box={document,window:{},URLSearchParams,URL,AbortController,MutationObserver:class{observe(){}},location:{search:'',pathname:`/${lang}/${page}`,href:`https://example.com/${lang}/${page}`},localStorage:{setItem(){}},history:{replaceState(){}},setInterval(){},setTimeout:()=>1,clearTimeout(){},fetch:async url=>{assert.equal(url,'/auth/email-config');configured=true;return {ok:true,json:async()=>({enabled:true})};}};
 vm.runInNewContext(fs.readFileSync('public/assets/account.js','utf8'),box);for(let i=0;i<8;i++)await Promise.resolve();
 return {nodes,toggles,configured:()=>configured};
}
test('both public forms boot fully, load auth config, switch modes and reset password visibility',async()=>{
 for(const lang of ['ar','en'])for(const page of ['login','signup']){
  const h=await harness(page,lang),n=h.nodes;assert(h.configured());assert.equal(n['account-status'].textContent,'');
  assert.equal(n['account-name-group'].hidden,page!=='signup');assert.equal(n['account-name'].required,page==='signup');
  h.toggles[0].events.click();assert.equal(n['account-password'].type,'text');assert.equal(h.toggles[0].attrs['aria-pressed'],'true');
  n['account-signup'].onclick();assert.equal(n['account-password'].type,'password');assert.equal(n['account-confirm-password'].required,true);
  n['account-signin'].onclick();assert.equal(n['account-name'].disabled,true);assert.equal(n['account-google'].hidden,false);
  n['account-forgot'].onclick();assert.equal(n['account-google'].hidden,true);assert.equal(n['account-divider'].hidden,true);assert.equal(n['account-password'].disabled,true);assert.equal(n['account-email'].required,true);
 }
});
