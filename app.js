/* NOVA ARCADE | Original mini-games, no external dependencies. */
'use strict';
const GAMES = [
  {id:'snake',name:'Neon Snake',genre:'arcade',tag:'CLASSIC',icon:'🐍',description:'Eat the glowing snacks. Keep growing. Avoid the walls.'},
  {id:'pong',name:'Cosmic Pong',genre:'arcade',tag:'RETRO',icon:'🏓',description:'Face the computer in a fast-paced space paddle duel.'},
  {id:'breakout',name:'Brick Blaster',genre:'arcade',tag:'ACTION',icon:'🧱',description:'Bounce the ball and smash every neon brick.'},
  {id:'memory',name:'Memory Flip',genre:'puzzle',tag:'BRAIN GAME',icon:'🃏',description:'Match all the cards with the fewest flips.'},
  {id:'twenty48',name:'2048 Merge',genre:'puzzle',tag:'NUMBERS',icon:'🔢',description:'Slide and combine tiles to reach the 2048 tile.'},
  {id:'tictactoe',name:'Tic Tac Toe',genre:'strategy',tag:'VERSUS CPU',icon:'❎',description:'Outsmart the computer in the classic 3-in-a-row.'}
];
const $ = (selector) => document.querySelector(selector);
const canvas = $('#gameCanvas'), ctx = canvas.getContext('2d');
const domGame = $('#domGame'), modal = $('#gameModal'), overlay = $('#gameOverlay');
const safeRead = (key, fallback) => {try {const data = localStorage.getItem(key);return data===null?fallback:JSON.parse(data)}catch{return fallback}};
const safeWrite = (key,val) => {try{localStorage.setItem(key,JSON.stringify(val))}catch{}};
let favorites = new Set(safeRead('nova:favorites',[]));
let bestScores = safeRead('nova:bests',{});
let filter = 'all', search = '', current = null, soundOn = false, audioCtx = null;
const colorFor = {arcade:'#77dce7',puzzle:'#f9c982',strategy:'#d5a5ff'};
function tone(freq=550,duration=.07){
  if(!soundOn)return;
  try{
    audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;
    g.gain.setValueAtTime(.045,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
    o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);
  }catch{}
}
$('#soundToggle').addEventListener('click',()=>{
 soundOn=!soundOn;$('#soundToggle').textContent=soundOn?'♫':'♪';$('#soundToggle').title=soundOn?'Sound on':'Sound off';$('#soundToggle').setAttribute('aria-label',soundOn?'Mute sound':'Unmute sound');tone(800);
});
function renderGames(){
 const list=GAMES.filter(game=>(filter==='all'||(filter==='favorites'?favorites.has(game.id):game.genre===filter))&&(game.name+' '+game.description+' '+game.genre).toLowerCase().includes(search));
 $('#gameCount').textContent=`${list.length} GAME${list.length!==1?'S':''} AVAILABLE`;
 $('#gamesGrid').replaceChildren(...list.map(game=>{
  const card=document.createElement('article');card.className='game-card';
  card.innerHTML=`<div class="game-visual ${game.id}" role="button" tabindex="0" aria-label="Play ${game.name}"><span class="card-badge">${game.tag}</span><span class="visual-icon" aria-hidden="true">${game.icon}</span><span class="card-play" aria-hidden="true">▶</span></div><div class="game-card-body"><div class="game-card-top"><h3>${game.name}</h3><button type="button" class="favorite-btn ${favorites.has(game.id)?'is-favorite':''}" aria-label="${favorites.has(game.id)?'Remove from':'Add to'} favorites" title="Favorite">${favorites.has(game.id)?'♥':'♡'}</button></div><p>${game.description}</p><div class="card-footer"><span class="card-tag" style="color:${colorFor[game.genre]}">● ${game.genre.toUpperCase()}</span><span class="card-score">BEST <b>${bestScores[game.id]||0}</b></span></div></div>`;
  const visual=card.querySelector('.game-visual');visual.addEventListener('click',()=>openGame(game.id));
  visual.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openGame(game.id)}});
  card.querySelector('.favorite-btn').addEventListener('click',()=>{
   if(favorites.has(game.id))favorites.delete(game.id);else favorites.add(game.id);
   safeWrite('nova:favorites',[...favorites]);renderGames();tone(750);
  });
  return card;
 }));
 $('#emptyState').hidden=list.length!==0;
 document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('is-selected',b.dataset.filter===filter));
 document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('is-active',b.dataset.nav===filter));
}
function changeFilter(next){filter=next;renderGames();$('#games').scrollIntoView({block:'start',behavior:'smooth'})}
$('#filterPills').addEventListener('click',e=>{const b=e.target.closest('button[data-filter]');if(b)changeFilter(b.dataset.filter)});
document.querySelectorAll('.nav-link').forEach(button=>button.addEventListener('click',()=>changeFilter(button.dataset.nav)));
$('#searchInput').addEventListener('input',e=>{search=e.target.value.trim().toLowerCase();renderGames()});
$('#resetFilters').addEventListener('click',()=>{search='';filter='all';$('#searchInput').value='';renderGames()});
$('#playFeatured').addEventListener('click',()=>openGame('snake'));
document.addEventListener('keydown',e=>{
 if(e.key==='/'&&modal.hidden&&document.activeElement!==$('#searchInput')){e.preventDefault();$('#searchInput').focus()}
 if(!modal.hidden){if(e.key==='Escape'){closeGame()}else if(e.key.toLowerCase()==='p'&&!e.repeat){togglePause()}}
});
function setScore(value){
 if(!current)return;
 current.score=value;$('#scoreValue').textContent=value;
 if(value>(bestScores[current.id]||0)){
  bestScores[current.id]=value;safeWrite('nova:bests',bestScores);$('#bestValue').textContent=value;
 }
}
function setState(state){$('#gameState').textContent=state.toUpperCase()}
function endGame(title,desc){if(!current)return;current.ended=true;current.paused=true;setState('Finished');$('#overlayTitle').textContent=title;$('#overlayText').textContent=desc;overlay.hidden=false;tone(350,.18)}
function createSession(id){
 const listeners=[],timers=[];let latestFrame=0;
 const session={id,score:0,paused:false,ended:false,
  on(target,event,callback,opts){target.addEventListener(event,callback,opts);listeners.push(()=>target.removeEventListener(event,callback,opts))},
  timeout(fn,ms){const t=setTimeout(fn,ms);timers.push(t);return t},
  frame(fn){latestFrame=requestAnimationFrame(fn);return latestFrame},
  destroy(){listeners.forEach(fn=>fn());timers.forEach(clearTimeout);cancelAnimationFrame(latestFrame)},
  pause(){},resume(){}
 };
 return session;
}
function openGame(id){
 closeGame();const game=GAMES.find(g=>g.id===id);if(!game)return;
 modal.hidden=false;document.body.style.overflow='hidden';
 $('#modalSymbol').textContent=game.icon;$('#modalTitle').textContent=game.name;$('#modalGenre').textContent=game.genre.toUpperCase();
 current=createSession(id);setScore(0);$('#bestValue').textContent=bestScores[id]||0;
 $('#gameCanvas').hidden=false;domGame.hidden=true;domGame.replaceChildren();overlay.hidden=true;$('#overlayAction').textContent='PLAY AGAIN ↻';$('#pauseButton').textContent='Ⅱ Pause';setState('Playing');
 $('#touchControls').hidden=!['snake','twenty48'].includes(id);
 const controllers={snake:playSnake,pong:playPong,breakout:playBreakout,memory:playMemory,twenty48:play2048,tictactoe:playTicTacToe};
 controllers[id](current);$('#playArea').focus({preventScroll:true});
}
function closeGame(){
 if(current){current.destroy();current=null}
 modal.hidden=true;document.body.style.overflow='';renderGames();
}
function restartGame(){if(current)openGame(current.id)}
function togglePause(){
 if(!current||current.ended)return;
 current.paused=!current.paused;
 $('#pauseButton').textContent=current.paused?'▶ Resume':'Ⅱ Pause';
 setState(current.paused?'Paused':'Playing');
 if(current.paused){$('#overlayTitle').textContent='PAUSED';$('#overlayText').textContent='Press P or Resume to continue.';$('#overlayAction').textContent='RESUME ▶';overlay.hidden=false}
 else{overlay.hidden=true;$('#overlayAction').textContent='PLAY AGAIN ↻'}
}
$('#pauseButton').addEventListener('click',togglePause);
$('#restartButton').addEventListener('click',restartGame);
$('#closeButton').addEventListener('click',closeGame);
$('.modal-backdrop').addEventListener('click',closeGame);
$('#overlayAction').addEventListener('click',()=>{if(current?.ended)restartGame();else togglePause()});
function setInstructions(s){$('#gameInstructions').textContent=s}
function roundRect(x,y,w,h,r=6,fill='#fff'){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function drawField(c1='#0a1020',c2='#10192a'){
 const g=ctx.createLinearGradient(0,0,0,480);g.addColorStop(0,c1);g.addColorStop(1,c2);ctx.fillStyle=g;ctx.fillRect(0,0,760,480);
 ctx.strokeStyle='#ffffff09';ctx.lineWidth=1;for(let x=0;x<=760;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,480);ctx.stroke()}for(let y=0;y<=480;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(760,y);ctx.stroke()}
}
function controlEvents(session,handler){
 const buttons=document.querySelectorAll('#touchControls button');
 buttons.forEach(btn=>session.on(btn,'click',()=>handler(btn.dataset.dir)));
 let start=null;session.on($('#playArea'),'touchstart',e=>{if(e.touches.length===1)start={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
 session.on($('#playArea'),'touchend',e=>{if(!start)return;const x=e.changedTouches[0].clientX-start.x,y=e.changedTouches[0].clientY-start.y;if(Math.max(Math.abs(x),Math.abs(y))>25)handler(Math.abs(x)>Math.abs(y)?x>0?'right':'left':y>0?'down':'up');start=null},{passive:true});
}
function playSnake(session){
 setInstructions('ARROW KEYS / WASD / SWIPE · Eat the pink dots, avoid walls and your tail · P to pause');
 canvas.width=750;canvas.height=480;
 const size=30,C=25,R=16;let snake=[{x:8,y:8},{x:7,y:8},{x:6,y:8}],dir={x:1,y:0},next={x:1,y:0},food,elapsed=0,last=0;
 function spawn(){const spaces=[];for(let y=0;y<R;y++)for(let x=0;x<C;x++)if(!snake.some(p=>p.x===x&&p.y===y))spaces.push({x,y});return spaces[Math.floor(Math.random()*spaces.length)]}
 food=spawn();
 const dirMap={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
 function move(key){if(session.paused||session.ended)return;const m={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[key];if(m&&!(m[0]===-dir.x&&m[1]===-dir.y))next={x:m[0],y:m[1]}}
 session.on(window,'keydown',e=>{if(dirMap[e.key]){e.preventDefault();move(dirMap[e.key])}});
 controlEvents(session,move);
 function paint(){ctx.fillStyle='#071b21';ctx.fillRect(0,0,750,480);ctx.strokeStyle='#ffffff0d';for(let i=0;i<C;i++)for(let j=0;j<R;j++)ctx.strokeRect(i*size,j*size,size,size);
  if(food){ctx.shadowColor='#ff72c5';ctx.shadowBlur=16;ctx.fillStyle='#ff74c9';ctx.beginPath();ctx.arc((food.x+.5)*size,(food.y+.5)*size,9,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
  snake.forEach((p,i)=>{ctx.shadowColor=i===0?'#65f9d3':'transparent';ctx.shadowBlur=i===0?17:0;roundRect(p.x*size+2,p.y*size+2,size-4,size-4,6,i===0?'#a8ffe0':`hsl(${164-i*2}, 74%, ${Math.max(28,61-i)}%)`)});ctx.shadowBlur=0;
 }
 function tick(){dir=next;const h={x:snake[0].x+dir.x,y:snake[0].y+dir.y};const ate=h.x===food.x&&h.y===food.y;const body=ate?snake:snake.slice(0,-1);
 if(h.x<0||h.x>=C||h.y<0||h.y>=R||body.some(p=>p.x===h.x&&p.y===h.y)){endGame('GAME OVER','The snake crashed. Beat your score next time!');return}
 snake.unshift(h);if(ate){setScore(session.score+10);tone(700);food=spawn();if(!food){endGame('YOU WIN','You filled the entire board!');return}}else snake.pop();
 }
 function animate(now){if(!current||current!==session)return;const dt=Math.min(now-last,100);last=now;if(!session.paused){elapsed+=dt;if(elapsed>Math.max(70,140-session.score/8)){tick();elapsed=0}}paint();session.frame(animate)}
 session.frame(animate);
}
function playPong(session){
 setInstructions('MOVE MOUSE / TOUCH or W/S / ↑↓ · First to 5 wins · P to pause');
 canvas.width=760;canvas.height=480;
 let py=190,ay=190,targetY=240,ball={x:380,y:240,vx:-300,vy:170},left=0,right=0,last=0;const pw=12,ph=90;let up=false,down=false;
 function serve(direction){ball={x:380,y:240,vx:direction*300,vy:(Math.random()-.5)*310}}
 session.on(window,'keydown',e=>{if(['ArrowUp','ArrowDown','w','s'].includes(e.key)){e.preventDefault();if(e.key==='ArrowUp'||e.key==='w')up=true;else down=true}});
 session.on(window,'keyup',e=>{if(e.key==='ArrowUp'||e.key==='w')up=false;if(e.key==='ArrowDown'||e.key==='s')down=false});
 function pointer(e){const r=canvas.getBoundingClientRect();targetY=(e.clientY-r.top)*canvas.height/r.height}
 session.on(canvas,'pointermove',pointer);session.on(canvas,'pointerdown',pointer);
 function draw(){drawField();ctx.setLineDash([9,12]);ctx.strokeStyle='#ffffff30';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(380,0);ctx.lineTo(380,480);ctx.stroke();ctx.setLineDash([]);
  roundRect(28,py,pw,ph,6,'#70e7ec');roundRect(720,ay,pw,ph,6,'#ca93fc');ctx.shadowBlur=20;ctx.shadowColor='#fff';ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,9,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.textAlign='center';ctx.font='bold 46px sans-serif';ctx.fillStyle='#ffffff55';ctx.fillText(left,310,64);ctx.fillText(right,450,64);
 }
 function step(dt){
  if(up)py-=425*dt;else if(down)py+=425*dt;else py+=(targetY-py-ph/2)*Math.min(1,7*dt);py=Math.max(0,Math.min(480-ph,py));
  ay+=Math.max(-310*dt,Math.min(310*dt,ball.y-ay-ph/2));ay=Math.max(0,Math.min(480-ph,ay));
  ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;if(ball.y<9||ball.y>471){ball.y=Math.max(9,Math.min(471,ball.y));ball.vy*=-1;tone(350)}
  const hitLeft=ball.vx<0&&ball.x<50&&ball.x>23&&ball.y>=py-9&&ball.y<=py+ph+9;
  const hitRight=ball.vx>0&&ball.x>711&&ball.x<739&&ball.y>=ay-9&&ball.y<=ay+ph+9;
  if(hitLeft||hitRight){const center=hitLeft?py+ph/2:ay+ph/2;const spin=(ball.y-center)/(ph/2);ball.vx*=-1.07;ball.vy=spin*270;ball.x=hitLeft?51:710;tone(470)}
  if(ball.x<-12){right++;if(right===5){endGame('CPU WINS','Try a different angle next round.');return}serve(1)}
  if(ball.x>772){left++;setScore(left);tone(880);if(left===5){endGame('YOU WIN!','You beat the cosmic computer.');return}serve(-1)}
 }
 function animate(t){if(current!==session)return;const dt=Math.min(.035,(t-last)/1000||0);last=t;if(!session.paused)step(dt);draw();session.frame(animate)}session.frame(animate);
}
function playBreakout(session){
 setInstructions('MOUSE / TOUCH or ← → / A D · Break all 50 bricks · You have 3 lives');
 canvas.width=760;canvas.height=480;let x=332,target=380,move=0,ball={x:380,y:390,vx:190,vy:-275},lives=3,last=0;
 const bricks=[];const rows=5,cols=10,bw=62,bh=19,gap=9,left=30,top=62;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)bricks.push({x:left+c*(bw+gap),y:top+r*(bh+gap),alive:true,row:r});
 function pointer(e){const rect=canvas.getBoundingClientRect();target=(e.clientX-rect.left)*760/rect.width}
 session.on(canvas,'pointermove',pointer);session.on(canvas,'pointerdown',pointer);
 session.on(window,'keydown',e=>{if(['ArrowLeft','ArrowRight','a','d'].includes(e.key)){e.preventDefault();move=['ArrowLeft','a'].includes(e.key)?-1:1}});
 session.on(window,'keyup',e=>{if(['ArrowLeft','ArrowRight','a','d'].includes(e.key))move=0});
 function paint(){drawField('#160d22','#090e19');ctx.textAlign='left';ctx.font='bold 15px sans-serif';ctx.fillStyle='#a9a7bf';ctx.fillText(`LIVES ${'♥ '.repeat(lives)}`,20,25);
  const colors=['#e77fc1','#c88cf6','#a88cfa','#85bdf1','#6cdfda'];bricks.forEach(b=>{if(b.alive){ctx.shadowBlur=8;ctx.shadowColor=colors[b.row]+'75';roundRect(b.x,b.y,bw,bh,5,colors[b.row])}});ctx.shadowBlur=13;ctx.shadowColor='#5ad8eb';roundRect(x,440,95,12,5,'#67deee');ctx.shadowBlur=16;ctx.shadowColor='#fff';ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
 function step(dt){
  if(move)x+=move*500*dt;else x+=(target-47-x)*Math.min(1,10*dt);x=Math.max(8,Math.min(657,x));
  const oldx=ball.x,oldy=ball.y;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
  if(ball.x<8||ball.x>752){ball.x=Math.max(8,Math.min(752,ball.x));ball.vx*=-1}if(ball.y<8){ball.y=8;ball.vy=Math.abs(ball.vy)}
  if(ball.vy>0&&ball.y+8>=440&&ball.y<452&&ball.x>=x-6&&ball.x<=x+101){ball.y=432;ball.vy=-Math.abs(ball.vy);ball.vx=(ball.x-(x+47.5))*7;tone(510)}
  for(const b of bricks){if(!b.alive)continue;if(ball.x+8>b.x&&ball.x-8<b.x+bw&&ball.y+8>b.y&&ball.y-8<b.y+bh){b.alive=false;ball.vy*=-1;setScore(session.score+10);tone(600+b.row*50);if(!bricks.some(v=>v.alive))endGame('BOARD CLEARED!','You smashed every brick. Amazing!');break}}
  if(ball.y>488){lives--;if(lives<=0){endGame('GAME OVER','Out of lives. Give it another shot!')}else{ball={x:380,y:390,vx:185,vy:-275};tone(220,.2)}}
 }
 function animate(t){if(current!==session)return;const dt=Math.min(.032,(t-last)/1000||0);last=t;if(!session.paused)step(dt);paint();session.frame(animate)}session.frame(animate);
}
function useDom(){canvas.hidden=true;domGame.hidden=false}
function playMemory(session){
 useDom();setInstructions('TAP / CLICK two cards to reveal a match · Find all 8 pairs');$('#pauseButton').textContent='Ⅱ Pause';
 const symbols=['🚀','⭐','👾','🪐','⚡','💎','🛸','🎮'];const deck=[...symbols,...symbols].map((symbol,i)=>({symbol,key:i}));for(let i=deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
 let flipped=[],matched=new Set(),locked=false,turns=0;const grid=document.createElement('div');grid.className='memory-grid';domGame.replaceChildren(grid);
 deck.forEach((item,i)=>{const btn=document.createElement('button');btn.className='memory-tile';btn.type='button';btn.textContent='✦';btn.setAttribute('aria-label',`Hidden card ${i+1}`);grid.append(btn);
 session.on(btn,'click',()=>{
  if(session.paused||session.ended||locked||matched.has(i)||flipped.includes(i))return;
  flipped.push(i);btn.textContent=item.symbol;btn.classList.add('flipped');btn.setAttribute('aria-label',item.symbol);tone(550);
  if(flipped.length===2){turns++;const [a,b]=flipped;if(deck[a].symbol===deck[b].symbol){matched.add(a);matched.add(b);flipped=[];grid.children[a].classList.add('matched');grid.children[b].classList.add('matched');setScore(matched.size/2);tone(880);if(matched.size===16)endGame('PERFECT MATCH! ',`All 8 pairs matched in ${turns} turns.`)}else{locked=true;session.timeout(()=>{if(current!==session)return;[a,b].forEach(n=>{grid.children[n].textContent='✦';grid.children[n].classList.remove('flipped');grid.children[n].setAttribute('aria-label',`Hidden card ${n+1}`)});flipped=[];locked=false},650)}}
 });
 });
}
function play2048(session){
 useDom();setInstructions('ARROW KEYS / WASD / SWIPE · Merge equal tiles to make 2048');
 let board=Array.from({length:4},()=>Array(4).fill(0)),moves=0;
 const grid=document.createElement('div');grid.className='twenty-grid';domGame.replaceChildren(grid);
 function add(){const free=[];board.forEach((r,y)=>r.forEach((v,x)=>{if(!v)free.push([y,x])}));if(free.length){const [y,x]=free[Math.floor(Math.random()*free.length)];board[y][x]=Math.random()<.9?2:4}}
 function paint(){grid.replaceChildren(...board.flat().map(n=>{const c=document.createElement('div');c.className='twenty-cell';c.dataset.n=n;c.textContent=n||'';return c}))}
 function compress(line){let vals=line.filter(Boolean),out=[];for(let i=0;i<vals.length;i++){if(vals[i]===vals[i+1]){out.push(vals[i]*2);setScore(session.score+vals[i]*2);i++}else out.push(vals[i])}while(out.length<4)out.push(0);return out}
 function available(){if(board.some(r=>r.includes(0)))return true;for(let y=0;y<4;y++)for(let x=0;x<4;x++)if((x<3&&board[y][x]===board[y][x+1])||(y<3&&board[y][x]===board[y+1][x]))return true;return false}
 function swipe(dir){if(session.paused||session.ended)return;const old=JSON.stringify(board);
 for(let k=0;k<4;k++){
  let line=(dir==='left'||dir==='right')?board[k].slice():board.map(row=>row[k]);
  if(dir==='right'||dir==='down')line.reverse();line=compress(line);if(dir==='right'||dir==='down')line.reverse();
  for(let n=0;n<4;n++){if(dir==='left'||dir==='right')board[k][n]=line[n];else board[n][k]=line[n]}
 }
 if(JSON.stringify(board)===old)return;moves++;add();paint();tone(320+Math.min(session.score/20,500));
 if(board.some(r=>r.includes(2048)))endGame('2048 REACHED! ',`You made 2048 in ${moves} moves!`);
 else if(!available())endGame('NO MORE MOVES',`You scored ${session.score} points. Try again!`);
 }
 add();add();paint();const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
 session.on(window,'keydown',e=>{if(keys[e.key]){e.preventDefault();swipe(keys[e.key])}});controlEvents(session,swipe);
}
function playTicTacToe(session){
 useDom();setInstructions('TAP / CLICK a square to place X · Play against the computer');
 let board=Array(9).fill(''),busy=false;
 const wrap=document.createElement('div');wrap.className='ttt-wrap';const grid=document.createElement('div');grid.className='ttt-grid';const caption=document.createElement('p');caption.className='ttt-caption';caption.textContent='YOU: X    •    CPU: O';wrap.append(grid,caption);domGame.replaceChildren(wrap);
 function result(){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,b,c] of lines)if(board[a]&&board[a]===board[b]&&board[b]===board[c])return board[a];return board.every(Boolean)?'tie':null}
 function paint(){grid.replaceChildren(...board.map((mark,i)=>{const b=document.createElement('button');b.type='button';b.className='ttt-cell '+(mark==='O'?'o':'');b.textContent=mark;b.disabled=Boolean(mark)||session.paused||session.ended||busy;b.setAttribute('aria-label',`Square ${i+1}${mark?' '+mark:''}`);session.on(b,'click',()=>turn(i));return b}))}
 function cpuPick(){const winlines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const mark of ['O','X'])for(const line of winlines){const open=line.filter(i=>!board[i]);if(open.length===1&&line.filter(i=>board[i]===mark).length===2)return open[0]}if(!board[4])return 4;const corners=[0,2,6,8].filter(i=>!board[i]);if(corners.length)return corners[Math.floor(Math.random()*corners.length)];return board.findIndex(x=>!x)}
 function check(){const r=result();if(r==='X'){setScore(1);endGame('YOU WIN!','Three in a row! You outsmarted the CPU.')}else if(r==='O'){endGame('CPU WINS','The computer won that round.')}else if(r==='tie'){endGame('IT’S A TIE','Neither player got three in a row.')}return Boolean(r)}
 function turn(i){if(session.paused||session.ended||busy||board[i])return;board[i]='X';tone(580);paint();if(check())return;
 busy=true;caption.textContent='CPU IS THINKING…';session.timeout(()=>{if(current!==session)return;const n=cpuPick();if(n>=0)board[n]='O';busy=false;caption.textContent='YOU: X    •    CPU: O';paint();check();tone(440)},360);
 }
 paint();
}
renderGames();
