import { MAPS, WEAPONS, SKINS, GLOVES, clamp, blocked, moveActor, lineOfSight, findPath, applyDamage, purchase, roundWinner } from './core.js';
import { mapArt, makeOperator, drawOperator, textures, hex, tint, WEAPON_FILES, loadWeaponSprites, weaponSpriteReady } from './art.js';
import { MP, C2S, canStart } from './net.js';
import { defaultMpUrl, createMpClient } from './mp.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const canvas=$('#game'),ctx=canvas.getContext('2d',{alpha:false}),mini=$('#minimap'),mc=mini.getContext('2d');
const settings={skin:0,glove:0,sensitivity:1,volume:.5,quality:'high',motion:true,difficulty:'normal',map:0,mpNick:'',mpServer:''};
try{const saved=JSON.parse(localStorage.getItem('sector-settings')||'{}');for(const k in settings)if(typeof saved[k]===typeof settings[k])settings[k]=saved[k];}catch{}
settings.skin=clamp(Math.floor(settings.skin),0,2);settings.glove=clamp(Math.floor(settings.glove),0,2);settings.map=clamp(Math.floor(settings.map),0,2);settings.sensitivity=clamp(settings.sensitivity,.3,2.5);settings.volume=clamp(settings.volume,0,1);
const save=()=>{try{localStorage.setItem('sector-settings',JSON.stringify(settings));}catch{}};
let map=MAPS[settings.map],wallTextures=[],blueSprite,redSprite,weaponSprites={};
let state='lobby',phase='buy',paused=false,modal='',player,actors=[],round=0,score=[0,0],clock=20,kills=0,deaths=0;
let pitch=0,aiming=false,shootHeld=false,nextShot=0,reload=0,reloadTotal=0,reloadStage=0,recoil=0,hitTime=0,hurtTime=0,walk=0,jump=0,jumpVelocity=0,stepTimer=0,intermission=0,elapsed=0;
let zbuffer=[],keys=new Set(),lastTime=performance.now(),hudTimer=0,feed=[],toastTimer,feedTimer=0,dragging=false,lookTouch=null,stick={x:0,y:0},touchFire=false;
let mpClient=null,mpRoom=null,mpMyId=null,mpMode=false,mpRemotes=new Map(),mpSendTimer=0,mpChat=[],mpRooms=[],mpReloadT=0,mpWired=false,mpListTimer=0,mpResultShown=false,mpSilentClose=false;
let audio;
const touchDevice=matchMedia('(pointer: coarse)').matches;
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
function initAudio(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch{}}
function sound(kind='shot',weapon='pistol'){
  if(!audio||settings.volume===0)return;
  const t=audio.currentTime,g=audio.createGain();g.connect(audio.destination);const v=settings.volume;
  if(kind==='shot'||kind==='step'||kind==='hit'){
    const dur=kind==='shot'?(weapon==='shotgun'?.24:.12):.055,buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*dur),audio.sampleRate),d=buffer.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);
    const n=audio.createBufferSource();n.buffer=buffer;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=kind==='step'?400:kind==='hit'?1200:weapon==='shotgun'?1800:weapon==='kalash'?2200:2800;n.connect(filter);filter.connect(g);g.gain.value=v*(kind==='shot'?.38:kind==='step'?.1:.12);n.start();
  }else{const o=audio.createOscillator();o.type=kind==='empty'?'square':'sine';o.frequency.setValueAtTime(kind==='buy'?750:kind==='reload'?230:kind==='win'?660:180,t);o.frequency.exponentialRampToValueAtTime(kind==='buy'?1200:kind==='win'?990:90,t+.12);o.connect(g);g.gain.setValueAtTime(v*.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.start();o.stop(t+.2);}
}

function renderCards(){
  $('#map-cards').innerHTML=MAPS.map((m,i)=>`<button class="map-card ${settings.map===i?'selected':''}" data-map="${i}" aria-pressed="${settings.map===i}"><div class="map-image"><canvas width="600" height="280" aria-label="${m.name}"></canvas><span class="map-number">0${i+1} / SECTOR</span><span class="map-check">${settings.map===i?'✓':''}</span></div><div class="map-detail"><h3>${m.name}</h3><p>${m.desc}</p><div class="map-tags"><span>${m.tag}</span><span>${m.label} ↗</span></div></div></button>`).join('');
  $$('.map-card').forEach((card,i)=>{mapArt(card.querySelector('canvas'),MAPS[i]);card.onclick=()=>{settings.map=i;map=MAPS[i];save();renderCards();mapArt($('#hero-canvas'),map,true);};});
}
function renderOperator(){
  $('#skin-options').innerHTML=SKINS.map((s,i)=>`<button class="option ${settings.skin===i?'selected':''}" data-skin="${i}"><i style="background:${s.color}"></i>${s.name}</button>`).join('');
  $('#glove-options').innerHTML=GLOVES.map((s,i)=>`<button class="option ${settings.glove===i?'selected':''}" data-glove="${i}"><i style="background:${s.color}"></i>${s.name}</button>`).join('');
  $$('[data-skin]').forEach(b=>b.onclick=()=>{settings.skin=Number(b.dataset.skin);save();renderOperator();});
  $$('[data-glove]').forEach(b=>b.onclick=()=>{settings.glove=Number(b.dataset.glove);save();renderOperator();});
  drawOperator($('#operator-canvas'),settings.skin,settings.glove);
}
function tab(name){$$('.tab').forEach(e=>e.hidden=e.id!==`tab-${name}`);$$('.nav').forEach(e=>e.classList.toggle('active',e.dataset.tab===name));if(name==='operator')renderOperator();if(name==='mp')mpTabOpened();}
$$('.nav').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$$('[data-go-play]').forEach(b=>b.onclick=()=>tab('play'));
for(const key of ['sensitivity','volume','quality','motion','difficulty']){const e=$(`#${key}`);if(e.type==='checkbox')e.checked=settings[key];else e.value=settings[key];e.addEventListener('input',()=>{settings[key]=e.type==='checkbox'?e.checked:e.type==='range'?Number(e.value):e.value;save();if(key==='quality')resize();});}
renderCards();renderOperator();mapArt($('#hero-canvas'),map,true);

function release(){shootHeld=false;touchFire=false;keys.clear();stick={x:0,y:0};if(document.pointerLockElement===canvas)document.exitPointerLock();}
function lock(){if(touchDevice)return;try{const p=canvas.requestPointerLock?.();p?.catch(()=>toast('Натисни на ігровий екран. Також можна оглядатися, затиснувши мишу.'));}catch{toast('Для огляду затисни мишу на ігровому екрані.');}}
function dialog(type,html){modal=type;$('#dialog').innerHTML=html;$('#overlay').hidden=false;release();$('#dialog').querySelector('button')?.focus();}
function closeDialog(resume=true){$('#overlay').hidden=true;modal='';if(resume&&state==='playing'){paused=false;lock();}}
function header(label,title){return `<div class="dialog-header"><span class="eyebrow">${label}</span><button class="dialog-close" aria-label="Закрити">×</button></div><h2>${title}</h2>`;}
function help(){dialog('help',header('ПОЛЬОВИЙ ДОВІДНИК','КЕРУВАННЯ')+`<p>Перемагай у раундах, заробляй кредити та купуй зброю. Зелені оператори — союзники, помаранчеві — суперники.</p><div class="control-list">${[['W A S D','Рух'],['МИША','Огляд'],['ЛКМ','Постріл'],['ПКМ','Прицілювання'],['R','Перезаряджання'],['1 / 2','Основна / пістолет'],['B','Магазин під час підготовки'],['SHIFT','Тихий крок'],['CTRL','Присідання'],['SPACE','Стрибок'],['ESC','Пауза'],['TAB','Рахунок команди']].map(([k,t])=>`<div><kbd>${k}</kbd>${t}</div>`).join('')}</div><p>На сенсорному екрані: джойстик зліва, огляд правою половиною екрана, кнопки пострілу та перезаряджання справа. Після поразки спостерігай за союзником.</p>`);$('.dialog-close').onclick=()=>closeDialog(false);}
function credits(){dialog('credits',header('СЕКТОР / V.01','ПРО ГРУ ТА РЕСУРСИ')+`<p>Браузерний прототип: три мапи, командні бої з ботами, магазин і кастомізація. Мапи, ілюстрації, текстури та звуки цієї збірки створені в коді проєкту.</p><p>Для наступного оновлення підібрані ресурси з itch.io. Вони ще не включені до цієї збірки:</p><ul class="credits-list"><li><a href="https://f8studios.itch.io/snakes-authentic-gun-sounds" target="_blank" rel="noopener">SnakeF8 — звуки зброї</a></li><li><a href="https://kronbits.itch.io/matriax-free-cg-textures" target="_blank" rel="noopener">Kronbits — текстури, CC0</a></li><li><a href="https://quaternius.itch.io/50-lowpoly-guns" target="_blank" rel="noopener">Quaternius — моделі зброї, CC0</a></li><li><a href="https://kenney-assets.itch.io/prototype-textures" target="_blank" rel="noopener">Kenney — текстури прототипу, CC0</a></li></ul><p>Гра працює локально у браузері. Налаштування зберігаються лише на твоєму пристрої.</p>`);$('.dialog-close').onclick=()=>closeDialog(false);}
$('#help-open').onclick=help;$('#credits-open').onclick=credits;$('#footer-credits').onclick=credits;

function actor(x,y,team,name){return {x,y,team,name,hp:100,armor:0,angle:team?Math.PI*1.2:.6,cooldown:1.4+Math.random(),path:[],pathTimer:0,moving:false,flash:0,seen:0,money:2500,primary:null,weapon:'pistol',inventory:{pistol:{ammo:12,reserve:36}},shots:0,spray:0};}
function start(){
  initAudio();state='playing';phase='buy';paused=false;round=0;score=[0,0];kills=deaths=0;feed=[];map=MAPS[settings.map];
  wallTextures=textures(map);blueSprite=makeOperator(SKINS[settings.skin].color,'#c3f66b',GLOVES[settings.glove].color);redSprite=makeOperator('#aa7853','#ffbd73');
  weaponSprites=loadWeaponSprites();
  player=actor(...map.blue[0],0,'ТИ');player.isPlayer=true;actors=[player,actor(...map.blue[1],0,'РИСЬ'),actor(...map.blue[2],0,'СОКІЛ'),...map.red.map((p,i)=>actor(...p,1,['КВАРЦ','ТІНЬ','ГРІМ'][i]))];
  $('#lobby').hidden=true;canvas.hidden=false;$('#hud').hidden=false;$('#touch-controls').hidden=!touchDevice;resize();nextRound();
}
$('#start').onclick=start;$('#quick-play').onclick=start;
function nextRound(){
  round++;phase='buy';clock=20;paused=false;reload=0;reloadTotal=0;reloadStage=0;nextShot=0;pitch=0;jump=0;jumpVelocity=0;recoil=0;hitTime=0;hurtTime=0;aiming=false;shootHeld=false;touchFire=false;keys.clear();
  actors.forEach((a,i)=>{const pos=a.team?map.red[i-3]:map.blue[i];a.x=pos[0];a.y=pos[1];a.angle=a.team?3.8:.72;
    if(a.hp<=0){a.primary=null;a.armor=0;a.weapon='pistol';a.inventory={pistol:{ammo:12,reserve:36}};}
    a.hp=100;a.path=[];a.pathTimer=0;a.cooldown=1.5;a.flash=0;a.seen=0;a.shots=0;a.spray=0;
    for(const id of ['pistol',a.primary].filter(Boolean))a.inventory[id]={ammo:WEAPONS[id].size,reserve:WEAPONS[id].size*3};
    if(!a.isPlayer){if(!a.primary)purchase(a,a.money>=3050?'rifle':'smg');if(a.armor<50)purchase(a,'armor');}
  });
  $('#game-message').textContent='';$('#kill-feed').innerHTML='';feed=[];updateHUD();openShop();
}
function beginFight(){closeDialog(false);paused=false;phase='fight';clock=120;keys.clear();shootHeld=false;touchFire=false;$('#game-message').textContent='ТРИМАЙ СЕКТОР';setTimeout(()=>{if(state==='playing'&&phase==='fight'&&player.hp>0)$('#game-message').textContent='';},1800);sound('win');updateHUD();}
function inBuyZone(){return Math.hypot(player.x-map.blue[0][0],player.y-map.blue[0][1])<4;}
function openShop(){
  if(state!=='playing'||phase!=='buy'||player.hp<=0)return toast('Магазин доступний під час підготовки до раунду');
  if(!inBuyZone())return toast('Повернися до стартової зони');
  reload=0;reloadTotal=0;reloadStage=0;
  const items=Object.entries(WEAPONS).filter(([,w])=>w.price).map(([id,w])=>({id,...w}));items.push({id:'armor',name:'БРОНЕЖИЛЕТ',type:'ЗАХИСТ',price:650,icon:'◇',description:'50 броні · поглинає частину шкоди в корпус'});
  dialog('shop',`<div class="dialog-header"><span class="eyebrow">СПОРЯДЖЕННЯ / РАУНД ${round}</span><span class="shop-balance">₡ ${player.money.toLocaleString('uk')}</span></div><h2>ПІДГОТУЙСЯ ДО БОЮ</h2><p>Закупівля: <b id="shop-timer">${Math.ceil(clock)}</b> с · Пістолет і патрони видаються безкоштовно.</p><div class="shop-grid">${items.map(w=>{const owned=w.id==='armor'?player.armor>=50:player.primary===w.id,disabled=owned||player.money<w.price;return `<article class="shop-item"><small>${w.type}</small><h3>${w.name}</h3>${WEAPON_FILES[w.id]?`<img class="gun-sprite" src="${WEAPON_FILES[w.id]}" alt="Зброя ${w.name}" draggable="false">`:`<div class="gun-icon">${w.icon}</div>`}<p>${w.description}</p><button data-buy="${w.id}" ${disabled?'disabled':''}><span>${owned?'У СПОРЯДЖЕННІ':player.money<w.price?'БРАКУЄ КРЕДИТІВ':'КУПИТИ'}</span><span>₡ ${w.price.toLocaleString('uk')}</span></button></article>`;}).join('')}</div><div class="shop-foot"><p>Основна: ${player.primary?WEAPONS[player.primary].name:'немає'} · Броня: ${Math.ceil(player.armor)}<br>Заміна основної зброї — без повернення її вартості.</p><button id="shop-ready" class="primary">У БІЙ <span>→</span></button></div><button id="shop-close" class="text-button">ЗАКРИТИ МАГАЗИН / B</button>`);
  $$('[data-buy]').forEach(b=>b.onclick=()=>{
    if(phase!=='buy'||!inBuyZone())return;
    const id=b.dataset.buy;
    if(id!=='armor'&&player.primary&&player.primary!==id){const oldName=WEAPONS[player.primary].name;b.innerHTML=`ЗАМІНИТИ ${oldName}? НАТИСНИ ЩЕ РАЗ`;if(b.dataset.confirm!=='yes'){b.dataset.confirm='yes';return;}}
    const result=purchase(player,id);if(result.ok){sound('buy');openShop();updateHUD();}else toast(result.message);
  });
  $('#shop-ready').onclick=()=>{beginFight();lock();};$('#shop-close').onclick=()=>closeDialog();
}
function pause(){if(state!=='playing'||phase==='finished')return;if(mpMode)return mpPause();paused=true;aiming=false;dialog('pause',header('ОПЕРАЦІЮ ПРИЗУПИНЕНО','ПАУЗА')+`<p>${map.name} · Раунд ${round} · Рахунок ${score[0]} : ${score[1]}</p><div class="dialog-actions"><button id="resume" class="primary">ПРОДОВЖИТИ <span>→</span></button><button id="restart" class="secondary">НОВИЙ МАТЧ</button><button id="leave" class="secondary">У ГОЛОВНЕ МЕНЮ</button></div>`);$('#resume').onclick=()=>closeDialog();$('.dialog-close').onclick=()=>closeDialog();$('#restart').onclick=start;$('#leave').onclick=leave;}
$('#pause-button').onclick=pause;
function leave(){if(mpClient||mpMode){mpDisconnect();return;}state='lobby';paused=false;closeDialog(false);release();canvas.hidden=true;$('#hud').hidden=true;$('#lobby').hidden=false;tab('play');}
function endRound(winner){
  phase='intermission';intermission=3.5;reload=0;reloadTotal=0;reloadStage=0;shootHeld=false;touchFire=false;aiming=false;
  if(winner>=0)score[winner]++;
  actors.forEach(a=>a.money=Math.min(10000,a.money+(a.team===winner?1500:1000)));
  $('#game-message').textContent=winner===0?'РАУНД ЗА ВАРТОЮ':winner===1?'РАУНД ЗА РЕЙДОМ':'НІЧИЯ';sound(winner===0?'win':'empty');updateHUD();
}
function endMatch(){
  phase='finished';const won=score[0]>score[1];dialog('result',`<span class="eyebrow">ОПЕРАЦІЮ ЗАВЕРШЕНО / ${map.name}</span><h2>${score[0]===score[1]?'НІЧИЯ':won?'СЕКТОР ПІД КОНТРОЛЕМ':'СЕКТОР ВТРАЧЕНО'}</h2><div class="result-score"><span>${score[0]}</span><small>:</small><span>${score[1]}</span></div><div class="result-stats"><span>${kills} УСУНЕНЬ</span><span>${deaths} СМЕРТЕЙ</span><span>${round} РАУНДІВ</span></div><div class="dialog-actions"><button id="again" class="primary">ЩЕ ОДИН МАТЧ <span>↗</span></button><button id="menu" class="secondary">ОБРАТИ ІНШУ МАПУ</button></div>`);$('#again').onclick=start;$('#menu').onclick=leave;
}
function logKill(source,target){feed.unshift({source:source.name,target:target.name,t:6});feed=feed.slice(0,4);paintFeed();}
function paintFeed(){$('#kill-feed').innerHTML=feed.map(f=>`<div><b>${f.source}</b> &nbsp; ━ &nbsp; <em>${f.target}</em></div>`).join('');}
function damage(target,n,source,head=false){if(mpMode){if(target.isRemote&&mpClient)mpClient.send({t:C2S.SHOOT,weapon:player.weapon,target:target.mpId,head});return;}if(target.hp<=0)return;applyDamage(target,n,head);if(target.isPlayer){hurtTime=.45;sound('hit');}if(target.hp<=0){source.money=Math.min(10000,source.money+200);logKill(source,target);if(source.isPlayer)kills++;if(target.isPlayer){deaths++;reload=0;reloadTotal=0;reloadStage=0;shootHeld=false;touchFire=false;$('#game-message').textContent='ТИ ВИБУВ · СПОСТЕРЕЖЕННЯ ЗА СОЮЗНИКОМ';}sound('hit');}}
function currentWeapon(){return WEAPONS[player.weapon];}
function switchWeapon(id){if(mpMode)return;if(!player||player.hp<=0||!player.inventory[id])return;player.weapon=id;reload=0;reloadTotal=0;reloadStage=0;nextShot=.2;updateHUD();}
function mpSwitchWeapon(id){if(!player||player.hp<=0||!WEAPONS[id])return;player.weapon=id;nextShot=.25;sound('reload');updateHUD();}
function reloadProgress(){if(reload<=0||reloadTotal<=0)return 0;return clamp(1-reload/reloadTotal,0,1);}
function reloadWeapon(){if(mpMode||state!=='playing'||paused||modal||phase!=='fight'||player.hp<=0||reload>0)return;const w=currentWeapon(),inv=player.inventory[player.weapon];if(inv.ammo>=w.size||!inv.reserve)return;reload=w.reload;reloadTotal=w.reload;reloadStage=0;aiming=false;sound('reload');updateHUD();}
function shoot(){
  if(state!=='playing'||(phase!=='fight'&&!mpMode)||paused||modal||player.hp<=0||reload>0||nextShot>0)return;
  const w=currentWeapon();
  if(mpMode){
    if(mpReloadT>0)return;
    if(mpMyAmmo()<=0){sound('empty');nextShot=.3;return;}
    nextShot=w.rate;recoil=1;sound('shot',player.weapon);
    if(w.automatic)player.spray=Math.min(1.5,(player.spray||0)+(player.weapon==='kalash'?.16:.07));
    const spread=w.spread*(aiming?.45:1)*(player.moving?1.8:1)*(w.automatic?1+(player.spray||0)*2:1);
    const mAngle=player.angle+(Math.random()-.5)*spread;
    const candidates=actors.filter(a=>a.isRemote&&a.hp>0).map(a=>{const dx=a.x-player.x,dy=a.y-player.y,d=Math.hypot(dx,dy),da=Math.atan2(Math.sin(Math.atan2(dy,dx)-mAngle),Math.cos(Math.atan2(dy,dx)-mAngle));return {a,d,da};}).sort((a,b)=>a.d-b.d);
    for(const {a,d,da} of candidates){
      const projection=canvas.width/(2*(aiming?.5:.78)),horizon=canvas.height*.48+pitch*canvas.height+(settings.motion?jump*50:0)+(keys.has('ControlLeft')?canvas.height*.06:0);
      const height=.5+(horizon-canvas.height*.5)*d/projection;if(height<0||height>1.05||Math.abs(da)>Math.atan2(.24,d)||!lineOfSight(map,player.x,player.y,a.x,a.y))continue;
      damage(a,0,player,height>.8);hitTime=.15;sound('hit');break;
    }
    updateHUD();return;
  }
  const inv=player.inventory[player.weapon];if(!inv.ammo){sound('empty');nextShot=.3;reloadWeapon();return;}
  inv.ammo--;nextShot=w.rate;recoil=1;sound('shot',player.weapon);let anyHit=false;
  if(w.automatic)player.spray=Math.min(1.5,(player.spray||0)+(player.weapon==='kalash'?.16:.07));
  for(let pellet=0;pellet<w.pellets;pellet++){
    const spread=w.spread*(aiming?.45:1)*(player.moving?1.8:1)*(w.automatic?1+(player.spray||0)*2:1);const angle=player.angle+(Math.random()-.5)*spread;
    const candidates=actors.filter(a=>a.team!==player.team&&a.hp>0).map(a=>{const dx=a.x-player.x,dy=a.y-player.y,d=Math.hypot(dx,dy),da=Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle));return {a,d,da};}).sort((a,b)=>a.d-b.d);
    for(const {a,d,da} of candidates){
      const projection=canvas.width/(2*(aiming?.5:.78)),horizon=canvas.height*.48+pitch*canvas.height+(settings.motion?jump*50:0)+(keys.has('ControlLeft')?canvas.height*.06:0);
      const height=.5+(horizon-canvas.height*.5)*d/projection;if(height<0||height>1.05||Math.abs(da)>Math.atan2(.24,d)||!lineOfSight(map,player.x,player.y,a.x,a.y))continue;
      const head=height>.8,falloff=player.weapon==='shotgun'?clamp(1-d/14,.15,1):1;damage(a,w.damage*falloff*(head?(w.headMult||2):1),player,head);anyHit=true;break;
    }
  }
  if(anyHit){hitTime=.15;sound('hit');}updateHUD();
}

function updatePlayer(dt){
  player.moving=false;if(player.hp<=0||modal)return;
  const right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+stick.x,forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'))-stick.y,len=Math.max(1,Math.hypot(right,forward));
  const speed=keys.has('ShiftLeft')||keys.has('ControlLeft')?1.8:3.3;
  const dx=(Math.cos(player.angle)*forward-Math.sin(player.angle)*right)*speed*dt/len,dy=(Math.sin(player.angle)*forward+Math.cos(player.angle)*right)*speed*dt/len;
  moveActor(map,player,dx,dy);player.moving=Math.hypot(dx,dy)>.001;
  if(player.moving){walk+=dt*speed*3;stepTimer-=dt;if(stepTimer<=0){stepTimer=keys.has('ShiftLeft')?.6:.4;sound('step');}}
  if(keys.has('ArrowLeft'))player.angle-=dt*1.8;if(keys.has('ArrowRight'))player.angle+=dt*1.8;
  if(jump>0||jumpVelocity>0){jumpVelocity-=dt*4;jump=Math.max(0,jump+jumpVelocity*dt);if(jump===0)jumpVelocity=0;}
}
function updateBots(dt){
  const level=settings.difficulty==='easy'?.55:settings.difficulty==='hard'?1.35:1;
  for(const a of actors){if(a.isPlayer||a.hp<=0)continue;a.flash=Math.max(0,a.flash-dt);a.cooldown-=dt;a.pathTimer-=dt;
    const enemies=actors.filter(e=>e.team!==a.team&&e.hp>0).sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y));if(!enemies.length)continue;
    const visible=enemies.find(e=>Math.hypot(e.x-a.x,e.y-a.y)<15&&lineOfSight(map,a.x,a.y,e.x,e.y));const target=visible||enemies[0];const distance=Math.hypot(target.x-a.x,target.y-a.y);a.moving=false;
    if(visible){a.angle=Math.atan2(target.y-a.y,target.x-a.x);a.seen+=dt;const skill=a.team===0?.85:level;
      if(a.cooldown<=0&&a.seen>.45){a.cooldown=(.58+Math.random()*.65)/skill;a.flash=.09;a.shots++;const chance=clamp(.85-distance*.04,.15,.75)*skill;if(Math.random()<chance)damage(target,WEAPONS[a.weapon].damage*.65,a);if(a.shots>=WEAPONS[a.weapon].size){a.cooldown=WEAPONS[a.weapon].reload;a.shots=0;}}
    }else a.seen=0;
    if(!visible||distance>7){if(a.pathTimer<=0){a.path=findPath(map,a.x,a.y,target.x,target.y);a.pathTimer=.9+Math.random()*.35;}if(a.path.length){const p=a.path[0],dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);if(d<.12)a.path.shift();else{const s=Math.min(d,dt*(a.team===0?1.5:1.35));moveActor(map,a,dx/d*s,dy/d*s);a.moving=true;if(!visible)a.angle=Math.atan2(dy,dx);}}}
  }
}
function update(dt){
  if(state!=='playing'||paused||phase==='finished')return;
  elapsed+=dt;recoil=Math.max(0,recoil-dt*6);hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);nextShot=Math.max(0,nextShot-dt);if(player)player.spray=Math.max(0,(player.spray||0)-dt*1.8);feed.forEach(f=>f.t-=dt);feed=feed.filter(f=>f.t>0);feedTimer-=dt;if(feedTimer<=0){feedTimer=.5;paintFeed();}
  if(mpMode){mpUpdate(dt);return;}
  if(phase==='intermission'){intermission-=dt;if(intermission<=0){if(score.some(s=>s>=5)||round>=12)endMatch();else nextRound();}return;}
  clock-=dt;updatePlayer(dt);
  if(phase==='buy'){if(clock<=0)beginFight();return;}
  if(reload>0){reload-=dt;const p=reloadProgress();if(reloadStage===0&&p>=.38){reloadStage=1;sound('reload');}else if(reloadStage===1&&p>=.72){reloadStage=2;sound('reload');}if(reload<=0){reload=0;reloadTotal=0;reloadStage=0;const inv=player.inventory[player.weapon],take=Math.min(currentWeapon().size-inv.ammo,inv.reserve);inv.ammo+=take;inv.reserve-=take;sound('reload');updateHUD();}}
  if(shootHeld||touchFire){if(currentWeapon().automatic)shoot();}
  updateBots(dt);const winner=roundWinner(actors,clock<=0);if(winner!==null)endRound(winner);
}
function updateHUD(){
  if(!player)return;
  if(mpMode){
    const me=mpMe(),reloading=!me||me.ammo<=0;
    $('#health').textContent=Math.max(0,Math.ceil(player.hp));$('#armor').textContent=Math.ceil(player.armor||0);
    $('#ammo').textContent=reloading?'··':me.ammo;$('#reserve').textContent='∞';
    $('#weapon-name').textContent=reloading?'ПЕРЕЗАРЯДЖАННЯ':currentWeapon().name;
    $('#money').textContent='МЕРЕЖА';
    $('#blue-score').textContent=mpRoom?mpRoom.score[0]:0;$('#red-score').textContent=mpRoom?mpRoom.score[1]:0;
    const t=Math.max(0,mpRoom?mpRoom.timeLeft:0);
    $('#timer').textContent=`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
    $('#round-label').textContent=mpRoom?`ДО ${mpRoom.killTarget} ФРАГІВ`:'МЕРЕЖА';
    $('#map-name').textContent=map.name;
    const blues=mpRoom?mpRoom.players.filter(p=>p.team===0).length:0,reds=mpRoom?mpRoom.players.filter(p=>p.team===1).length:0;
    $('#phase-label').textContent=`${blues} ВАРТА / ${reds} РЕЙД`;
    $('#buy-tip').hidden=true;$('#crosshair').hidden=!me||!me.alive;
    $('#crosshair').style.opacity=reloading?'.25':'1';
    $('#hit-marker').style.opacity=hitTime>0?'1':'0';$('#hurt').style.opacity=String(hurtTime*.9);
    return;
  }
  const inv=player.inventory[player.weapon];$('#health').textContent=Math.ceil(player.hp);$('#armor').textContent=Math.ceil(player.armor);$('#ammo').textContent=reload>0?'··':inv.ammo;$('#reserve').textContent=inv.reserve;$('#weapon-name').textContent=reload>0?'ПЕРЕЗАРЯДЖАННЯ':currentWeapon().name;$('#money').textContent=`₡ ${player.money.toLocaleString('uk')}`;$('#blue-score').textContent=score[0];$('#red-score').textContent=score[1];$('#timer').textContent=`${Math.floor(Math.max(0,clock)/60)}:${String(Math.floor(Math.max(0,clock)%60)).padStart(2,'0')}`;$('#round-label').textContent=`РАУНД ${round} / 12`;$('#map-name').textContent=map.name;$('#phase-label').textContent=phase==='buy'?'ПІДГОТОВКА':`${actors.filter(a=>a.team===0&&a.hp>0).length} ВАРТА / ${actors.filter(a=>a.team===1&&a.hp>0).length} РЕЙД`;$('#buy-tip').hidden=phase!=='buy'||!!modal;$('#crosshair').hidden=player.hp<=0;$('#crosshair').style.opacity=reload>0?'.25':'1';$('#hit-marker').style.opacity=hitTime>0?'1':'0';$('#hurt').style.opacity=String(hurtTime*.9);if($('#shop-timer'))$('#shop-timer').textContent=Math.ceil(Math.max(0,clock));}

function resize(){const cap=settings.quality==='low'?640:960;canvas.width=Math.min(cap,innerWidth);canvas.height=Math.round(canvas.width*innerHeight/innerWidth);zbuffer=new Float32Array(canvas.width);}
addEventListener('resize',resize);
function viewActor(){if(mpMode||player.hp>0)return player;return actors.find(a=>a.team===0&&a.hp>0)||player;}
function render(){
  if(state!=='playing')return;
  const w=canvas.width,h=canvas.height,view=viewActor(),angle=view.angle,ca=Math.cos(angle),sa=Math.sin(angle),fov=aiming&&player.hp>0?.5:.78,projection=w/(2*fov),horizon=h*.48+(view===player?pitch*h:0)+(settings.motion?jump*50:0)+(keys.has('ControlLeft')?h*.06:0);
  ctx.fillStyle=map.sky;ctx.fillRect(0,0,w,h);const sky=ctx.createLinearGradient(0,0,0,Math.max(1,horizon));sky.addColorStop(0,tint(map.sky,.53));sky.addColorStop(1,tint(map.sky,1.03));ctx.fillStyle=sky;ctx.fillRect(0,0,w,Math.max(1,horizon));
  ctx.fillStyle=tint(map.wall,.7);for(let i=-1;i<18;i++){const x=((i*113-angle*100)%(w+113)+w+113)%(w+113)-113;const bh=40+Math.sin(i*17)*25;ctx.fillRect(x,horizon-bh,70,bh);}
  const floor=ctx.createLinearGradient(0,Math.max(0,horizon),0,h);floor.addColorStop(0,tint(map.floor,.46));floor.addColorStop(1,tint(map.floor,.9));ctx.fillStyle=floor;ctx.fillRect(0,Math.max(0,horizon),w,h);
  // Perspective floor grid: samples world coordinates in each screen row.
  const horizonY=Math.max(0,Math.floor(horizon+1));ctx.globalAlpha=.18;const floorStep=settings.quality==='low'?5:4;
  for(let sy=horizonY;sy<h;sy+=floorStep){const dist=projection*.5/(sy-horizon);if(dist>25)continue;const leftX=view.x+dist*(ca+sa*fov),leftY=view.y+dist*(sa-ca*fov),dx=-2*sa*fov*dist/w,dy=2*ca*fov*dist/w;
    for(let sx=0;sx<w;sx+=floorStep){const fx=leftX+dx*sx,fy=leftY+dy*sx;if(fx-Math.floor(fx)<.035||fy-Math.floor(fy)<.035){ctx.fillStyle='#cbd0aa';ctx.fillRect(sx,sy,floorStep,floorStep);}else if((Math.floor(fx)+Math.floor(fy))%2===0){ctx.fillStyle='#17271f';ctx.fillRect(sx,sy,floorStep,floorStep);}}
  }ctx.globalAlpha=1;
  const colStep=settings.quality==='low'?2:1;
  for(let x=0;x<w;x+=colStep){const camera=2*x/w-1,rx=ca-sa*fov*camera,ry=sa+ca*fov*camera;let mx=Math.floor(view.x),my=Math.floor(view.y);const ddx=Math.abs(1/rx),ddy=Math.abs(1/ry),sx=rx<0?-1:1,sy=ry<0?-1:1;let sideX=(rx<0?view.x-mx:mx+1-view.x)*ddx,sideY=(ry<0?view.y-my:my+1-view.y)*ddy,side=0,type=1;
    for(let k=0;k<80;k++){if(sideX<sideY){sideX+=ddx;mx+=sx;side=0;}else{sideY+=ddy;my+=sy;side=1;}type=map.grid[my]?.[mx]??1;if(type)break;}
    const dist=Math.max(.05,side?sideY-ddy:sideX-ddx),height=projection/dist,top=horizon-height*.5;let hit=side?view.x+dist*rx:view.y+dist*ry;hit-=Math.floor(hit);const tx=Math.floor(hit*64);
    ctx.drawImage(wallTextures[type]||wallTextures[1],tx,0,1,64,x,top,colStep,height);
    ctx.fillStyle=`rgba(8,22,22,${Math.min(.82,dist/30+(side?.19:0))})`;ctx.fillRect(x,top,colStep,height);
    zbuffer[x]=dist;if(colStep===2)zbuffer[x+1]=dist;
  }
  const projected=actors.filter(a=>a!==view&&a.hp>0).map(a=>{const dx=a.x-view.x,dy=a.y-view.y;return {a,depth:dx*ca+dy*sa,side:-dx*sa+dy*ca};}).filter(o=>o.depth>.12).sort((a,b)=>b.depth-a.depth);
  for(const {a,depth,side}of projected){const sh=projection/depth*.94,sw=sh*.5,x=w*.5+side*projection/depth-sw*.5,y=horizon+projection/depth*.5-sh+(a.moving?Math.sin(elapsed*10)*sh*.018:0),sprite=a.team===0?blueSprite:redSprite;
    for(let sx=Math.max(0,Math.floor(x));sx<Math.min(w,x+sw);sx+=2){if(depth>=zbuffer[sx])continue;const tx=clamp(Math.floor((sx-x)/sw*128),0,127);ctx.drawImage(sprite,tx,0,1,256,sx,y,2,sh);}
    const center=Math.round(x+sw*.5);if(center>0&&center<w&&depth<zbuffer[center]){if(a.team===0||mpMode){ctx.fillStyle=a.team===0?'#c3f66b':'#f4a46a';ctx.font=`${Math.max(9,Math.min(13,sh*.07))}px monospace`;ctx.textAlign='center';ctx.fillText(a.name,x+sw*.5,y-9);ctx.textAlign='left';}if(a.flash>0){ctx.fillStyle='#ffeaa0';ctx.beginPath();ctx.arc(x+sw*.85,y+sh*.46,Math.max(3,sh*.07),0,7);ctx.fill();}}
  }
  const vignette=ctx.createRadialGradient(w*.5,h*.45,w*.2,w*.5,h*.5,w*.75);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#04100b99');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  if(player.hp>0)drawGun(w,h);
  renderMinimap(view);
}
function drawGun(w,h){
  const pistol=player.weapon==='pistol',shotgun=player.weapon==='shotgun',kalash=player.weapon==='kalash',moving=player.moving&&settings.motion;
  const p=reloadProgress();
  const downHold=p<=0?0:p<.25?p/.25:p<.65?1:1-(p-.65)/.35;
  const dip=p>0?Math.sin(p*Math.PI):0;
  const sway=p>0?Math.sin(p*Math.PI*2)*22*downHold:0;
  const cockJerk=p>.72&&p<.92?Math.sin((p-.72)/.2*Math.PI):0;
  const dropY=downHold*105+dip*18-cockJerk*22;
  const tilt=downHold*.5-cockJerk*.09;
  ctx.save();const scale=Math.min(w/900,h/560);
  ctx.translate(w*(aiming?.51:.63)+(moving?Math.sin(walk)*7:0)+sway*scale,h+(moving?Math.abs(Math.cos(walk))*5:0)+(settings.motion?recoil*17:0)+dropY*scale);ctx.scale(scale,scale);ctx.rotate(-tilt*.55);
  const poly=(pts,c)=>{ctx.fillStyle=c;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};const glove=GLOVES[settings.glove].color,skin=SKINS[settings.skin].color;
  poly([[-105,0],[-88,-85],[-34,-141],[20,-112],[52,0]],tint(skin,.8));
  if(!pistol){ctx.save();ctx.translate(38,-28);poly([[-87,-80],[-72,-123],[-20,-155],[19,-118],[-16,-69]],glove);ctx.restore();}
  // Зсув затвора/затворної рами під час фази досилання (p 0.72–0.92): зброя смикається вгору.
  const slideDy=-cockJerk*16;
  ctx.save();ctx.translate(0,slideDy*.4);
  const sprite=weaponSprites[player.weapon],useSprite=weaponSpriteReady(sprite);
  if(useSprite){
    const dims={pistol:[16,12,11],smg:[13,11,12],rifle:[18,11,11],shotgun:[18,11,11],kalash:[18,11,11]};
    const [sw,sh,k]=dims[player.weapon]||dims.pistol,dw=sw*k,dh=sh*k;
    ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,118-dw,-166-dh/2,dw,dh);ctx.imageSmoothingEnabled=true;
  }
  else if(pistol){poly([[-12,0],[-26,-82],[10,-149],[50,-126],[56,-39],[106,0]],glove);poly([[-23,-149],[-20,-198],[12,-218],[61,-170],[53,-105],[17,-94]],'#2c3937');poly([[-20,-198],[-8,-219],[15,-229],[54,-185],[61,-170],[7,-172]],'#6e7a6f');poly([[7,-172],[61,-170],[53,-145],[6,-145]],'#192625');ctx.fillStyle='#bddd75';ctx.fillRect(2,-219,6,5);ctx.fillStyle='#0d1918';ctx.fillRect(7,-227,9,7);}
  else{poly([[13,0],[-7,-60],[33,-132],[84,-111],[129,-32],[163,0]],glove);poly([[-50,-49],[-44,-159],[-12,-207],[69,-137],[98,-41],[42,0]],'#243432');poly([[-44,-159],[-12,-207],[17,-199],[89,-140],[69,-119]],'#778174');poly([[69,-119],[89,-140],[98,-41],[57,-49]],'#172625');poly([[-30,-171],[-47,-232],[-26,-250],[7,-181]],'#283b39');poly([[-47,-232],[-26,-250],[-20,-240],[-40,-222]],'#859080');ctx.fillStyle='#131f20';ctx.fillRect(-34,-244,7,11);ctx.fillStyle='#d3f088';ctx.fillRect(-34,-235,4,4);poly([[-31,-130],[24,-92],[38,-98],[-14,-140]],kalash?'#8a5a33':shotgun?'#997551':'#495d4b');if(kalash){poly([[-26,-152],[-12,-154],[-2,-128],[6,-100],[-4,-94],[-14,-120],[-24,-142]],'#232a29');ctx.fillStyle='#8a5a33';ctx.fillRect(-34,-244,7,11);ctx.fillStyle='#23282b';ctx.fillRect(-60,-239,13,5);}else{for(let i=0;i<4;i++){ctx.fillStyle='#152423';ctx.fillRect(-21+i*10,-153+i*7,5,13);}}poly([[13,-76],[47,-58],[40,0],[12,-5]],'#1c2827');ctx.fillStyle='#c3f66b';ctx.fillRect(22,-116,13,3);}
  ctx.restore();
  // Магазин, що випадає (фаза 0.08–0.5), та рука з новим магазином (фаза 0.42–0.75).
  if(p>.06&&p<.52){const q=(p-.06)/.46;ctx.save();ctx.globalAlpha=1-q*.9;ctx.translate(pistol?30:-10,-120+q*190);ctx.rotate(.5+q*1.4);ctx.fillStyle='#1d2a28';ctx.fillRect(-9,-26,18,52);ctx.fillStyle='#c3f66b';ctx.fillRect(-9,-26,18,5);ctx.restore();}
  if(p>.4&&p<.78){const q=p<.6?(p-.4)/.2:1-(p-.6)/.18;ctx.save();ctx.globalAlpha=.95;ctx.translate(pistol?8:-24,-60+q*46);ctx.rotate(.12);ctx.fillStyle=glove;ctx.fillRect(-16,-18,32,36);ctx.fillStyle='#222f2d';ctx.fillRect(-9,-52,18,40);ctx.fillStyle='#c3f66b';ctx.fillRect(-9,-52,18,4);ctx.restore();}
  if(recoil>.55&&reload<=0){ctx.save();ctx.translate(useSprite?122:(pistol?5:-33),useSprite?-166:(pistol?-226:-251));poly([[0,-35],[7,-11],[29,-19],[12,1],[24,18],[2,10],[-20,23],[-12,0],[-30,-14],[-6,-10]],'#ffd887');ctx.fillStyle='#fff9df';ctx.beginPath();ctx.arc(0,0,9,0,7);ctx.fill();ctx.restore();}ctx.restore();
  // Шкала прогресу перезаряджання під прицілом.
  if(p>0){const bw=Math.min(220,w*.3),bx=w/2-bw/2,by=h*.56;ctx.save();ctx.globalAlpha=.92;ctx.fillStyle='#0b1513cc';ctx.fillRect(bx-8,by-8,bw+16,30);ctx.fillStyle='#2a3a32';ctx.fillRect(bx,by,bw,6);ctx.fillStyle='#c3f66b';ctx.fillRect(bx,by,bw*p,6);ctx.fillStyle='#eef1e8';ctx.font='11px monospace';ctx.textAlign='center';const label=p<.38?'МАГАЗИН ГЕТЬ':p<.72?'НОВИЙ МАГАЗИН':'ЗАТВОР · ГОТОВО';ctx.fillText(`${label} ${Math.round(p*100)}%`,w/2,by+22);ctx.textAlign='left';ctx.restore();}
}
function renderMinimap(view){
  mc.clearRect(0,0,160,160);mc.fillStyle='#102019';mc.fillRect(0,0,160,160);const s=160/24;
  for(let y=0;y<24;y++)for(let x=0;x<24;x++)if(map.grid[y][x]){mc.fillStyle=map.grid[y][x]===2?'#657156':'#45574c';mc.fillRect(x*s,y*s,s-.6,s-.6);}
  for(const a of actors){if(a.hp<=0)continue;if(a.team===1&&!lineOfSight(map,view.x,view.y,a.x,a.y))continue;mc.fillStyle=a.team===0?'#c3f66b':'#f4a46a';mc.beginPath();mc.arc(a.x*s,a.y*s,a.isPlayer?3.6:2.4,0,7);mc.fill();}
  mc.strokeStyle='#c3f66b99';mc.beginPath();mc.moveTo(view.x*s,view.y*s);mc.lineTo((view.x+Math.cos(view.angle)*2)*s,(view.y+Math.sin(view.angle)*2)*s);mc.stroke();
}
function frame(now){const dt=Math.min(.045,(now-lastTime)/1000);lastTime=now;update(dt);render();hudTimer-=dt;if(hudTimer<=0){hudTimer=.08;if(state==='playing')updateHUD();}requestAnimationFrame(frame);}
requestAnimationFrame(frame);

addEventListener('keydown',e=>{
  if(state!=='playing'){if(e.code==='Escape'&&modal)closeDialog(false);return;}
  if(['Space','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){if(modal==='shop')closeDialog();else if(modal==='pause')closeDialog();else if(!modal)pause();return;}
  if(e.code==='KeyB'){if(modal==='shop')closeDialog();else if(!modal)openShop();return;}
  if(modal||paused)return;keys.add(e.code);
  if(mpMode){
    if(e.code==='KeyR')toast('Перезаряджання автоматичне після порожнього магазина');
    if(e.code==='Digit1')mpSwitchWeapon('pistol');if(e.code==='Digit2')mpSwitchWeapon('smg');if(e.code==='Digit3')mpSwitchWeapon('rifle');if(e.code==='Digit4')mpSwitchWeapon('shotgun');if(e.code==='Digit5')mpSwitchWeapon('kalash');
    if(e.code==='KeyB')toast('Магазина в мережі немає — усі 5 стволів доступні на 1–5');
    if(e.code==='Space'&&jump===0&&player.hp>0)jumpVelocity=1.65;
    if(e.code==='Tab'&&mpRoom)toast(`ВАРТА ${mpRoom.score[0]} : ${mpRoom.score[1]} РЕЙД · Фраги: ${kills} · Смерті: ${deaths}`);
    return;
  }
  if(e.code==='KeyR')reloadWeapon();if(e.code==='Digit1'&&player.primary)switchWeapon(player.primary);if(e.code==='Digit2')switchWeapon('pistol');if(e.code==='Space'&&jump===0&&player.hp>0)jumpVelocity=1.65;
  if(e.code==='Tab')toast(`ВАРТА ${score[0]} : ${score[1]} РЕЙД · Твої усунення: ${kills} · Смерті: ${deaths}`);
});
addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('mousedown',e=>{if(state!=='playing'||paused||modal)return;initAudio();if(!document.pointerLockElement){dragging=true;lock();}if(e.button===0){shootHeld=true;shoot();}if(e.button===2)aiming=true;});
addEventListener('mouseup',e=>{dragging=false;if(e.button===0)shootHeld=false;if(e.button===2)aiming=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(state!=='playing'||paused||modal||player.hp<=0)return;if(document.pointerLockElement===canvas||dragging){player.angle+=e.movementX*.0026*settings.sensitivity*(aiming?.6:1);pitch=clamp(pitch-e.movementY*.0019*settings.sensitivity,-.45,.45);}});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='playing'&&!modal&&phase!=='finished')pause();});
addEventListener('blur',()=>{keys.clear();shootHeld=false;touchFire=false;aiming=false;if(state==='playing'&&!modal)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing'&&phase!=='finished'&&modal!=='pause')pause();});
$('#overlay').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const focusables=[...$('#dialog').querySelectorAll('button:not(:disabled),a[href],input,select')];if(!focusables.length)return;const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
const joy=$('#joystick');let joyId;
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);});joy.addEventListener('pointermove',e=>{if(e.pointerId!==joyId)return;const r=joy.getBoundingClientRect();stick.x=clamp((e.clientX-r.left-50)/40,-1,1);stick.y=clamp((e.clientY-r.top-50)/40,-1,1);joy.firstElementChild.style.transform=`translate(${stick.x*25}px,${stick.y*25}px)`;});
function releaseJoy(){joyId=null;stick={x:0,y:0};joy.firstElementChild.style.transform='';}joy.addEventListener('pointerup',releaseJoy);joy.addEventListener('pointercancel',releaseJoy);
$('#touch-fire').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touchFire=true;shoot();});$('#touch-fire').addEventListener('pointerup',()=>touchFire=false);$('#touch-fire').addEventListener('pointercancel',()=>touchFire=false);$('#touch-reload').onclick=reloadWeapon;$('#touch-shop').onclick=()=>modal==='shop'?closeDialog():openShop();
canvas.style.touchAction='none';canvas.addEventListener('touchstart',e=>{if(paused||modal)return;const t=e.changedTouches[0];lookTouch={id:t.identifier,x:t.clientX,y:t.clientY};},{passive:true});canvas.addEventListener('touchmove',e=>{if(!lookTouch||paused||modal||player.hp<=0)return;const t=[...e.changedTouches].find(t=>t.identifier===lookTouch.id);if(!t)return;player.angle+=(t.clientX-lookTouch.x)*.006*settings.sensitivity;pitch=clamp(pitch-(t.clientY-lookTouch.y)*.004,-.45,.45);lookTouch.x=t.clientX;lookTouch.y=t.clientY;e.preventDefault();},{passive:false});canvas.addEventListener('touchend',()=>lookTouch=null);canvas.addEventListener('touchcancel',()=>lookTouch=null);

// ---------- Мультиплеєр: лобі, кімнати, синхронізація ----------
function mpMe(){return mpRoom&&mpMyId?mpRoom.players.find(p=>p.id===mpMyId):null;}
function mpMyAmmo(){const me=mpMe();return me?me.ammo:0;}
function mpSetStatus(t){const e=$('#mp-status');if(e)e.textContent=t;}
function mpTabOpened(){
  if(!mpWired){
    mpWired=true;
    $('#mp-room-map').innerHTML=MAPS.map((m,i)=>`<option value="${i}">${m.name}</option>`).join('');
    $('#mp-nick').value=settings.mpNick||'';$('#mp-server').value=settings.mpServer||'';
    $('#mp-connect').onclick=mpConnect;$('#mp-disconnect').onclick=()=>mpDisconnect();
    $('#mp-refresh').onclick=()=>{if(mpClient&&mpClient.connected)mpClient.send({t:C2S.LIST});else toast('Спочатку підключися до сервера');};
    $('#mp-create').onclick=()=>{
      if(!mpClient||!mpClient.connected)return toast('Спочатку підключися до сервера');
      settings.mpNick=$('#mp-nick').value;save();
      mpClient.send({t:C2S.CREATE,name:$('#mp-room-name').value,isPublic:$('#mp-room-visibility').value==='public',mapId:Number($('#mp-room-map').value),maxPlayers:Number($('#mp-room-max').value)});
    };
    $('#mp-join-btn').onclick=()=>{
      if(!mpClient||!mpClient.connected)return toast('Спочатку підключися до сервера');
      const code=$('#mp-join-code').value.trim().toUpperCase();
      if(code.length!==6)return toast('Код має 6 символів');
      mpClient.send({t:C2S.JOIN_CODE,code});
    };
    $('#mp-ready').onclick=()=>{if(mpClient&&mpRoom){const me=mpMe();mpClient.send({t:C2S.READY,ready:!(me&&me.ready)});}};
    $('#mp-start').onclick=()=>{if(mpClient&&mpRoom)mpClient.send({t:C2S.START});};
    $('#mp-leave').onclick=()=>{if(mpClient)mpClient.send({t:C2S.LEAVE});mpRoom=null;mpShowHome();};
    const sendChat=()=>{const inp=$('#mp-chat-input'),text=inp.value.trim();if(text&&mpClient&&mpRoom){mpClient.send({t:C2S.CHAT,text});inp.value='';}};
    $('#mp-chat-send').onclick=sendChat;
    $('#mp-chat-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();e.stopPropagation();});
  }
  mpShowHome();
  if(mpClient&&mpClient.connected&&!mpRoom)mpClient.send({t:C2S.LIST});
}
function mpConnect(){
  if(mpClient)mpDisconnect(true);
  settings.mpNick=$('#mp-nick').value;settings.mpServer=$('#mp-server').value;save();
  const url=defaultMpUrl(settings.mpServer);
  mpSetStatus('ПІДКЛЮЧЕННЯ…');
  mpSilentClose=false;
  mpClient=createMpClient(url,{
    onOpen(){mpClient.send({t:C2S.HELLO,nick:settings.mpNick});},
    onWelcome(msg){mpMyId=msg.id;mpRooms=msg.rooms||[];mpRenderRooms();mpSetStatus(`НА ЗВʼЯЗКУ · ${mpRooms.length} КІМНАТ`);$('#mp-disconnect').hidden=false;mpListTimer=setInterval(()=>{if(mpClient&&mpClient.connected&&!mpRoom&&!mpMode&&!$('#tab-mp').hidden)mpClient.send({t:C2S.LIST});},3000);},
    onRooms(rooms){mpRooms=rooms;if(!mpRoom&&!mpMode){mpRenderRooms();mpSetStatus(`НА ЗВʼЯЗКУ · ${rooms.length} КІМНАТ`);}},
    onJoined(room){mpRoom=room;mpChat=[];mpShowRoom();},
    onRoom(room){if(mpMode)return;mpRoom=room;mpShowRoom();},
    onMatchStart(room){mpStartMatch(room);},
    onSnapshot(snap){if(mpMode)mpApplySnapshot(snap);},
    onEvents(events){if(mpRoom||mpMode)mpHandleEvents(events);},
    onMatchEnd(room){mpRoom=room;mpShowResult({winner:room.winner,score:room.score});},
    onError(message){toast(message);},
    onClose(){if(!mpSilentClose)toast('Зʼєднання з сервером втрачено');mpDisconnect(true);},
  });
  if(!mpClient){mpSetStatus('НЕ ПІДКЛЮЧЕНО');toast('Не вдалося створити зʼєднання');}
}
function mpDisconnect(silent=false){
  mpSilentClose=!!silent;
  clearInterval(mpListTimer);mpListTimer=0;
  if(mpClient){try{mpClient.close();}catch{}mpClient=null;}
  mpRoom=null;mpMyId=null;mpMode=false;mpRemotes=new Map();mpReloadT=0;mpResultShown=false;
  if(!silent){
    state='lobby';paused=false;modal='';release();
    $('#overlay').hidden=true;canvas.hidden=true;$('#hud').hidden=true;$('#lobby').hidden=false;
    tab('mp');
  }else{
    $('#mp-disconnect').hidden=true;mpSetStatus(silent&&mpRoom?'НЕ ПІДКЛЮЧЕНО':($('#mp-status')?$('#mp-status').textContent:''));
    if(state==='lobby'){mpShowHome();tab('mp');}
  }
}
function mpShowHome(){
  $('#mp-home').hidden=false;$('#mp-room').hidden=true;
  mpRenderRooms();
}
function mpRenderRooms(){
  const box=$('#mp-rooms');if(!box)return;
  if(!mpClient||!mpClient.connected){box.innerHTML='<p style="color:var(--muted)">Підключися до сервера, щоб побачити публічні кімнати.</p>';return;}
  if(!mpRooms.length){box.innerHTML='<p style="color:var(--muted)">Публічних кімнат немає — створи свою або ввійди за кодом.</p>';return;}
  box.innerHTML=mpRooms.map(r=>{
    const m=MAPS[clamp(r.mapId,0,MAPS.length-1)];
    const phase=r.phase==='playing'?'БІЙ ТРИВАЄ':r.phase==='finished'?'МАТЧ ЗАВЕРШЕНО':'ЛОБІ · МОЖНА ЗАЙТИ';
    return `<div class="map-card"><div class="map-detail"><h3>${r.name}</h3><p>${m.name} · ${r.players}/${r.maxPlayers} · ${phase}</p><div class="map-tags"><span>${r.isPublic?'ПУБЛІЧНА':'ПРИВАТНА'}</span><button class="text-button" data-join="${r.id}" ${r.phase!=='lobby'||r.players>=r.maxPlayers?'disabled':''}>УВІЙТИ ↗</button></div></div></div>`;
  }).join('');
  box.querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>mpClient.send({t:C2S.JOIN,id:b.dataset.join}));
}
function mpShowRoom(){
  $('#mp-home').hidden=true;$('#mp-room').hidden=false;
  mpRenderRoom();
}
function mpRenderRoom(){
  const room=mpRoom;if(!room)return;
  const m=MAPS[clamp(room.mapId,0,MAPS.length-1)];
  const me=room.players.find(p=>p.id===mpMyId);
  $('#mp-room-title').textContent=`КІМНАТА · ${room.name}`;
  $('#mp-room-info').textContent=`${m.name} · ${room.players.length}/${room.maxPlayers} гравців · до ${room.killTarget} фрагів · ${Math.floor(room.matchTime/60)} хв · Усі стволи доступні`;
  $('#mp-room-code').textContent=room.isPublic?'ПУБЛІЧНА — ВИДНО ВСІМ У СПИСКУ':`КОД ДЛЯ ДРУЗІВ: ${room.code}`;
  $('#mp-players').innerHTML=room.players.map(p=>`<div><kbd style="border-color:${p.team===0?'#c3f66b':'#e49a62'};color:${p.team===0?'#c3f66b':'#e49a62'}">${p.team===0?'ВРТ':'РЙД'}</kbd>${p.nick}${p.id===mpMyId?' (ТИ)':''}${p.id===room.hostId?' ★':''}<span style="margin-left:auto">${room.phase!=='lobby'?'':p.ready?'✓ ГОТОВИЙ':'· ЧЕКАЄ'}</span></div>`).join('');
  $('#mp-ready').textContent=me&&me.ready?'НЕ ГОТОВИЙ ✕':'ГОТОВИЙ ✓';
  const startBtn=$('#mp-start');
  startBtn.hidden=room.hostId!==mpMyId;
  startBtn.disabled=!canStart(room,mpMyId);
  startBtn.innerHTML=room.phase==='finished'?'РЕВАНШ <span>→</span>':'РОЗПОЧАТИ <span>→</span>';
  mpRenderChat();
}
function mpRenderChat(){
  const box=$('#mp-chat');if(!box)return;
  box.innerHTML=mpChat.map(c=>`<div><b>${c.nick}</b> &nbsp; ━ &nbsp; <em>${c.text}</em></div>`).join('');
}
function mpStartMatch(room){
  initAudio();
  mpRoom=room;mpResultShown=false;kills=0;deaths=0;feed=[];mpChat=[];
  map=MAPS[clamp(room.mapId,0,MAPS.length-1)];
  wallTextures=textures(map);
  blueSprite=makeOperator(SKINS[settings.skin].color,'#c3f66b',GLOVES[settings.glove].color);
  redSprite=makeOperator('#aa7853','#ffbd73');
  weaponSprites=loadWeaponSprites();
  const me=room.players.find(p=>p.id===mpMyId);
  player=actor(me.x,me.y,me.team,me.nick);player.isPlayer=true;player.hp=me.hp;
  mpRemotes=new Map();mpReloadT=0;mpSendTimer=0;
  for(const p of room.players){
    if(p.id===mpMyId)continue;
    mpRemotes.set(p.id,{mpId:p.id,isRemote:true,x:p.x,y:p.y,tx:p.x,ty:p.y,angle:p.angle,tAngle:p.angle,team:p.team,name:p.nick,hp:p.hp,armor:0,moving:false,flash:0,weapon:p.weapon,lastFlash:p.flashAt||0,pendingFlash:false});
  }
  actors=[player,...mpRemotes.values()];
  state='playing';phase='mp';paused=false;modal='';mpMode=true;
  pitch=0;aiming=false;shootHeld=false;touchFire=false;nextShot=0;reload=0;reloadTotal=0;reloadStage=0;recoil=0;hitTime=0;hurtTime=0;keys.clear();
  $('#overlay').hidden=true;$('#lobby').hidden=true;canvas.hidden=false;$('#hud').hidden=false;
  $('#touch-controls').hidden=!touchDevice;
  resize();updateHUD();lock();
  $('#game-message').textContent='МЕРЕЖЕВИЙ БІЙ · ТРИМАЙ СЕКТОР';
  setTimeout(()=>{if(mpMode&&player.hp>0)$('#game-message').textContent='';},2500);
}
function mpApplySnapshot(snap){
  mpRoom=snap;
  const me=snap.players.find(p=>p.id===mpMyId);
  if(me){
    const wasAlive=player.hp>0;
    player.hp=me.hp;player.armor=me.armor||0;
    if(!me.alive&&wasAlive){hurtTime=.45;sound('hit');}
    if(me.alive&&!wasAlive){player.x=me.x;player.y=me.y;player.angle=me.angle;$('#game-message').textContent='';}
    if(!me.alive)$('#game-message').textContent=`ЗАГИБЛИК · ВІДРОДЖЕННЯ ЧЕРЕЗ ${Math.max(1,Math.ceil(me.respawnIn))}`;
  }
  const seen=new Set();
  for(const p of snap.players){
    if(p.id===mpMyId)continue;
    seen.add(p.id);
    let a=mpRemotes.get(p.id);
    if(!a){a={mpId:p.id,isRemote:true,x:p.x,y:p.y,tx:p.x,ty:p.y,angle:p.angle,tAngle:p.angle,team:p.team,name:p.nick,hp:100,armor:0,moving:false,flash:0,weapon:'pistol',lastFlash:p.flashAt||0,pendingFlash:false};mpRemotes.set(p.id,a);}
    a.tx=p.x;a.ty=p.y;a.tAngle=p.angle;a.team=p.team;a.name=p.nick;a.hp=p.hp;a.moving=p.moving;a.weapon=p.weapon;
    if((p.flashAt||0)>a.lastFlash){a.lastFlash=p.flashAt;a.pendingFlash=true;}
  }
  for(const id of [...mpRemotes.keys()])if(!seen.has(id))mpRemotes.delete(id);
  actors=[player,...mpRemotes.values()];
  updateHUD();
}
function mpHandleEvents(events){
  for(const e of events){
    if(e.t==='kill'){
      feed.unshift({source:e.sourceNick,target:e.targetNick,t:6});feed=feed.slice(0,4);paintFeed();sound('hit');
      if(e.source===mpMyId)kills++;if(e.target===mpMyId)deaths++;
    }else if(e.t==='reload'){
      if(e.id===mpMyId)mpReloadT=(WEAPONS[player.weapon]||WEAPONS.pistol).reload;
    }else if(e.t==='chat'){
      mpChat.push(e);mpChat=mpChat.slice(-30);mpRenderChat();
    }else if(e.t==='finish'){
      mpShowResult({winner:e.winner,score:e.score||[0,0]});
    }
  }
  updateHUD();
}
function mpUpdate(dt){
  elapsed+=dt;recoil=Math.max(0,recoil-dt*6);hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);nextShot=Math.max(0,nextShot-dt);mpReloadT=Math.max(0,mpReloadT-dt);player.spray=Math.max(0,(player.spray||0)-dt*1.8);
  feed.forEach(f=>f.t-=dt);feed=feed.filter(f=>f.t>0);feedTimer-=dt;if(feedTimer<=0){feedTimer=.5;paintFeed();}
  updatePlayer(dt);
  const me=mpMe();
  if(me&&me.alive&&player.hp>0&&mpClient){
    mpSendTimer-=dt;
    if(mpSendTimer<=0){mpSendTimer=1/MP.TICK_HZ;mpClient.send({t:C2S.STATE,x:+player.x.toFixed(2),y:+player.y.toFixed(2),angle:+player.angle.toFixed(3),moving:player.moving,weapon:player.weapon});}
  }
  if(shootHeld||touchFire){if((WEAPONS[player.weapon]||{}).automatic)shoot();}
  for(const a of mpRemotes.values()){
    a.x+=(a.tx-a.x)*Math.min(1,dt*12);a.y+=(a.ty-a.y)*Math.min(1,dt*12);a.angle=a.tAngle;
    if(a.pendingFlash){a.pendingFlash=false;a.flash=.09;if(Math.hypot(a.x-player.x,a.y-player.y)<25)sound('shot',a.weapon);}
  }
}
function mpPause(){
  paused=true;aiming=false;
  dialog('mpPause',header('МЕРЕЖЕВИЙ БІЙ','ПАУЗА')+`<p>${map.name} · Рахунок ${mpRoom?mpRoom.score[0]:0} : ${mpRoom?mpRoom.score[1]:0}</p><div class="dialog-actions"><button id="mp-resume" class="primary">ПРОДОВЖИТИ <span>→</span></button><button id="mp-quit" class="secondary">ВИЙТИ З МАТЧУ</button></div>`);
  $('#mp-resume').onclick=()=>closeDialog();
  $('.dialog-close').onclick=()=>closeDialog();
  $('#mp-quit').onclick=()=>mpDisconnect();
}
function mpShowResult(res){
  if(mpResultShown||!mpMode)return;mpResultShown=true;
  mpMode=false;shootHeld=false;touchFire=false;aiming=false;
  const me=mpMe(),myTeam=me?me.team:0;
  const title=res.winner<0?'НІЧИЯ':res.winner===myTeam?'ПЕРЕМОГА КОМАНДИ':'ПОРАЗКА';
  dialog('mpResult',`<span class="eyebrow">МЕРЕЖЕВИЙ БІЙ ЗАВЕРШЕНО / ${map.name}</span><h2>${title}</h2><div class="result-score"><span>${res.score[0]}</span><small>:</small><span>${res.score[1]}</span></div><div class="result-stats"><span>${kills} ФРАГІВ</span><span>${deaths} СМЕРТЕЙ</span></div><div class="dialog-actions"><button id="mp-back" class="primary">ДО КІМНАТИ <span>→</span></button><button id="mp-out" class="secondary">ВИЙТИ</button></div>`);
  sound(res.winner===myTeam?'win':'empty');
  $('#mp-back').onclick=()=>{mpShowLobby();};
  $('#mp-out').onclick=()=>mpDisconnect();
}
function mpShowLobby(){
  state='lobby';paused=false;modal='';release();
  $('#overlay').hidden=true;canvas.hidden=true;$('#hud').hidden=true;$('#lobby').hidden=false;
  tab('mp');
  if(mpRoom)mpShowRoom();else mpShowHome();
}

// Explicitly enabled only by the local browser verification harness.
if(new URLSearchParams(location.search).has('test'))window.__sector={start,beginFight,shoot,purchase:id=>purchase(player,id),reload:reloadWeapon,reloadProgress,step:dt=>{update(dt);updateHUD();render();},setClock:n=>clock=n,setPaused:v=>paused=v,setPlayer:p=>Object.assign(player,p),get:()=>({state,phase,paused,modal,round,score,kills,deaths,clock,reload,reloadTotal,reloadStage,player,actors,map:map.id}),endRound,endMatch,leave,openShop};
