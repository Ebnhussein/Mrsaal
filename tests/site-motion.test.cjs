'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/assets/site.js'),'utf8').split('/* Motion is progressive enhancement: content is never hidden by CSS. */')[1];
function run({reduce=false,supported=true}={}){
 const callbacks={},observers=[],animations=[];let queries=0;
 const preference={matches:reduce,addEventListener:(event,fn)=>{callbacks.preference=fn}};
 const element={animate:(frames,options)=>{const a={frames,options,cancelled:false,cancel(){this.cancelled=true}};animations.push(a);return a;}};
 const Observer=function(callback){this.callback=callback;this.observed=[];this.removed=[];this.disconnected=false;this.observe=e=>this.observed.push(e);this.unobserve=e=>this.removed.push(e);this.disconnect=()=>{this.disconnected=true};observers.push(this);};
 const document={hidden:false,querySelector:()=>null,querySelectorAll:selector=>{queries++;return selector.startsWith('.m-section')?[element]:[]},addEventListener:(event,fn)=>{callbacks[event]=fn}};
 vm.runInNewContext(source,{matchMedia:()=>preference,window:supported?{IntersectionObserver:Observer}:{},document,Set,WeakSet,Math});
 return {callbacks,observers,animations,preference,element,document,queries};
}
test('reduced motion starts no observers or animation and leaves markup visible',()=>{const r=run({reduce:true});assert.equal(r.observers.length,0);assert.equal(r.animations.length,0);assert.equal(r.queries,0);});
test('unsupported observer falls back to fully visible content',()=>{const r=run({supported:false});assert.equal(r.observers.length,0);assert.equal(r.animations.length,0);});
test('reveal plays once then unobserves; reduced motion change cancels it',()=>{const r=run();const observer=r.observers[0];observer.callback([{isIntersecting:true,target:r.element}]);assert.equal(r.animations.length,1);assert.equal(observer.removed[0],r.element);observer.callback([{isIntersecting:true,target:r.element}]);assert.equal(r.animations.length,1);r.preference.matches=true;r.callbacks.preference({matches:true});assert(r.animations[0].cancelled);assert(observer.disconnected);});
test('backgrounding the tab cancels ongoing motion',()=>{const r=run();r.observers[0].callback([{isIntersecting:true,target:r.element}]);r.document.hidden=true;r.callbacks.visibilitychange();assert(r.animations[0].cancelled);});
