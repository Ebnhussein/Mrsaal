'use strict';
(()=>{
 const mounted=new WeakMap();
 function attach({root,scroller,host,items,label,onChange}){
  mounted.get(root)?.destroy();
  const node=(tag,cls)=>{const n=document.createElement(tag);n.className=cls;return n;};
  root.classList.add('smart-scroll-dialog');scroller.classList.add('smart-scroll-body');
  const bar=node('div','smart-scroll-bar'),meter=node('div','smart-scroll-meter'),fill=node('i',''),row=node('div','smart-scroll-row'),position=node('span','smart-scroll-position'),controls=node('div','smart-scroll-controls');
  meter.setAttribute('aria-hidden','true');meter.append(fill);
  const prev=node('button','smart-scroll-button'),next=node('button','smart-scroll-button');
  for(const [b,text]of [[prev,'keyboard_arrow_up'],[next,'keyboard_arrow_down']]){b.type='button';const icon=node('span','material-symbols-outlined');icon.setAttribute('aria-hidden','true');icon.textContent=text;b.append(icon);}
  controls.append(prev,next);row.append(position,controls);bar.append(meter,row);host.prepend(bar);
  let current=0,frame=0,disposed=false;
  const visible=()=>items().filter(item=>!item.hidden&&item.getClientRects().length);
  function update(){
   if(disposed)return;const list=visible(),en=document.documentElement.lang==='en';
   const max=scroller.scrollHeight-scroller.clientHeight,top=scroller.getBoundingClientRect().top;
   current=0;
   if(list.length){let best=Infinity;list.forEach((item,i)=>{const distance=Math.abs(item.getBoundingClientRect().top-top-8);if(distance<best){best=distance;current=i;}});if(max>1&&scroller.scrollTop>=max-2)current=list.length-1;}
   const name=list[current]?label(list[current],current):'';
   position.textContent=list.length?`${current+1} / ${list.length}${name?' · '+name:''}`:(en?'No items':'مفيش عناصر');
   prev.setAttribute('aria-label',en?'Previous section':'الجزء السابق');next.setAttribute('aria-label',en?'Next section':'الجزء التالي');
   prev.disabled=current<=0;next.disabled=!list.length||current>=list.length-1;
   fill.style.width=(max>0?Math.max(0,Math.min(100,scroller.scrollTop/max*100)):100)+'%';
   onChange?.(list[current],current);
  }
  function queue(){if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;update();});}
  function go(delta){update();const item=visible()[current+delta];if(!item)return;scroller.scrollTo({top:scroller.scrollTop+item.getBoundingClientRect().top-scroller.getBoundingClientRect().top-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  prev.addEventListener('click',()=>go(-1));next.addEventListener('click',()=>go(1));scroller.addEventListener('scroll',queue,{passive:true});
  const resize=typeof ResizeObserver==='function'?new ResizeObserver(queue):null;resize?.observe(scroller);
  const locale=new MutationObserver(queue);locale.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  const api={refresh:queue,destroy(){disposed=true;if(frame)cancelAnimationFrame(frame);resize?.disconnect();locale.disconnect();scroller.removeEventListener('scroll',queue);bar.remove();mounted.delete(root);}};
  mounted.set(root,api);update();queue();return api;
 }
 window.MrsaalSmartScroll={attach};
})();
