/* Independent of the scroll story: keyboard-native buttons, no network requests. */
(() => {
 'use strict';
 document.querySelectorAll('.hs-faq').forEach(root=>{
 const buttons=[...root.querySelectorAll('[data-faq-question]')];
 const answers=[...root.querySelectorAll('[data-faq-answer]')];
 function select(button){
  buttons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  answers.forEach(answer=>{answer.hidden=answer.dataset.faqAnswer!==button.dataset.faqQuestion;});
 }
 buttons.forEach(button=>button.addEventListener('click',()=>select(button)));
 if(buttons.length)select(buttons[0]);
 });
})();
