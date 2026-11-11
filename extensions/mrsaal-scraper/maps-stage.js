'use strict';
(()=>{
 if(!/(^|\.)google\.[a-z.]+$/.test(location.hostname)||!location.pathname.startsWith('/maps'))return;
 globalThis.MrsaalMapStage?.remove();
 let host,root,games,resize;
 function remove(){games?.destroy();host?.remove();if(resize)window.removeEventListener('resize',resize);host=null;}
 function mount(language){
  remove();const en=language==='en';host=document.createElement('div');host.id='mrsaal-map-stage';root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>:host{all:initial;position:fixed;z-index:2147483645;font:14px/1.6 system-ui;color:#173c30;pointer-events:none}*{box-sizing:border-box}.shell{pointer-events:auto;background:#f6fbf7;border:1px solid #b9d7c7;border-radius:22px;box-shadow:0 12px 48px #103e3240;height:100%;overflow:auto;padding:20px}header{position:sticky;top:0;z-index:2;background:#f6fbf7;display:flex;align-items:center;justify-content:space-between;gap:12px}h2{margin:0;font-size:22px}p{margin:6px 0;color:#557064}button,select{font:inherit;border:1px solid #bfd9ca;border-radius:10px;color:#196c4c;background:white;padding:8px 14px;cursor:pointer}button:disabled{opacity:.5}select{width:100%;max-width:480px}.games{margin:15px 0}summary{cursor:pointer}canvas{display:block;width:min(100%,440px,calc(100vh - 250px));height:auto;margin:12px auto;border-radius:16px;background:#edf6ee;outline-offset:3px}.row,.game-pad{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:8px 0}.game-pad button{min-width:46px}#xo-board{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:390px;margin:15px auto}#xo-board button{aspect-ratio:1;font-size:38px}.state{position:sticky;top:48px;z-index:2;padding:10px;background:#e3f2e9;border-radius:12px;font-weight:650}[hidden]{display:none!important}@media(max-height:650px){.shell{padding:12px}canvas{width:min(100%,320px)}h2{font-size:18px}}</style><div class="shell" dir="${en?'ltr':'rtl'}"><header><h2>Mrsaal · ${en?'A little break':'استراحة صغيرة'}</h2><button id="dismiss">${en?'Show map':'إظهار الخريطة'}</button></header><p>${en?'Results keep collecting in the results pane. Playing does not stop collection.':'الجمع مستمر في قائمة النتائج. اللعب مش بيوقفه.'}</p><div id="stage-status" class="state"></div><details id="waiting-games" class="games" open><summary>${en?'Waiting games':'ألعاب الانتظار'}</summary><select id="game-choice"><option value="snake">${en?'Snake':'التعبان'}</option><option value="xo">${en?'Tic-tac-toe':'إكس أو'}</option></select><div id="snake-game"><canvas id="snake-board" width="256" height="256" tabindex="0" aria-label="Snake"></canvas><div class="row"><button id="snake-start">${en?'Start / restart':'ابدأ / أعد اللعب'}</button><button id="snake-pause">${en?'Pause':'وقفة'}</button><span id="snake-score"></span></div><div class="game-pad"><button data-direction="up">↑</button><button data-direction="left">←</button><button data-direction="down">↓</button><button data-direction="right">→</button></div></div><div id="xo-game" hidden><div id="xo-board"></div><button id="xo-reset">${en?'New round':'جولة جديدة'}</button></div><p id="game-status"></p></details><div class="row"><button id="stop-collection">${en?'Stop collecting':'إيقاف الجمع'}</button></div></div>`;
  root.host.lang=language||'ar';document.documentElement.append(host);games=globalThis.MrsaalGamesFactory?.mount(root);games?.setBusy(true);
  root.querySelector('#dismiss').onclick=remove;root.querySelector('#stop-collection').onclick=()=>globalThis.MrsaalExtractor?.cancel();
  resize=()=>{
   const feed=[...document.querySelectorAll('[role="feed"]')].find(e=>e.getClientRects().length),r=feed?.getBoundingClientRect();
   let x=16,width=innerWidth-32;
   if(r&&r.width>150&&r.width<innerWidth*.8){if(r.x>innerWidth/2){width=r.x-28;}else{x=r.right+16;width=innerWidth-x-16;}}
   if(width<280){x=12;width=innerWidth-24;}
   Object.assign(host.style,{left:x+'px',top:'90px',width:Math.max(240,width)+'px',height:Math.max(280,innerHeight-108)+'px'});
  };resize();window.addEventListener('resize',resize);
  update({stage:'scanning',count:0,limit:100},en);
  return {update:p=>update(p,en),remove(){/* Keep the result visible until the user closes it. */}};
 }
 function update(p,en){if(!host)return;root.querySelector('#stage-status').textContent=(en?'Collected: ':'تم جمع: ')+p.count+' / '+p.limit+(p.stage==='complete'?(en?' · verifying save…':' · جاري تأكيد الحفظ…'):'');}
 function finish(status){if(!host)return;games?.setBusy(false);root.querySelector('#stop-collection').disabled=true;root.querySelector('#stage-status').textContent=status==='saved'?(host.lang==='en'?'Saved and verified in Mrsaal.':'تم الحفظ والتأكد من الدفعة في مرسال.'):(host.lang==='en'?'Collection stopped. Check the extension save status.':'الجمع توقف. راجع حالة الحفظ في الإضافة.');}
 globalThis.MrsaalMapStage={mount,finish,remove};
})();
