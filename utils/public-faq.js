'use strict';
// Only transforms trusted server-owned FAQ templates; never accepts user HTML.
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=s=>s.replace(/<[^>]*>/g,'').trim();
function renderFAQ(items,lang,page){
 const en=lang==='en',plans=page==='plans';
 const title=plans?(en?'Clear usage, without surprises':'استخدام واضح، من غير مفاجآت'):(en?'What can we help you with?':'إيه اللي محتاج مساعدة فيه؟');
 const intro=plans?(en?'Choose a question about plans, credits or sending.':'اختار سؤالك عن الباقات أو رصيدك أو الإرسال.'):(en?'Choose a question and find your next step.':'اختار المشكلة اللي بتقابلك، واعرف تعمل إيه خطوة بخطوة.');
 const labels=plans?(en?['Payment','AI draft credits','Personal providers','Sending credits']:['الدفع والاشتراك','رصيد مرسال AI','المنصات الشخصية','رصيد الإرسال']):(en?['Company files','Connecting Gmail','Connecting WhatsApp','API key security','Sending limits']:['ملفات الشركات','ربط Gmail','ربط واتساب','أمان مفاتيح API','حدود الإرسال']);
 const icons=plans?['payments','auto_awesome','key','send']:['table_view','mail','chat','key','schedule'];
 const icon=name=>`<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
 return `<section class="hs-faq hs-wrap" aria-labelledby="hs-faq-heading"><header class="hs-faq-heading"><p class="hs-eyebrow">${en?'A quick question. A clear answer.':'سؤال صغير، إجابة واضحة'}</p><h2 id="hs-faq-heading">${title}</h2><p>${intro}</p></header><div class="hs-faq-grid"><div class="hs-faq-questions" role="group" aria-label="${en?'Choose a question':'اختار السؤال'}">${items.map((item,i)=>`<button type="button" class="hs-faq-question" data-faq-question="${i}" aria-pressed="${i===0}" aria-controls="hs-faq-answer-${i}">${icon(icons[i]||'help')}<span>${escape(item.question)}</span>${icon('arrow_forward')}</button>`).join('')}</div><div class="hs-faq-response" aria-live="polite" aria-atomic="true">${items.map((item,i)=>`<article id="hs-faq-answer-${i}" data-faq-answer="${i}"><p class="hs-faq-label">${labels[i]||title}</p><h3>${escape(item.question)}</h3><p>${item.answer}</p></article>`).join('')}</div></div><div class="hs-faq-footer"><p>${en?'Still need a hand?':'لسه محتاج مساعدة؟'}</p><a href="/${lang}/${plans?'help':'contact'}">${plans?(en?'Explore the Mrsaal guide':'شوف دليل مرسال'):(en?'Contact support':'تواصل مع الدعم')}${icon('arrow_forward')}</a></div></section>`;
}
function replaceFAQ(html,lang,page){
 const pattern=page==='plans'?/<section class="sx-plan-faq">[\s\S]*?<\/section>/:/<!-- FAQ Accordion Section -->\s*<section\b[\s\S]*?<\/section>/;
 return html.replace(pattern,section=>{
  const items=[];
  if(page==='plans'){
   for(const m of section.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g))items.push({question:plain(m[1]),answer:m[2]});
  }else{
   for(const m of section.matchAll(/<button\b[^>]*class="faq-header[^>]*>\s*<span>([\s\S]*?)<\/span>[\s\S]*?<\/button>\s*<div class="faq-content[^>]*>([\s\S]*?)<\/div>/g))items.push({question:plain(m[1]),answer:m[2].trim()});
  }
  if(!items.length)throw new Error('Public FAQ template does not match '+page);
  return renderFAQ(items,lang,page);
 });
}
module.exports={replaceFAQ};
