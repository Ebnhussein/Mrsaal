'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {render}=require('../utils/website/site-template');
function harness({reduced=false,mobile=false,short=false}={}){
 const listeners={},queries=[],frames=[];let scroll=0;
 const classes=new Set();const root={classList:{add:c=>classes.add(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c);}}};
 const values=()=>({style:{values:{},setProperty(k,v){this.values[k]=v;}}});
 const stage={...values(),getBoundingClientRect:()=>({bottom:400})};
 const steps=Array.from({length:6},(_,i)=>({getBoundingClientRect:()=>({top:200+i*500-scroll,height:500}),classList:{toggle(){}}}));
 const scenes=Array.from({length:6},values),counter={},button={dataset:{static:'Static',animate:'Animate'},setAttribute(){},addEventListener(e,cb){listeners.button=cb;}};
 root.querySelector=s=>s==='.hs-stage'?stage:s==='[data-story-count]'?counter:button;
 root.querySelectorAll=s=>s==='[data-step]'?steps:scenes;
 const document={hidden:false,querySelector:()=>root,addEventListener(e,cb){listeners[e]=cb;}};
 const window={innerHeight:900,matchMedia:s=>{const q={matches:s.includes('reduced')?reduced:s.includes('width')?mobile:short,addEventListener(e,cb){q.change=cb;}};queries.push(q);return q;},requestAnimationFrame(cb){frames.push(cb);return frames.length;},cancelAnimationFrame(){frames.length=0;},addEventListener(e,cb){listeners[e]=cb;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/home-story.js'),'utf8'),{document,window,Math,String});
 const flush=()=>{while(frames.length)frames.shift()();};flush();
 return {classes,scenes,counter,button,queries,stage,scroll(n){scroll=n;listeners.scroll();flush();},toggle(){listeners.button();flush();},flush};
}
test('homepage retains bilingual navigation, six readable steps and conversion destinations',()=>{
 for(const lang of ['ar','en']){
  const html=render(lang,'home');
  assert.equal((html.match(/data-step="/g)||[]).length,6);
  assert.equal((html.match(/data-scene="/g)||[]).length,6);
  assert.equal((html.match(/class="hs-actor"/g)||[]).length,6);assert.equal((html.match(/class="hs-narration"/g)||[]).length,6);assert.match(html,/careers@example\.com/);assert.match(html,/data-pose="2"/);assert.match(html,/home-story\.js/);assert.match(html,/home-story\.css/);
  for(const dest of ['signup','plans','blog','help'])assert(html.includes(`href="/${lang}/${dest}"`));
  assert(html.includes(lang==='ar'?'أنت بتضيف قائمة الشركات':'You add the companies'));
  assert(html.includes(lang==='ar'?'تابع حالة كل رسالة، واعرف مين رد ومين فتح الإيميل، كل ده من مكان واحد.':'Track each message, see who replied and who opened your email, all in one place.'));
  assert(!html.includes(lang==='ar'?'مؤشر فتح الإيميل تقديري':'Email-open indicators are estimates'));
  assert(!html.includes('<video'));assert(!html.includes('sx-home-responsive'));
 }
 assert(!render('en','product').includes('home-story.js'));
});
test('the same scroll position restores the same shot after forward and backward navigation',()=>{
 const h=harness();assert(h.classes.has('hs-motion'));h.scroll(1000);
 const shot=h.scenes.map(s=>[s.style.opacity,s.style.transform]);const label=h.counter.textContent;
 h.scroll(2300);assert.notEqual(h.counter.textContent,label);h.scroll(1000);
 assert.deepEqual(h.scenes.map(s=>[s.style.opacity,s.style.transform]),shot);assert.equal(h.counter.textContent,label);
});
test('reduced motion and short viewports use static readable steps; motion can be disabled manually',()=>{
 for(const opts of [{reduced:true},{short:true}]){const h=harness(opts);assert(!h.classes.has('hs-motion'));assert(h.button.hidden);h.scroll(2000);assert.equal(h.counter.textContent,'01 / 06');}
 const h=harness({mobile:true});h.scroll(1000);assert.notEqual(h.counter.textContent,'01 / 06');h.toggle();assert(!h.classes.has('hs-motion'));assert.equal(h.button.textContent,'Animate');h.toggle();assert(h.classes.has('hs-motion'));
 h.queries[0].matches=true;h.queries[0].change();h.flush();assert(!h.classes.has('hs-motion'));
});
