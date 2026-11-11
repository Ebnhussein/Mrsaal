'use strict';
(() => {
 function mount(root=document){
 const $=id=>root.querySelector('#'+id),canvas=$('snake-board');if(!canvas)return null;const ctx=canvas.getContext('2d');
 let snake=[{x:7,y:8},{x:6,y:8},{x:5,y:8}],food={x:11,y:8},direction={x:1,y:0},next=direction,timer=null,score=0,wasBusy=false,xo=Array(9).fill(''),aiTimer=null;
 const text=(ar,en)=>(root.host?.lang||document.documentElement.lang)==='en'?en:ar;
 function status(ar,en){$('game-status').textContent=text(ar,en);}
 function draw(){ctx.fillStyle='#f1f8f2';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#e0ece3';for(let i=0;i<16;i++){ctx.strokeRect(i*16,0,16,256);ctx.strokeRect(0,i*16,256,16);}ctx.fillStyle='#e9a446';ctx.fillRect(food.x*16+3,food.y*16+3,10,10);snake.forEach((cell,i)=>{ctx.fillStyle=i?'#56a77a':'#176b47';ctx.fillRect(cell.x*16+1,cell.y*16+1,14,14);});$('snake-score').textContent=text('النقط: ','Score: ')+score;}
 function pause(){clearInterval(timer);timer=null;}
 function tick(){direction=next;const head={x:snake[0].x+direction.x,y:snake[0].y+direction.y},eat=head.x===food.x&&head.y===food.y,body=eat?snake:snake.slice(0,-1);if(head.x<0||head.y<0||head.x>=16||head.y>=16||body.some(c=>c.x===head.x&&c.y===head.y)){pause();status('خلصت الجولة! جرّب تاني.','Game over! Try again.');return;}snake.unshift(head);if(eat){score++;if(snake.length===256){pause();status('كسبت!','You won!');return;}do{food={x:Math.floor(Math.random()*16),y:Math.floor(Math.random()*16)};}while(snake.some(c=>c.x===food.x&&c.y===food.y));}else snake.pop();draw();}
 function turn(name){const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}},d=dirs[name];if(d&&(d.x!==-direction.x||d.y!==-direction.y))next=d;}
 $('snake-start').addEventListener('click',()=>{pause();snake=[{x:7,y:8},{x:6,y:8},{x:5,y:8}];direction={x:1,y:0};next=direction;food={x:11,y:8};score=0;timer=setInterval(tick,160);draw();canvas.focus({preventScroll:true});status(wasBusy?'الجمع شغال في الخلفية.':'اللعبة جاهزة. راجع حالة الجمع في الإضافة.',wasBusy?'Collection continues in the background.':'Game ready. Check collection status in the extension.');});
 $('snake-pause').addEventListener('click',()=>{pause();status(wasBusy?'اللعبة واقفة؛ الجمع مستمر.':'اللعبة واقفة.',wasBusy?'Game paused; collection continues.':'Game paused.');});
 canvas.addEventListener('keydown',event=>{const names={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(names[event.key]){event.preventDefault();turn(names[event.key]);}});
 root.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>{turn(button.dataset.direction);canvas.focus({preventScroll:true});}));
 function winner(board){for(const [a,b,c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return board.every(Boolean)?'draw':'';}
 function paintXO(){const board=$('xo-board');board.replaceChildren();xo.forEach((value,i)=>{const b=document.createElement('button');b.textContent=value||'·';b.setAttribute('aria-label',text('خانة ','Cell ')+(i+1));b.disabled=!!value||!!winner(xo)||!!aiTimer;b.addEventListener('click',()=>{xo[i]='X';if(winner(xo)){paintXO();status('انتهت الجولة: '+winner(xo),'Round finished: '+winner(xo));return;}aiTimer=setTimeout(()=>{aiTimer=null;const empty=xo.map((v,i)=>v?-1:i).filter(i=>i>=0);const move=empty.find(i=>{const c=[...xo];c[i]='O';return winner(c)==='O';})??empty.find(i=>{const c=[...xo];c[i]='X';return winner(c)==='X';})??(empty.includes(4)?4:empty[0]);xo[move]='O';paintXO();if(winner(xo))status('انتهت الجولة: '+winner(xo),'Round finished: '+winner(xo));},250);paintXO();});board.append(b);});}
 $('xo-reset').addEventListener('click',()=>{clearTimeout(aiTimer);aiTimer=null;xo=Array(9).fill('');paintXO();});
 $('game-choice').addEventListener('change',()=>{pause();$('snake-game').hidden=$('game-choice').value!=='snake';$('xo-game').hidden=$('game-choice').value!=='xo';});
 $('waiting-games').addEventListener('toggle',()=>{if(!$('waiting-games').open)pause();});const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
 const controller={destroy(){pause();clearTimeout(aiTimer);document.removeEventListener('visibilitychange',visibility);},setBusy(busy){if(wasBusy&&!busy){pause();status('الجمع انتهى. راجع نتيجة الحفظ فوق.','Collection finished. Check the save result above.');}wasBusy=busy;}};
 draw();paintXO();return controller;
 }
 globalThis.MrsaalGamesFactory={mount};
 if(document.getElementById('snake-board'))window.MrsaalGames=mount(document);
})();
