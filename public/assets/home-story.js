/* Scroll is the playhead: no video download, autoplay or scroll interception. */
(() => {
 'use strict';
 const root=document.querySelector('.hs-home');
 if(!root)return;
 const stage=root.querySelector('.hs-stage');
 const steps=[...root.querySelectorAll('[data-step]')];
 const scenes=[...root.querySelectorAll('[data-scene]')];
 const counter=root.querySelector('[data-story-count]');
 const button=root.querySelector('[data-story-motion]');
 if(!stage||steps.length!==6||scenes.length!==6)return;
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 const compact=window.matchMedia('(max-width: 760px)');
 const canvas=root.querySelector('.hs-canvas');
 const header=document.querySelector('.sx-site-header');
 const bottomNav=document.querySelector('.sx-bottom-nav');
 let userStatic=false,frame=0,active=-1;
 let viewportBottom=window.innerHeight,stageTop=76;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function inlineScenes(){
  // Small landscape screens and reduced motion still get the matching card
  // beside every chapter, rather than six paragraphs under a frozen first card.
  steps.forEach((step,i)=>{
   if(step.querySelector('.hs-inline-stage'))return;
   const card=stage.cloneNode(true);
   card.classList.add('hs-inline-stage');
   card.querySelectorAll('[data-scene]').forEach((scene,j)=>{
    if(i!==j)scene.remove();
    else{scene.removeAttribute('data-scene');scene.removeAttribute('style');}
   });
   const label=card.querySelector('[data-story-count]');
   if(label){label.removeAttribute('data-story-count');label.textContent=String(i+1).padStart(2,'0')+' / 06';}
   card.removeAttribute('style');
   card.style.setProperty('--story-progress',String((i+1)/scenes.length));
   step.prepend(card);
  });
 }
 function update(){
  frame=0;
  if(!root.classList.contains('hs-motion')||document.hidden)return;
  const rect=stage.getBoundingClientRect();
  const stageBottom=stageTop+rect.height;
  const target=compact.matches?stageBottom+Math.max(0,viewportBottom-stageBottom)*.5:stageTop+rect.height/2;
  const centers=steps.map(el=>{const r=el.getBoundingClientRect();return r.top+r.height/2;});
  let playhead=0;
  for(let i=0;i<centers.length-1;i++){
   if(target>=centers[i])playhead=i+clamp((target-centers[i])/(centers[i+1]-centers[i]),0,1);
  }
  const index=clamp(Math.round(playhead),0,5);
  scenes.forEach((scene,i)=>{
   const distance=playhead-i;
   // Hold each shot, then crossfade through the intervening scroll distance.
   const opacity=clamp((.72-Math.abs(distance))/.3,0,1);
   scene.style.opacity=String(opacity);
   scene.style.transform=`translateY(${clamp(-distance*28,-35,35)}px) scale(${1-Math.min(Math.abs(distance),1)*.025})`;
   scene.style.setProperty('--scene-progress',String(clamp((distance+.55)/.5,0,1)));
  });
  stage.style.setProperty('--story-progress',String((playhead+1)/6));
  if(index!==active){
   active=index;
   if(counter)counter.textContent=String(index+1).padStart(2,'0')+' / 06';
   steps.forEach((step,i)=>step.classList.toggle('is-active',index===i));
  }
 }
 function queue(){if(!frame)frame=window.requestAnimationFrame(update);}
 function configure(){
  const viewport=window.visualViewport;
  viewportBottom=Math.min(window.innerHeight,viewport?viewport.height+viewport.offsetTop:window.innerHeight);
  const headerBottom=header?.getBoundingClientRect().bottom||64;
  const nav=bottomNav?.getBoundingClientRect();
  if(nav?.height)viewportBottom=Math.min(viewportBottom,nav.top);
  const top=Math.max(12,headerBottom+12);
  stageTop=top;
  const available=viewportBottom-top-16;
  const inline=reduce.matches||userStatic||(compact.matches?available<560:available<300);
  if(inline)inlineScenes();
  root.classList.toggle('hs-inline',inline);
  const chrome=canvas?(stage.getBoundingClientRect().height-canvas.getBoundingClientRect().height)||90:90;
  const canvasHeight=Math.min(compact.matches?390:490,compact.matches?available-300:available-chrome);
  root.style.setProperty('--hs-stage-top',top+'px');
  root.style.setProperty('--hs-canvas-height',Math.max(180,canvasHeight)+'px');
  root.style.setProperty('--hs-scene-scale',String(Math.min(1,(Math.max(180,canvasHeight)-48)/(compact.matches?296:442))));
  const enabled=!inline;
  root.classList.add('hs-motion-available');
  root.classList.toggle('hs-motion',enabled);
  if(button){
   button.hidden=reduce.matches;
   button.setAttribute('aria-pressed',String(!enabled));
   button.textContent=enabled?button.dataset.static:button.dataset.animate;
  }
  if(enabled)queue();
  else{
   if(frame)window.cancelAnimationFrame(frame);frame=0;
   scenes.forEach((scene,i)=>{scene.style.opacity=i===0?'1':'0';scene.style.transform='none';});
   stage.style.setProperty('--story-progress','0');
   if(counter)counter.textContent='01 / 06';active=-1;
  }
 }
 button?.addEventListener('click',()=>{userStatic=!userStatic;configure();});
 // Capture also receives scroll events from a containing scroller.
 window.addEventListener('scroll',queue,{passive:true,capture:true});
 window.addEventListener('resize',configure,{passive:true});
 window.addEventListener('pageshow',queue);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});
 window.visualViewport?.addEventListener('resize',configure,{passive:true});
 window.visualViewport?.addEventListener('scroll',queue,{passive:true});
 [reduce,compact].forEach(query=>query.addEventListener('change',configure));
 if(window.ResizeObserver){
  const observer=new window.ResizeObserver(configure);
  [header,bottomNav,canvas].filter(Boolean).forEach(el=>observer.observe(el));
 }
 if(document.fonts?.ready)document.fonts.ready.then(configure);
 configure();
})();
