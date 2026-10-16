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
 const short=window.matchMedia('(max-height: 520px)');
 let userStatic=false,frame=0,active=-1;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function update(){
  frame=0;
  if(!root.classList.contains('hs-motion')||document.hidden)return;
  const target=compact.matches?stage.getBoundingClientRect().bottom+(window.innerHeight-stage.getBoundingClientRect().bottom)*.45:window.innerHeight*.52;
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
   scene.style.setProperty('--scene-progress',String(clamp((distance+.4)/.65,0,1)));
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
  const enabled=!reduce.matches&&!short.matches&&!userStatic;
  root.classList.add('hs-motion-available');
  root.classList.toggle('hs-motion',enabled);
  if(button){
   button.hidden=reduce.matches||short.matches;
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
 window.addEventListener('scroll',queue,{passive:true});
 window.addEventListener('resize',configure,{passive:true});
 window.addEventListener('pageshow',queue);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});
 [reduce,compact,short].forEach(query=>query.addEventListener('change',configure));
 if(document.fonts?.ready)document.fonts.ready.then(queue);
 configure();
})();
