'use strict';
(()=>{
 const overlay=document.getElementById('preview-overlay');if(!overlay||!window.MrsaalSmartScroll)return;
 const root=overlay.querySelector('.compose-modal'),scroller=root.querySelector('.compose-scroll'),footer=root.querySelector('.compose-footer');
 const navigator=window.MrsaalSmartScroll.attach({root,scroller,host:footer,items:()=>[...scroller.querySelectorAll('.compose-channel,.compose-addresses,#prev-subject-field,.compose-editor,.compose-refine,#preview-schedule-field')],label:item=>item.querySelector('.label,label,summary')?.textContent||''});
 const nav=document.createElement('div');nav.className='preview-company-nav';
 const position=document.createElement('span'),controls=document.createElement('div');controls.className='smart-scroll-controls';
 const previous=document.createElement('button'),next=document.createElement('button');
 for(const b of [previous,next]){b.type='button';b.className='btn btn-secondary';}controls.append(previous,next);nav.append(position,controls);footer.insertBefore(nav,footer.querySelector('.compose-actions'));
 let moving=false;
 const pool=()=>companies;
 const busy=()=>moving||document.getElementById('preview-channel').disabled||document.getElementById('btn-write').disabled;
 function refresh(){
  const en=document.documentElement.lang==='en',list=pool(),index=list.findIndex(c=>c.id===prevCompanyId);
  nav.hidden=previewBatchActive||index<0||list.length<2;
  position.textContent=(en?'Company ':'الشركة ')+(index+1)+' / '+list.length;
  previous.textContent=en?'Previous company':'الشركة السابقة';next.textContent=en?'Next company':'الشركة التالية';
  previous.disabled=busy()||index<=0;next.disabled=busy()||index<0||index>=list.length-1;navigator.refresh();
 }
 async function move(delta){
  if(busy()||previewBatchActive)return;
  const from=prevCompanyId,channel=previewChannel,list=pool(),index=list.findIndex(c=>c.id===from),target=list[index+delta];if(!target)return;
  moving=true;refresh();
  const fields=['prev-subject','prev-body','preview-channel'].map(id=>document.getElementById(id));
  const actions=[...root.querySelectorAll('.compose-actions button')],locked=[...fields,...actions].map(el=>[el,el.disabled]);
  locked.forEach(([el])=>{el.disabled=true;});
  try{
   await flushPreviewDraft();
   if(!overlay.classList.contains('open')||prevCompanyId!==from)return;
   await previewOne(target.id,channel);scroller.scrollTop=0;
  }catch(error){document.getElementById('prev-send-status').textContent=(document.documentElement.lang==='en'?'Could not save your draft. Stay here and retry: ':'تعذر حفظ المسودة. فضلت على نفس الشركة؛ حاول تاني: ')+error.message;}
  finally{locked.forEach(([el,disabled])=>{el.disabled=disabled;});moving=false;previewEdited(false);refresh();}
 }
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 const observer=new MutationObserver(refresh);
 observer.observe(overlay,{attributes:true,attributeFilter:['class']});
 observer.observe(document.getElementById('prev-company'),{childList:true,characterData:true,subtree:true});
 for(const id of ['preview-channel','btn-write'])observer.observe(document.getElementById(id),{attributes:true,attributeFilter:['disabled']});
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 refresh();
})();
