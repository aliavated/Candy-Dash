(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id), W=960,H=540;
const screen=$('screen'), toast=$('toast');
let mode='menu',last=0,worldTime=0,cam=0,score=0,collected=0,hearts=3,best=0,soundOn=true,audio=null;
let particles=[],keys={},platforms=[],candies=[],enemies=[],decor=[],goal=null;
let toastTimer=0,shake=0,levelLength=3600,checkpoint=0;
try{best=Number(localStorage.getItem('candyDashBestV2'))||0}catch(e){}
const player={x:70,y:360,w:34,h:48,vx:0,vy:0,grounded:false,face:1,jumps:0,dash:0,dashCD:0,invuln:0,anim:0};
function rnd(a,b){return a+Math.random()*(b-a)}
function sfx(f=600,d=.08,type='sine'){
 if(!soundOn)return;
 try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch(e){}
}
function burst(x,y,color,n=12){for(let i=0;i<n;i++){let a=rnd(0,Math.PI*2),v=rnd(60,280);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.25,.7),max:.7,size:rnd(2,6),color})}}
function notify(t){toast.textContent=t;toast.classList.add('show');toastTimer=1.5}
function updateHud(){$('score').textContent=score;$('candyCount').textContent=collected;$('hearts').textContent=hearts?'♥ '.repeat(hearts).trim():'0';}
function show(title,text,buttons,kicker='CANDY KINGDOM',hint=''){
 $('screenTitle').textContent=title;$('screenText').textContent=text;$('kicker').textContent=kicker;$('hint').textContent=hint;
 const box=$('actions');box.innerHTML='';
 buttons.forEach((b,i)=>{let el=document.createElement('button');el.className='action '+(i===1?'alt':i>1?'blue':'');el.textContent=b.label;el.addEventListener('click',b.run);box.appendChild(el)});
 screen.classList.remove('off');
}
function hide(){screen.classList.add('off')}
function addPlatform(x,y,w,h=26,type='cake'){platforms.push({x,y,w,h,type})}
function addCandy(x,y,type='lolli'){candies.push({x,y,r:type==='star'?13:11,type,t:rnd(0,6)})}
function makeLevel(){
 platforms=[];candies=[];enemies=[];decor=[];
 addPlatform(-100,455,500,90,'start');
 addPlatform(465,405,160,30);addPlatform(690,350,145,28);
 addPlatform(900,425,360,90);addPlatform(1300,370,150,28);
 addPlatform(1515,315,160,28);addPlatform(1750,425,320,90);
 addPlatform(2140,385,155,28);addPlatform(2355,335,155,28);
 addPlatform(2580,425,370,90);addPlatform(3000,365,180,28);
 addPlatform(3235,410,260,90,'goal');
 for(let x=110;x<3500;x+=rnd(105,155)){let y=rnd(290,405);addCandy(x,y,Math.random()<.15?'star':'lolli')}
 enemies.push({x:1010,y:389,w:34,h:36,vx:-50,min:930,max:1210,alive:true});
 enemies.push({x:1840,y:389,w:34,h:36,vx:55,min:1780,max:2020,alive:true});
 enemies.push({x:2670,y:389,w:34,h:36,vx:-65,min:2600,max:2890,alive:true});
 for(let i=0;i<90;i++)decor.push({x:rnd(0,3650),y:rnd(30,310),r:rnd(2,6),type:Math.random()});
 goal={x:3420,y:320,w:42,h:90};
}
function reset(){
 makeLevel();player.x=70;player.y=380;player.vx=player.vy=0;player.grounded=false;player.jumps=0;player.dash=0;player.dashCD=0;player.invuln=0;player.face=1;player.anim=0;
 cam=0;score=0;collected=0;hearts=3;worldTime=0;particles=[];shake=0;checkpoint=0;updateHud();
}
function start(){reset();mode='playing';hide();last=performance.now();sfx(500,.12)}
function pause(){if(mode==='playing'){mode='paused';show('Take a breather','Your run is paused. The lollipops will wait.',[{label:'BACK TO THE RUN',run:()=>{mode='playing';hide();last=performance.now()}},{label:'RESTART RUN',run:start},{label:'MAIN MENU',run:menu}],'PAUSE MENU','Esc to resume');}else if(mode==='paused'){mode='playing';hide();last=performance.now()}}
function menu(){mode='menu';show('Candy Dash','Run, jump and dash through a candy kingdom full of lollipops, bouncy platforms and grumpy little candy monsters.',[{label:'START RUNNING',run:start},{label:'HOW TO PLAY',run:how},{label:'PERSONAL BEST',run:scores}],'A SUGAR-SWEET ADVENTURE','A/D or arrow keys to move · Space to jump · Shift to dash')}
function how(){show('How to play','Move with A/D or the arrow keys. Jump with Space, W or ↑. You can jump again in midair. Tap Shift or DASH to burst forward. Collect lollipops for points and stars for bonus points. Stomp monsters from above, but avoid touching them from the side.',[{label:'GOT IT — LET’S PLAY',run:start},{label:'BACK',run:menu}],'YOUR CONTROLS','Touch buttons are available below the game too.')}
function scores(){show('Your best run',`Your personal best is ${best} points. Every lollipop counts, and stars are worth extra.`,[{label:'BEAT THAT SCORE',run:start},{label:'BACK',run:menu}],'HIGH SCORE','Your best score stays saved in this browser.')}
function finish(won=false){
 mode=won?'won':'over';
 if(score>best){best=score;try{localStorage.setItem('candyDashBestV2',String(best))}catch(e){}}
 updateHud();sfx(won?880:170,.25,won?'sine':'triangle');
 show(won?'YOU DID IT!':'RUN OVER',won?`You made it through the candy kingdom with ${score} points and ${collected} lollipops!`:`You collected ${collected} lollipops and scored ${score} points. Ready to give it another go?`,[{label:'PLAY AGAIN',run:start},{label:'PERSONAL BEST',run:scores},{label:'MAIN MENU',run:menu}],won?'SWEET VICTORY':'ONE MORE TRY','Press R to restart any time.')}
function jump(){if(mode!=='playing')return;if(player.jumps<2){player.vy=player.jumps===0?-650:-590;player.jumps++;player.grounded=false;burst(player.x+player.w/2,player.y+player.h,'#fff4a8',5);sfx(player.jumps===1?430:650,.08)}}
function dash(){if(mode!=='playing'||player.dashCD>0)return;player.dash=.18;player.dashCD=.85;player.vx=player.face*720;burst(player.x+player.w/2,player.y+player.h/2,'#ff8bd0',8);sfx(280,.12,'sawtooth')}
function hurt(){
 if(player.invuln>0)return;hearts--;player.invuln=1.25;player.vy=-330;player.vx=-player.face*210;shake=.22;burst(player.x+player.w/2,player.y+player.h/2,'#ff4b98',18);sfx(160,.15,'sawtooth');updateHud();if(hearts<=0)finish(false);
}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function update(dt){
 worldTime+=dt;player.anim+=dt*12;if(player.invuln>0)player.invuln-=dt;if(player.dashCD>0)player.dashCD-=dt;if(player.dash>0)player.dash-=dt;if(shake>0)shake-=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show')}
 const left=keys.ArrowLeft||keys.a||keys.A,right=keys.ArrowRight||keys.d||keys.D;
 if(player.dash<=0){if(left){player.vx-=1500*dt;player.face=-1}else if(right){player.vx+=1500*dt;player.face=1}else player.vx*=Math.pow(.001,dt);player.vx=Math.max(-290,Math.min(290,player.vx))}
 player.vy+=1550*dt;player.vy=Math.min(900,player.vy);
 let oldY=player.y;player.x+=player.vx*dt;player.y+=player.vy*dt;player.x=Math.max(0,Math.min(levelLength-player.w,player.x));
 player.grounded=false;
 for(const p of platforms){if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldY+player.h<=p.y+8&&player.y+player.h>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.grounded=true;player.jumps=0}}
 if(player.y>H+120){hurt();player.y=280;player.vy=-100}
 for(const c of candies){if(c.got)continue;let dx=(player.x+player.w/2)-c.x,dy=(player.y+player.h/2)-c.y;if(dx*dx+dy*dy<(c.r+21)**2){c.got=true;collected++;score+=c.type==='star'?50:10;burst(c.x,c.y,c.type==='star'?'#fff16b':'#ff5bb2',12);sfx(c.type==='star'?900:650,.07);updateHud();if(c.type==='star')notify('STAR BONUS +50')}}
 for(const e of enemies){if(!e.alive)continue;e.x+=e.vx*dt;if(e.x<e.min||e.x+e.w>e.max)e.vx*=-1;
 if(overlap({x:player.x+5,y:player.y+5,w:player.w-10,h:player.h-5},e)){
   if(player.vy>80&&oldY+player.h<e.y+15){e.alive=false;player.vy=-430;score+=100;burst(e.x+e.w/2,e.y,'#ffb0de',18);sfx(740,.12);updateHud();notify('MONSTER STOMP +100')}
   else hurt();
 }}
 if(goal&&overlap(player,goal)){score+=250;finish(true);goal=null}
 cam=Math.max(0,Math.min(levelLength-W,player.x-W*.32));
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);
}
function rr(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function drawCandy(x,y,type,t=0,r=11){
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(worldTime*3+t)*.12);
 if(type==='star'){ctx.fillStyle='#ffe76c';ctx.strokeStyle='#ff9c35';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<10;i++){let a=-Math.PI/2+i*Math.PI/5,rad=i%2? r*.48:r;let xx=Math.cos(a)*rad,yy=Math.sin(a)*rad;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.closePath();ctx.fill();ctx.stroke()}
 else{ctx.strokeStyle='#fff6ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,23);ctx.stroke();ctx.fillStyle='#ff65b4';ctx.strokeStyle='#fff0fc';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#c72d95';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.62,-1.5,4.5);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-r*.3,-r*.35,2.5,0,Math.PI*2);ctx.fill()}
 ctx.restore();
}
function drawPlatform(p){
 let x=p.x-cam,y=p.y;
 if(p.type==='start')rr(x,y,p.w,p.h,12,'#a95a31');else rr(x,y,p.w,p.h,12,'#a95a31');
 rr(x,y-9,p.w,25,10,'#f5a3dc');rr(x,y-9,p.w,9,5,'#fff0fa');
 // wafer crosshatch
 ctx.save();ctx.beginPath();ctx.rect(x,y+18,p.w,p.h-18);ctx.clip();ctx.strokeStyle='#7d3b35';ctx.globalAlpha=.48;ctx.lineWidth=2;
 for(let i=-p.h;i<p.w+p.h;i+=22){ctx.beginPath();ctx.moveTo(x+i,y+18);ctx.lineTo(x+i+p.h,p.y+p.h);ctx.stroke();ctx.beginPath();ctx.moveTo(x+i,y+p.h);ctx.lineTo(x+i+p.h,y+18);ctx.stroke()}ctx.restore();
 for(let i=0;i<p.w;i+=37){ctx.fillStyle=['#ffdc61','#b77aff','#62d9ed','#ff6a9f'][Math.floor(i/37)%4];rr(x+i+8,y-6,8,4,2,ctx.fillStyle)}
}
function drawPlayer(){
 if(player.invuln>0&&Math.floor(worldTime*18)%2===0)return;
 let x=player.x-cam,y=player.y;
 ctx.save();ctx.translate(x+player.w/2,y+player.h/2);if(player.face<0)ctx.scale(-1,1);
 // shadow
 ctx.fillStyle='#602e8a30';ctx.beginPath();ctx.ellipse(0,25,17,4,0,0,Math.PI*2);ctx.fill();
 // legs
 ctx.strokeStyle='#7438ce';ctx.lineWidth=7;ctx.lineCap='round';let run=player.grounded?Math.sin(player.anim)*5:0;
 ctx.beginPath();ctx.moveTo(-7,13);ctx.lineTo(-9+run,21);ctx.moveTo(7,13);ctx.lineTo(9-run,21);ctx.stroke();
 // sneakers
 rr(-17+run,18,13,7,4,'#ff4ba7');rr(5-run,18,13,7,4,'#ff4ba7');
 // body hoodie
 rr(-15,-7,30,25,9,'#ff4b9f');rr(-8,-2,16,13,5,'#ff94c9');
 // hair
 ctx.fillStyle='#54264b';ctx.beginPath();ctx.ellipse(-2,-16,17,18,0,0,Math.PI*2);ctx.fill();
 // face
 ctx.fillStyle='#ffc89f';ctx.beginPath();ctx.ellipse(2,-11,13,14,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#54264b';ctx.beginPath();ctx.ellipse(-3,-12,2,3,0,0,Math.PI*2);ctx.ellipse(7,-12,2,3,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#b94d67';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(2,-7,4,.2,2.8);ctx.stroke();
 // ponytail + bow
 ctx.fillStyle='#54264b';ctx.beginPath();ctx.ellipse(-15,-22,10,7,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff3b9b';ctx.beginPath();ctx.moveTo(-9,-25);ctx.lineTo(-18,-33);ctx.lineTo(-16,-23);ctx.lineTo(-6,-32);ctx.closePath();ctx.fill();
 ctx.restore();
}
function drawEnemy(e){let x=e.x-cam,y=e.y;ctx.save();ctx.fillStyle='#702d9e';ctx.beginPath();ctx.ellipse(x+17,y+20,18,18,0,0,Math.PI*2);ctx.fill();rr(x-2,y+5,38,13,7,'#ffe2f3');for(let i=0;i<4;i++){ctx.fillStyle=['#ff65b4','#64d9ff','#ffe76c'][i%3];ctx.beginPath();ctx.arc(x+5+i*9,y+7,2.5,0,Math.PI*2);ctx.fill()}ctx.fillStyle='white';ctx.beginPath();ctx.arc(x+11,y+21,5,0,Math.PI*2);ctx.arc(x+23,y+21,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#321347';ctx.beginPath();ctx.arc(x+12,y+22,2.5,0,Math.PI*2);ctx.arc(x+22,y+22,2.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#321347';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+12,y+31);ctx.lineTo(x+23,y+29);ctx.stroke();ctx.restore()}
function draw(){
 let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#61caff');g.addColorStop(.58,'#c9e9ff');g.addColorStop(1,'#ffdaf0');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // sun and distant candy hills
 ctx.fillStyle='#fff1a7';ctx.beginPath();ctx.arc(795,83,40,0,Math.PI*2);ctx.fill();
 for(let i=0;i<8;i++){let x=((i*190-cam*.18)%1500+1500)%1500-100;ctx.fillStyle=['#ffb5de','#d3b4ff','#9be7e2'][i%3];ctx.beginPath();ctx.ellipse(x+60,400,150,110,0,Math.PI,Math.PI*2);ctx.fill()}
 // drifting clouds
 for(let i=0;i<6;i++){let x=((i*210-cam*.12)%1200+1200)%1200-100,y=70+(i%3)*65;ctx.fillStyle='#ffffffb8';ctx.beginPath();ctx.arc(x,y,24,0,Math.PI*2);ctx.arc(x+28,y-9,30,0,Math.PI*2);ctx.arc(x+58,y,23,0,Math.PI*2);ctx.fill()}
 // sprinkle sparkle background
 for(const d of decor){let x=d.x-cam*.4;if(x>-10&&x<W+10){ctx.globalAlpha=.5;ctx.fillStyle=d.type>.5?'#fff':'#ff65b7';ctx.beginPath();ctx.arc(x,d.y,d.r,0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1;
 ctx.save();if(shake>0)ctx.translate(rnd(-4,4),rnd(-3,3));
 // candy river
 ctx.fillStyle='#55d7f5';ctx.fillRect(0,475,W,65);ctx.strokeStyle='#b9f8ff';ctx.lineWidth=5;
 for(let x=-80-(cam%120);x<W+100;x+=120){ctx.beginPath();ctx.moveTo(x,494);ctx.quadraticCurveTo(x+30,477,x+60,494);ctx.quadraticCurveTo(x+90,511,x+120,494);ctx.stroke()}
 for(const p of platforms)if(p.x+p.w>cam-50&&p.x<cam+W+50)drawPlatform(p);
 for(const c of candies)if(!c.got&&c.x>cam-30&&c.x<cam+W+30)drawCandy(c.x-cam,c.y,c.type,c.t,c.r);
 for(const e of enemies)if(e.alive)drawEnemy(e);
 if(goal){let x=goal.x-cam;ctx.fillStyle='#fff';ctx.fillRect(x+18,goal.y,6,135);ctx.fillStyle='#ff3f9e';ctx.beginPath();ctx.moveTo(x+24,goal.y);ctx.lineTo(x+78,goal.y+16);ctx.lineTo(x+24,goal.y+33);ctx.closePath();ctx.fill();ctx.fillStyle='#ffe86c';ctx.beginPath();ctx.arc(x+20,goal.y-5,10,0,Math.PI*2);ctx.fill()}
 drawPlayer();
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x-cam*.3,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.restore();
 // level progress
 rr(18,18,180,9,5,'#ffffff8c');rr(18,18,180*Math.min(1,player.x/goal.x),9,5,'#ff3d9e');
 ctx.fillStyle='#4b2670';ctx.font='600 13px Fredoka, sans-serif';ctx.fillText('SWEET VALLEY',18,44);
 if(mode==='playing'&&player.dashCD>0){rr(W-118,20,100,8,4,'#ffffff8c');rr(W-118,20,100*(1-player.dashCD/.85),8,4,'#9a54ed');ctx.fillStyle='#4b2670';ctx.fillText('DASH',W-118,43)}
}
function frame(now){let dt=Math.min((now-last)/1000||0,.033);last=now;if(mode==='playing')update(dt);else{worldTime+=dt*.3;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('show')}}draw();requestAnimationFrame(frame)}
window.addEventListener('keydown',e=>{let k=e.key;if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k))e.preventDefault();if(e.repeat&&[' ','ArrowUp','w','W','Shift'].includes(k))return;keys[k]=true;if(k===' '||k==='ArrowUp'||k==='w'||k==='W')jump();if(k==='Shift')dash();if(k==='Escape')pause();if(k==='r'||k==='R'){if(mode==='playing'||mode==='over'||mode==='won')start();}});
window.addEventListener('keyup',e=>{keys[e.key]=false});
function hold(id,key){let b=$(id);const down=e=>{e.preventDefault();keys[key]=true},up=e=>{e.preventDefault();keys[key]=false};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up)}
hold('leftBtn','ArrowLeft');hold('rightBtn','ArrowRight');
$('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();jump()});
$('dashBtn').addEventListener('pointerdown',e=>{e.preventDefault();dash()});
$('playBtn').addEventListener('click',start);$('pauseBtn').addEventListener('click',pause);
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'SOUND ON':'SOUND OFF';if(soundOn)sfx(650,.07)});
reset();menu();last=performance.now();requestAnimationFrame(frame);
})();
