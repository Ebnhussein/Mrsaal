'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {homeStory}=require('../utils/home-story');
test('FAQ selection changes only its answer, stays on the page and supports repeated choices',()=>{
 const buttons=Array.from({length:3},(_,i)=>({dataset:{faqQuestion:String(i)},attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(type,cb){this.click=cb;}}));
 const answers=buttons.map(b=>({dataset:{faqAnswer:b.dataset.faqQuestion},hidden:false}));
 const root={querySelectorAll:s=>s==='[data-faq-question]'?buttons:answers};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/assets/home-faq.js'),'utf8'),{document:{querySelector:()=>root}});
 for(const i of [0,2,1,1,0]){
  buttons[i].click();
  assert.deepEqual(answers.map(a=>a.hidden),buttons.map((_,j)=>j!==i));
  assert.deepEqual(buttons.map(b=>b.attrs['aria-pressed']),buttons.map((_,j)=>String(j===i)));
 }
});
test('Arabic and English FAQ render matching answer targets and local help links; answers remain readable without JS',()=>{
 for(const lang of ['ar','en']){
  const html=homeStory(lang),section=html.match(/<section class="hs-faq hs-wrap"[\s\S]*?<\/section>/)[0];
  assert.equal((section.match(/data-faq-question=/g)||[]).length,3);
  assert.equal((section.match(/data-faq-answer=/g)||[]).length,3);
  for(const id of section.matchAll(/aria-controls="([^"]+)"/g))assert(section.includes(`id="${id[1]}"`));
  assert(section.includes(`href="/${lang}/help"`));
  assert(!section.includes(' hidden'));
  assert(section.includes(lang==='ar'?'إيه اللي حابب تعرفه؟':'What would you like to know?'));
 }
});
