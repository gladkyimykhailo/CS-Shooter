import { MAPS, WEAPONS, SKINS, GLOVES, clamp, blocked, canStand, moveActor, lineOfSight, findPath, applyDamage, purchase } from './core.js';
import { createWeaponMotion, kickWeaponMotion, stepWeaponMotion, weaponWallProximity } from './core.js';
import { floorHeight, actorHeight, resetActorHeight, jumpActor, stepActor } from './core.js';
import { drawTerrain } from './terrain.js';
import { drawOperators, hitOperator } from './operators.js';
import { mapArt, drawOperator, textures, hex, tint, WEAPON_FILES, drawHeldWeapon, drawWeaponSights, drawScopeOverlay, WEAPON_MUZZLES } from './art.js';
import { MP, C2S, canStart } from './net.js';
import { defaultMpUrl, createMpClient, findSharedServer, inviteLink, isTunnelUrl, serverUrlFromQuery, setSharedServerUrl } from './mp.js';
import { createPeerCodeClient } from './peer-code.js';
import { normalizeRoomCode, validRoomCode } from './room-code.js';
import { MATCH, teamSpawns, createBomb, bombAction, stepBomb, bombRoundWinner, rewardRound } from './tactical.js';
import { SERVER_URL } from './config.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('#game'),ctx=canvas.getContext('2d',{alpha:false}),mini=$('#minimap'),mc=mini.getContext('2d');
const minimapBackgrounds=new WeakMap();
const settings={skin:0,glove:0,sensitivity:1,volume:.5,quality:'high',motion:true,difficulty:'normal',map:0,mapKey:'mirage',mpNick:'',mpServer:''};
try{
  const saved=JSON.parse(localStorage.getItem('sector-settings')||'{}');
  for(const k in settings)if(typeof saved[k]===typeof settings[k])settings[k]=saved[k];
  // Before the three-map rotation, Dust II occupied index 9. Removed maps
  // return to Mirage; stable keys keep subsequent reordering unambiguous.
  const key=saved.mapKey||(saved.map===9?'dust2':'mirage');
  settings.map=Math.max(0,MAPS.findIndex(m=>m.id===key));
}catch{}
settings.skin=clamp(Math.floor(settings.skin),0,2);settings.glove=clamp(Math.floor(settings.glove),0,2);settings.map=clamp(Math.floor(settings.map),0,MAPS.length-1);settings.sensitivity=clamp(settings.sensitivity,.3,2.5);settings.volume=clamp(settings.volume,0,1);
const save=()=>{try{settings.mapKey=MAPS[settings.map].id;localStorage.setItem('sector-settings',JSON.stringify(settings));}catch{}};
let map=MAPS[settings.map],wallTextures=[];
  let state='lobby',phase='buy',paused=false,modal='',player,actors=[],round=0,score=[0,0],clock=MATCH.freezeTime,fightIn=MATCH.countdownTime,kills=0,deaths=0;
let bomb=null,losses=[0,0],touchUse=false;
let pitch=0,aiming=false,shootHeld=false,nextShot=0,reload=0,reloadTotal=0,reloadStage=0,recoil=0,hitTime=0,hurtTime=0,walk=0,stepTimer=0,intermission=0,elapsed=0;
let zbuffer=[],terrainDepth=[],keys=new Set(),lastTime=performance.now(),hudTimer=0,feed=[],toastTimer,feedTimer=0,dragging=false,lookTouch=null,stick={x:0,y:0},touchFire=false,thinT=0;
let mpClient=null,mpRoom=null,mpMyId=null,mpMode=false,mpRemotes=new Map(),mpSendTimer=0,mpChat=[],mpRooms=[],mpReloadT=0,mpWired=false,mpListTimer=0,mpResultShown=false;
let mpEpoch=0;
let mpInviteChecked=false,mpLastJoin=null,mpReconnectTimer=0,mpReconnectTries=0;
let mpManualOff=false,mpEnsureTimer=0,mpSharedAt=0;
let mpWarmSocket=null,mpWarmUrl='';
let audio;
let gunMotion=createWeaponMotion(),gunSample=null;
const touchDevice=matchMedia('(pointer: coarse)').matches;
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
// Будь-яка необроблена помилка одразу показується гравцю, а не губиться в консолі.
function showJsError(reason){
  let msg='';
  try{msg=String(reason?.message||reason||'невідома помилка');}catch{msg='невідома помилка';}
  try{toast('Помилка: '+msg.slice(0,200));}catch{}
  try{const s=$('#mp-code-status');if(s)s.textContent='Помилка: '+msg.slice(0,200);}catch{}
}
window.addEventListener('error',e=>showJsError(e.error||e.message));
window.addEventListener('unhandledrejection',e=>showJsError(e.reason));
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
  const count=String(MAPS.length).padStart(2,'0');
  $('#map-count').textContent=count;$('#hero-map-count').textContent=`01—${count}`;
  $('#map-cards').innerHTML=MAPS.map((m,i)=>`<button class="map-card ${settings.map===i?'selected':''}" data-map="${i}" aria-pressed="${settings.map===i}"><div class="map-image"><canvas width="600" height="280" aria-label="${m.name}"></canvas><span class="map-number">${String(i+1).padStart(2,'0')} / ${count}</span><span class="map-check">${settings.map===i?'✓':''}</span></div><div class="map-detail"><h3>${m.name}</h3><p>${m.desc}</p><div class="map-tags"><span>A / B · ТОЧКИ</span><span>MID · ${m.mid.name} ↗</span></div></div></button>`).join('');
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

function release(){shootHeld=false;touchFire=false;touchUse=false;keys.clear();stick={x:0,y:0};if(document.pointerLockElement===canvas)document.exitPointerLock();}
function lock(){if(touchDevice)return;try{const p=canvas.requestPointerLock?.();p?.catch(()=>toast('Натисни на ігровий екран. Також можна оглядатися, затиснувши мишу.'));}catch{toast('Для огляду затисни мишу на ігровому екрані.');}}
function dialog(type,html){modal=type;const panel=$('#dialog');panel.className=`dialog dialog-${type}`;panel.innerHTML=html;$('#overlay').hidden=false;release();panel.querySelector('button')?.focus();}
function closeDialog(resume=true){$('#overlay').hidden=true;modal='';if(resume&&state==='playing'){paused=false;lock();}}
function header(label,title){return `<div class="dialog-header"><span class="eyebrow">${label}</span><button class="dialog-close" aria-label="Закрити">×</button></div><h2>${title}</h2>`;}
function showMapPlan(){
  if(state==='playing'&&!mpMode)paused=true;
  aiming=false;
  dialog('map',header('СХЕМА МАПИ',map.name)+`<canvas id="map-plan" width="900" height="660" style="width:100%;height:auto" aria-label="Планування ${map.name}"></canvas><p>A — ${map.sites.a.name} · MID — ${map.mid.name} · B — ${map.sites.b.name}</p><p>${(map.callouts||[]).map(a=>a.name).join(' · ')}</p>`);
  mapArt($('#map-plan'),map,true);$('.dialog-close').onclick=()=>closeDialog(state==='playing');
}
$('#map-plan-open').onclick=showMapPlan;
function help(){dialog('help',header('ПОЛЬОВИЙ ДОВІДНИК','КЕРУВАННЯ')+`<p>CT захищають точки A/B, T встановлюють C4. Тримай E стоячи на точці з C4 або біля встановленої бомби за CT. Встановлення — 3,2 с, вибух — через 40 с, знешкодження — 10 с або 5 с із набором. Матч до 13 перемог, зміна сторін після 12 раундів; 12:12 — нічия. Зелені оператори — CT, помаранчеві — T.</p><div class="control-list">${[['W A S D','Рух'],['МИША','Огляд'],['ЛКМ','Постріл'],['ПКМ','Прицілювання'],['R','Перезаряджання'],['1 / 2','Основна / пістолет'],['B','Закупівля під час підготовки'],['E (тримати)','Встановити / знешкодити C4'],['M','Схема мапи'],['SHIFT','Тихий крок'],['CTRL','Присідання'],['SPACE','Стрибок'],['ESC','Пауза'],['TAB','Рахунок команди']].map(([k,t])=>`<div><kbd>${k}</kbd>${t}</div>`).join('')}</div><p>На сенсорному екрані: джойстик зліва, огляд правою половиною екрана, кнопки пострілу, прицілювання ⌖, стрибка ↑ та перезаряджання справа. ⌖ вмикає та вимикає приціл. Після поразки спостерігай за союзником.</p>`);$('.dialog-close').onclick=()=>closeDialog(false);}
function credits(){dialog('credits',header('СЕКТОР / V.01','ПРО ГРУ ТА РЕСУРСИ')+`<p>Браузерний прототип: дев’ять піксельних мап — Mirage, Dust II, Overpass, Ancient, Inferno, Vertigo, Office, Cache та Nuke за наданими схемами, командні бої з ботами, снайперська оптика, тактична закупівля й кастомізація. Мапи, ілюстрації, текстури та звуки цієї збірки створені в коді проєкту.</p><p>Для наступного оновлення підібрані ресурси з itch.io. Вони ще не включені до цієї збірки:</p><ul class="credits-list"><li><a href="https://f8studios.itch.io/snakes-authentic-gun-sounds" target="_blank" rel="noopener">SnakeF8 — звуки зброї</a></li><li><a href="https://kronbits.itch.io/matriax-free-cg-textures" target="_blank" rel="noopener">Kronbits — текстури, CC0</a></li><li><a href="https://quaternius.itch.io/50-lowpoly-guns" target="_blank" rel="noopener">Quaternius — моделі зброї, CC0</a></li><li><a href="https://kenney-assets.itch.io/prototype-textures" target="_blank" rel="noopener">Kenney — текстури прототипу, CC0</a></li></ul><p>Гра працює локально у браузері. Налаштування зберігаються лише на твоєму пристрої.</p>`);$('.dialog-close').onclick=()=>closeDialog(false);}
$('#help-open').onclick=help;$('#credits-open').onclick=credits;$('#footer-credits').onclick=credits;

function spawnSidearm(team){return team===1?'glock':'pistol';}
function sidearmKit(team){const id=spawnSidearm(team);return {weapon:id,inventory:{[id]:{ammo:WEAPONS[id].size,reserve:WEAPONS[id].size*3}}};}
function actor(x,y,team,name){return {x,y,team,name,hp:100,armor:0,angle:team?Math.PI*1.2:.6,cooldown:1.4+Math.random(),path:[],pathTimer:0,moving:false,flash:0,seen:0,money:MATCH.startMoney,helmet:false,kit:false,primary:null,...sidearmKit(team),shots:0,spray:0};}
function start(){
  if(mpClient)mpDisconnect(true);
  initAudio();state='playing';phase='buy';paused=false;round=0;score=[0,0];kills=deaths=0;feed=[];losses=[0,0];map=MAPS[settings.map];
  wallTextures=textures(map);
  const team=Number($('#team-select').value)||0;
  const spawns=[teamSpawns(map,0),teamSpawns(map,1)],names=['РИСЬ','СОКІЛ','КВАРЦ','ТІНЬ','ГРІМ'];
  actors=[0,1].flatMap(t=>spawns[t].map((pos,i)=>({...actor(...pos,t,`${t?'T':'CT'} · ${names[i]}`),slot:i,callsign:names[i]})));
  player=actors.find(a=>a.team===team);player.isPlayer=true;player.name='ТИ';
  $('#lobby').hidden=true;canvas.hidden=false;$('#hud').hidden=false;$('#touch-controls').hidden=!touchDevice;resize();nextRound();
}
$('#start').onclick=start;$('#quick-play').onclick=start;
function nextRound(){
  round++;
  if(round===MATCH.halfRounds+1){score.reverse();losses=[0,0];for(const a of actors){a.team=1-a.team;a.hp=0;a.money=MATCH.startMoney;}}
  phase='buy';clock=MATCH.freezeTime;fightIn=MATCH.countdownTime;thinT=0;paused=false;reload=0;reloadTotal=0;reloadStage=0;nextShot=0;pitch=0;recoil=0;hitTime=0;hurtTime=0;aiming=false;shootHeld=false;touchFire=false;touchUse=false;keys.clear();
  const spawns=[teamSpawns(map,0),teamSpawns(map,1)];
  actors.forEach(a=>{if(!a.isPlayer)a.name=`${a.team?'T':'CT'} · ${a.callsign}`;const pos=spawns[a.team][a.slot];a.x=pos[0];a.y=pos[1];a.angle=a.team?3.8:.72;a.patrol=null;a.patrolT=0;a.destination='';    if(a.hp<=0){a.primary=null;a.armor=0;a.helmet=false;a.kit=false;Object.assign(a,sidearmKit(a.team));}
    a.hp=100;a.moving=false;resetActorHeight(map,a);a.path=[];a.pathTimer=0;a.cooldown=1.5;a.flash=0;a.seen=0;a.shots=0;a.spray=0;
    for(const id of [spawnSidearm(a.team),a.primary].filter(Boolean))a.inventory[id]={ammo:WEAPONS[id].size,reserve:WEAPONS[id].size*3};
    if(!a.isPlayer){const want=a.team===1?['kalash','galil','sg553','mac10']:['rifle','m4a1','famas','aug','smg'];const pick=want.find(id=>a.money>=WEAPONS[id].price);if(pick)purchase(a,pick);if(a.armor<100)purchase(a,'armor');if(a.team===0&&!a.kit)purchase(a,'kit');}
  });
  bomb=createBomb(actors,round%2?'a':'b');touchUse=false;
  resetGunMotion();$('#game-message').textContent=`БІЙ ЧЕРЕЗ ${Math.ceil(fightIn)}`;$('#kill-feed').innerHTML='';feed=[];updateHUD();openShop();
}
function beginCountdown(){
  if(phase!=='buy')return;
  closeDialog(false);paused=false;phase='countdown';clock=MATCH.countdownTime;aiming=false;
  keys.clear();shootHeld=false;touchFire=false;touchUse=false;stick={x:0,y:0};
  $('#game-message').textContent=`БІЙ ЧЕРЕЗ ${Math.ceil(clock)}`;updateHUD();
}
function beginFight(){closeDialog(false);paused=false;phase='fight';clock=MATCH.roundTime;keys.clear();shootHeld=false;touchFire=false;$('#game-message').textContent=player.team?'T · ВСТАНОВИ C4 НА A АБО B':'CT · ЗАХИЩАЙ ТОЧКИ A / B';setTimeout(()=>{if(state==='playing'&&phase==='fight'&&player.hp>0)$('#game-message').textContent='';},1800);sound('win');updateHUD();}
function inBuyZone(){return Math.hypot(player.x-(player.team?map.red:map.blue)[0][0],player.y-(player.team?map.red:map.blue)[0][1])<4;}
const SHOP_CATEGORIES=[
  {id:'all',number:'00',name:'КАТАЛОГ'},
  {id:'pistol',number:'01',name:'ПІСТОЛЕТИ'},
  {id:'smg',number:'02',name:'ПП'},
  {id:'rifle',number:'03',name:'АВТОМАТИ'},
  {id:'sniper',number:'04',name:'СНАЙПЕРСЬКІ'},
  {id:'heavy',number:'05',name:'ВАЖКЕ'},
  {id:'gear',number:'06',name:'СПОРЯДЖЕННЯ'}
];
function openShop(category='all'){
  if(state!=='playing'||phase!=='buy'||player.hp<=0)return toast('Магазин доступний під час підготовки до раунду');
  if(!inBuyZone())return toast('Повернися до стартової зони');
  reload=0;reloadTotal=0;reloadStage=0;
  const items=[
    {id:'pistol',category:'pistol',issued:true,...WEAPONS.pistol},
    {id:'glock',category:'pistol',issued:true,...WEAPONS.glock},
    {id:'p250',category:'pistol',...WEAPONS.p250},
    {id:'dualies',category:'pistol',...WEAPONS.dualies},
    {id:'deagle',category:'pistol',...WEAPONS.deagle},
    {id:'fiveseven',category:'pistol',...WEAPONS.fiveseven},
    {id:'tec9',category:'pistol',...WEAPONS.tec9},
    {id:'cz75',category:'pistol',...WEAPONS.cz75},
    {id:'smg',category:'smg',...WEAPONS.smg},
    {id:'mac10',category:'smg',...WEAPONS.mac10},
    {id:'mp5',category:'smg',...WEAPONS.mp5},
    {id:'mp7',category:'smg',...WEAPONS.mp7},
    {id:'ump45',category:'smg',...WEAPONS.ump45},
    {id:'p90',category:'smg',...WEAPONS.p90},
    {id:'bizon',category:'smg',...WEAPONS.bizon},
    {id:'rifle',category:'rifle',...WEAPONS.rifle},
    {id:'kalash',category:'rifle',...WEAPONS.kalash},
    {id:'famas',category:'rifle',...WEAPONS.famas},
    {id:'galil',category:'rifle',...WEAPONS.galil},
    {id:'m4a1',category:'rifle',...WEAPONS.m4a1},
    {id:'aug',category:'rifle',...WEAPONS.aug},
    {id:'sg553',category:'rifle',...WEAPONS.sg553},
    {id:'marksman',category:'sniper',...WEAPONS.marksman},
    {id:'sniper',category:'sniper',...WEAPONS.sniper},
    {id:'g3sg1',category:'sniper',...WEAPONS.g3sg1},
    {id:'scar20',category:'sniper',...WEAPONS.scar20},
    {id:'shotgun',category:'heavy',...WEAPONS.shotgun},
    {id:'xm1014',category:'heavy',...WEAPONS.xm1014},
    {id:'mag7',category:'heavy',...WEAPONS.mag7},
    {id:'sawedoff',category:'heavy',...WEAPONS.sawedoff},
    {id:'negev',category:'heavy',...WEAPONS.negev},
    {id:'m249',category:'heavy',...WEAPONS.m249},
    {id:'armor',category:'gear',name:'Kevlar',type:'ЗАХИСТ',price:650,icon:'◇',description:'100 броні · захист корпусу'},
    {id:'helmet',category:'gear',name:'Kevlar + Helmet',type:'ЗАХИСТ',price:1000,icon:'◇',description:'100 броні та шолом · захист голови'},
    ...(player.team===0?[{id:'kit',category:'gear',name:'Defuse Kit',type:'СПОРЯДЖЕННЯ CT',price:400,icon:'⌁',description:'Знешкодження C4 за 5 секунд замість 10'}]:[])
  ].filter(item=>(category==='all'||item.category===category)&&(!item.side||item.side==='both'||(player.team===0?item.side==='ct':item.side==='t')));
  const itemCard=item=>{
    const owned=item.issued||(item.id==='armor'?player.armor>=100:item.id==='helmet'?player.helmet&&player.armor>=100:item.id==='kit'?player.kit:player.primary===item.id);
    const disabled=owned||player.money<item.price;
    const stats=item.category==='gear'?item.description:`${item.damage} ШКОДИ · ${item.size} У МАГАЗИНІ${item.scope?` · ОПТИКА ×${item.scope<=.3?'4':'2'}`:''}`;
    const visual=WEAPON_FILES[item.id]?`<img class="gun-sprite" src="${WEAPON_FILES[item.id]}" alt="Зброя ${item.name}" draggable="false">`:`<div class="gun-icon">${item.icon}</div>`;
    const action=item.issued?'<span class="buy-issued">ВИДАНО БЕЗКОШТОВНО</span>':`<button data-buy="${item.id}" ${disabled?'disabled':''}><span>${owned?'У СПОРЯДЖЕННІ':player.money<item.price?'БРАКУЄ ГРОШЕЙ':'КУПИТИ'}</span><strong>$ ${item.price.toLocaleString('uk')}</strong></button>`;
    return `<article class="buy-item ${owned?'is-owned':''}"><div class="buy-item-top"><small>${item.type}</small><span>${item.category.toUpperCase()}</span></div><h3>${item.name}</h3><div class="buy-item-visual">${visual}</div><p>${item.description}</p><div class="buy-item-stats">${stats}</div>${action}</article>`;
  };
  dialog('shop',`<div class="buy-terminal"><header class="buy-topbar"><div><span class="eyebrow">ЗАКУПІВЛЯ / РАУНД ${round}</span><h2>ВИБІР СПОРЯДЖЕННЯ</h2></div><div class="buy-status"><span>ЧАС <b id="shop-timer">${Math.ceil(clock)}</b> С</span><strong>$ ${player.money.toLocaleString('uk')}</strong></div><button id="shop-close-icon" class="buy-close" aria-label="Закрити закупівлю">×</button></header><div class="buy-layout"><nav class="buy-categories" aria-label="Категорії спорядження"><span>КАТЕГОРІЇ</span>${SHOP_CATEGORIES.map(c=>`<button class="buy-category ${category===c.id?'active':''}" data-category="${c.id}" aria-pressed="${category===c.id}"><b>${c.number}</b><span>${c.name}</span><i>›</i></button>`).join('')}</nav><main class="buy-content"><div class="buy-content-head"><div><span class="eyebrow">${category==='all'?'УСЕ СПОРЯДЖЕННЯ':SHOP_CATEGORIES.find(c=>c.id===category).name}</span><p>Пістолет і запас патронів видаються на початку кожного раунду.</p></div><span class="buy-count">${items.length} ПОЗ.</span></div><div class="buy-grid">${items.map(itemCard).join('')}</div></main><aside class="buy-loadout"><span>ПОТОЧНЕ СПОРЯДЖЕННЯ</span><div><small>ОСНОВНА ЗБРОЯ</small><b>${player.primary?WEAPONS[player.primary].name:'НЕ ВИБРАНО'}</b></div><div><small>ЗАПАСНА</small><b>${WEAPONS[spawnSidearm(player.team)].name}</b></div><div><small>БРОНЯ</small><b>${Math.ceil(player.armor)} / 100</b></div><p>Заміна основної зброї не повертає її вартості.</p><button id="shop-ready" class="primary">У БІЙ <span>→</span></button><button id="shop-close" class="text-button">ЗАКРИТИ / B</button></aside></div></div>`);
  $$('[data-category]').forEach(button=>button.onclick=()=>openShop(button.dataset.category));
  $$('[data-buy]').forEach(b=>b.onclick=()=>{
    if(phase!=='buy'||!inBuyZone())return;
    const id=b.dataset.buy;
    if(WEAPONS[id]&&player.primary&&player.primary!==id){const oldName=WEAPONS[player.primary].name;b.innerHTML=`ЗАМІНИТИ ${oldName}? НАТИСНИ ЩЕ РАЗ`;if(b.dataset.confirm!=='yes'){b.dataset.confirm='yes';return;}}
    const result=purchase(player,id);if(result.ok){sound('buy');openShop(category);updateHUD();}else toast(result.message);
  });
  $('#shop-ready').onclick=()=>{beginFight();lock();};$('#shop-close').onclick=()=>closeDialog();$('#shop-close-icon').onclick=()=>closeDialog();
}
function pause(){if(state!=='playing'||phase==='finished')return;if(mpMode)return mpPause();paused=true;aiming=false;dialog('pause',header('ОПЕРАЦІЮ ПРИЗУПИНЕНО','ПАУЗА')+`<p>${map.name} · Раунд ${round} · Рахунок ${score[0]} : ${score[1]}</p><div class="dialog-actions"><button id="resume" class="primary">ПРОДОВЖИТИ <span>→</span></button><button id="restart" class="secondary">НОВИЙ МАТЧ</button><button id="leave" class="secondary">У ГОЛОВНЕ МЕНЮ</button></div>`);$('#resume').onclick=()=>closeDialog();$('.dialog-close').onclick=()=>closeDialog();$('#restart').onclick=start;$('#leave').onclick=leave;}
$('#pause-button').onclick=pause;
function leave(){if(mpClient||mpMode){mpDisconnect();return;}state='lobby';paused=false;closeDialog(false);release();canvas.hidden=true;$('#hud').hidden=true;$('#lobby').hidden=false;tab('play');}
function endRound(winner){
  phase='intermission';intermission=3.5;reload=0;reloadTotal=0;reloadStage=0;shootHeld=false;touchFire=false;aiming=false;
  if(winner>=0)score[winner]++;
  if(winner>=0)rewardRound(actors,winner,losses,bomb);
  $('#game-message').textContent=bomb?.resolved==='defused'?'C4 ЗНЕШКОДЖЕНО · ПЕРЕМОГА CT':bomb?.resolved==='exploded'?'C4 ВИБУХНУЛА · ПЕРЕМОГА T':winner===0?'ПЕРЕМОГА CT':winner===1?'ПЕРЕМОГА T':'НІЧИЯ';sound(winner===0?'win':'empty');updateHUD();
}
function endMatch(){
  phase='finished';const won=score[player.team]>score[1-player.team];dialog('result',`<span class="eyebrow">ОПЕРАЦІЮ ЗАВЕРШЕНО / ${map.name}</span><h2>${score[0]===score[1]?'НІЧИЯ':won?'СЕКТОР ПІД КОНТРОЛЕМ':'СЕКТОР ВТРАЧЕНО'}</h2><div class="result-score"><span>${score[0]}</span><small>:</small><span>${score[1]}</span></div><div class="result-stats"><span>${kills} УСУНЕНЬ</span><span>${deaths} СМЕРТЕЙ</span><span>${round} РАУНДІВ</span></div><div class="dialog-actions"><button id="again" class="primary">ЩЕ ОДИН МАТЧ <span>↗</span></button><button id="menu" class="secondary">ОБРАТИ ІНШУ МАПУ</button></div>`);$('#again').onclick=start;$('#menu').onclick=leave;
}
function logKill(source,target){feed.unshift({source:source.name,target:target.name,t:6});feed=feed.slice(0,4);paintFeed();}
function paintFeed(){$('#kill-feed').innerHTML=feed.map(f=>`<div><b>${escapeText(f.source)}</b> &nbsp; ━ &nbsp; <em>${escapeText(f.target)}</em></div>`).join('');}
function damage(target,n,source,head=false){if(mpMode){if(target.isRemote&&mpClient)mpClient.send({t:C2S.SHOOT,weapon:player.weapon,target:target.mpId,head});return;}if(target.hp<=0)return;applyDamage(target,n,head);if(target.isPlayer){hurtTime=.45;sound('hit');}if(target.hp<=0){const killAward=WEAPONS[source.weapon]?.award||300;source.money=Math.min(MATCH.maxMoney,source.money+killAward);logKill(source,target);if(source.isPlayer)kills++;if(target.isPlayer){deaths++;reload=0;reloadTotal=0;reloadStage=0;shootHeld=false;touchFire=false;$('#game-message').textContent='ТИ ВИБУВ · СПОСТЕРЕЖЕННЯ ЗА СОЮЗНИКОМ';}sound('hit');}}
function currentWeapon(){return WEAPONS[player.weapon];}
function aimProgress(){return player?.hp>0?(settings.motion?clamp(gunMotion.aim.value,0,1):Number(aiming)):0;}
function viewFov(){const zoom=player&&WEAPONS[player.weapon]?.scope||.5;return .78-(.78-zoom)*aimProgress();}
function resetGunMotion(){
  gunMotion=createWeaponMotion();
  gunSample=player?{x:player.x,y:player.y,angle:player.angle,pitch,weapon:player.weapon}:null;
}
function updateGunMotion(dt){
  if(!player||player.hp<=0||modal||!settings.motion){resetGunMotion();return;}
  if(!gunSample)resetGunMotion();
  const previous=gunSample;
  if(previous.weapon!==player.weapon){resetGunMotion();gunMotion.y.value=65;}
  if(dt>0){
    const dx=(player.x-previous.x)/dt,dy=(player.y-previous.y)/dt;
    const turn=Math.atan2(Math.sin(player.angle-previous.angle),Math.cos(player.angle-previous.angle))/dt;
    stepWeaponMotion(gunMotion,player.weapon,{
      turn,look:(pitch-previous.pitch)/dt,
      side:(-dx*Math.sin(player.angle)+dy*Math.cos(player.angle))/3.3,
      forward:(dx*Math.cos(player.angle)+dy*Math.sin(player.angle))/3.3,
      moving:player.moving&&player.grounded,walk,aiming,lift:player.vz||0,
      landing:player.landingSpeed||0,
      wall:weaponWallProximity(map,player.x,player.y,player.angle,player.weapon)
    },dt);
  }
  gunSample={x:player.x,y:player.y,angle:player.angle,pitch,weapon:player.weapon};
}
function kickGun(){if(settings.motion)kickWeaponMotion(gunMotion,player.weapon,aiming);}
function switchWeapon(id){if(mpMode)return;if(!player||player.hp<=0||!player.inventory[id])return;player.weapon=id;reload=0;reloadTotal=0;reloadStage=0;nextShot=.2;updateHUD();}
function mpSwitchWeapon(id){if(!player||player.hp<=0||!WEAPONS[id])return;player.weapon=id;nextShot=.25;sound('reload');updateHUD();}
function reloadProgress(){if(reload<=0||reloadTotal<=0)return 0;return clamp(1-reload/reloadTotal,0,1);}
function reloadWeapon(){if(usingBomb()||mpMode||state!=='playing'||paused||modal||phase!=='fight'||player.hp<=0||reload>0)return;const w=currentWeapon(),inv=player.inventory[player.weapon];if(inv.ammo>=w.size||!inv.reserve)return;reload=w.reload;reloadTotal=w.reload;reloadStage=0;aiming=false;sound('reload');updateHUD();}
function shotCollision(angle){
  const projection=canvas.width/(2*viewFov()),horizon=canvas.height*.48+pitch*canvas.height+(keys.has('ControlLeft')?canvas.height*.06:0);
  const origin={x:player.x,y:player.y,z:actorHeight(map,player)+.5};
  const direction={x:Math.cos(angle),y:Math.sin(angle),z:(horizon-canvas.height*.5)*Math.cos(angle-player.angle)/projection};
  const hits=actors.filter(a=>a!==player&&a.hp>0).map(a=>({a,hit:hitOperator(map,a,origin,direction,elapsed,settings.motion)})).filter(o=>o.hit).sort((a,b)=>a.hit.distance-b.hit.distance);
  const first=hits[0];
  if(!first)return null;
  const {a,hit}=first,d=hit.distance;
  if(a.team===player.team||!lineOfSight(map,origin.x,origin.y,origin.x+direction.x*d,origin.y+direction.y*d,origin.z,origin.z+direction.z*d))return null;
  return {a,d,head:hit.head};
}
function shoot(){
  if(state!=='playing'||(phase!=='fight'&&!mpMode)||paused||modal||player.hp<=0||reload>0||nextShot>0||usingBomb())return;
  const w=currentWeapon();
  if(mpMode){
    if(mpReloadT>0)return;
    if(mpMyAmmo()<=0){sound('empty');nextShot=.3;return;}
    nextShot=w.rate;recoil=1;kickGun();sound('shot',player.weapon);
    if(w.automatic)player.spray=Math.min(1.5,(player.spray||0)+(player.weapon==='kalash'?.16:.07));
    const spread=w.spread*(aiming?.45:1)*(player.moving?1.8:1)*(w.automatic?1+(player.spray||0)*2:1);
    const mAngle=player.angle+(Math.random()-.5)*spread;
    let shotTarget=null,shotHead=false;
    const collision=shotCollision(mAngle);
    if(collision){shotTarget=collision.a.mpId;shotHead=collision.head;hitTime=.15;sound('hit');}
    if(mpClient)mpClient.send({t:C2S.STATE,x:player.x,y:player.y,angle:player.angle,moving:player.moving,weapon:player.weapon});
    mpClient?.send({t:C2S.SHOOT,weapon:player.weapon,target:shotTarget,head:shotHead});
    updateHUD();return;
  }
  const inv=player.inventory[player.weapon];if(!inv.ammo){sound('empty');nextShot=.3;reloadWeapon();return;}
  inv.ammo--;nextShot=w.rate;recoil=1;kickGun();sound('shot',player.weapon);let anyHit=false;
  if(w.automatic)player.spray=Math.min(1.5,(player.spray||0)+(player.weapon==='kalash'?.16:.07));
  for(let pellet=0;pellet<w.pellets;pellet++){
    const spread=w.spread*(aiming?.45:1)*(player.moving?1.8:1)*(w.automatic?1+(player.spray||0)*2:1);const angle=player.angle+(Math.random()-.5)*spread;
    const collision=shotCollision(angle);
    if(collision){const {a,d,head}=collision,falloff=w.pellets>1?clamp(1-d/14,.15,1):1;damage(a,w.damage*falloff*(head?(w.headMult||2):1),player,head);anyHit=true;}

  }
  if(anyHit){hitTime=.15;sound('hit');}updateHUD();
}

function requestJump(){
  if(state!=='playing'||paused||modal||!player||player.hp<=0||!['fight','mp'].includes(phase))return;
  if(jumpActor(map,player)&&mpMode)mpClient?.send({t:C2S.STATE,x:player.x,y:player.y,angle:player.angle,moving:player.moving,weapon:player.weapon,jump:true});
}
function usingBomb(){return !mpMode&&phase==='fight'&&player&&bombAction(map,bomb,player)&&(keys.has('KeyE')||touchUse)&&!player.moving;}
function updatePlayer(dt){
  player.moving=false;if(player.hp<=0||modal)return;
  const right=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+stick.x,forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'))-stick.y,len=Math.max(1,Math.hypot(right,forward));
  const speed=keys.has('ShiftLeft')||keys.has('ControlLeft')?1.8:3.3;
  const dx=(Math.cos(player.angle)*forward-Math.sin(player.angle)*right)*speed*dt/len,dy=(Math.sin(player.angle)*forward+Math.cos(player.angle)*right)*speed*dt/len;
  const oldX=player.x,oldY=player.y;
  stepActor(map,player,dx,dy,dt,actors);player.moving=Math.hypot(player.x-oldX,player.y-oldY)>.001;
  if(player.moving&&player.grounded){walk+=dt*speed*3;stepTimer-=dt;if(stepTimer<=0){stepTimer=keys.has('ShiftLeft')?.6:.4;sound('step');}}
  if(keys.has('ArrowLeft'))player.angle-=dt*1.8;if(keys.has('ArrowRight'))player.angle+=dt*1.8;
  if(player.landingSpeed>1)sound('step');
}
// Дійшов до точки — блукай околицями замість табору: випадкова досяжна
// позиція в радіусі 8 клітинок. Носій C4 і той, хто знешкоджує, не блукають.
function patrolTarget(a){
  for(let i=0;i<8;i++){
    const x=a.x+(Math.random()*2-1)*8,y=a.y+(Math.random()*2-1)*8;
    if(x<1||y<1||x>=map.size-1||y>=map.size-1||!canStand(map,x,y))continue;
    if(!findPath(map,a.x,a.y,x,y).length)continue;
    return {x,y};
  }
  return null;
}
// Купа однієї команди більша за трьох — зайві гинуть, лишається троє.
// Фраг записується найближчому ворогу; гравець під правило не підпадає.
function thinBunch(){
  for(const team of [0,1]){
    const bots=actors.filter(a=>!a.isPlayer&&a.team===team&&a.hp>0);
    const claimed=new Set();
    for(const a of bots){
      if(claimed.has(a)||a.hp<=0)continue;
      const bunch=bots.filter(b=>b.hp>0&&!claimed.has(b)&&Math.hypot(b.x-a.x,b.y-a.y)<=2.5);
      if(bunch.length>3){
        bunch.sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y));
        for(const extra of bunch.slice(3)){
          const foes=actors.filter(e=>e.team!==extra.team&&e.hp>0).sort((p,q)=>Math.hypot(p.x-extra.x,p.y-extra.y)-Math.hypot(q.x-extra.x,q.y-extra.y));
          damage(extra,9999,foes[0]||extra);
        }
      }
      bunch.forEach(b=>claimed.add(b));
    }
  }
}
function updateBots(dt){
  const level=settings.difficulty==='easy'?.55:settings.difficulty==='hard'?1.35:1;
  const defuser=bomb.planted?actors.filter(a=>a.team===0&&a.hp>0&&!a.isPlayer).sort((a,b)=>Math.hypot(a.x-bomb.x,a.y-bomb.y)-Math.hypot(b.x-bomb.x,b.y-bomb.y))[0]:null;
  for(const a of actors){
    if(a.isPlayer||a.hp<=0)continue;
    a.moving=false;a.flash=Math.max(0,a.flash-dt);a.cooldown-=dt;a.pathTimer-=dt;
    const enemies=actors.filter(e=>e.team!==a.team&&e.hp>0).sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y));
    const visible=enemies.find(e=>Math.hypot(e.x-a.x,e.y-a.y)<15&&lineOfSight(map,a.x,a.y,e.x,e.y,actorHeight(map,a)+.5,actorHeight(map,e)+.5));
    const interaction=bombAction(map,bomb,a);
    // The last CT must finish the objective even after every T has been eliminated.
    if(interaction&&!visible){a.flash=0;a.path=[];continue;}
    if(visible){
      a.angle=Math.atan2(visible.y-a.y,visible.x-a.x);a.seen+=dt;const skill=a.team===player.team?.85:level;
      if(a.cooldown<=0&&a.seen>.45){a.cooldown=(.58+Math.random()*.65)/skill;a.flash=.09;a.shots++;
        const distance=Math.hypot(visible.x-a.x,visible.y-a.y),chance=clamp(.85-distance*.04,.15,.75)*skill;
        if(Math.random()<chance)damage(visible,WEAPONS[a.weapon].damage*.65,a);
        if(a.shots>=WEAPONS[a.weapon].size){a.cooldown=WEAPONS[a.weapon].reload;a.shots=0;}
      }
      if(a!==bomb.carrier&&a!==defuser)continue;
    }else a.seen=0;
    let target,stop=1;
    if(bomb.planted){target={x:bomb.x,y:bomb.y};stop=a===defuser?1:3;}
    else if(a.team===1){const point=map.sites[bomb.site].point;target=bomb.dropped?bomb:{x:point[0],y:point[1]};stop=(a===bomb.carrier||bomb.dropped)? .7:3;}
    else {const point=map.sites[a.slot%2?'b':'a'].point;target={x:point[0],y:point[1]};stop=2;}
    let distance=Math.hypot(target.x-a.x,target.y-a.y);
    if(distance<=stop&&lineOfSight(map,a.x,a.y,target.x,target.y)){
      if(a===bomb.carrier||a===defuser)continue;
      a.patrolT=(a.patrolT??0)-dt;
      if(!a.patrol||Math.hypot(a.patrol.x-a.x,a.patrol.y-a.y)<.6||a.patrolT<=0){a.patrol=patrolTarget(a);a.patrolT=4+Math.random()*3;}
      if(!a.patrol)continue;
      target=a.patrol;stop=.5;distance=Math.hypot(target.x-a.x,target.y-a.y);
      if(distance<=stop)continue;
    }
    const destination=`${Math.floor(target.x)},${Math.floor(target.y)}`;
    if(a.pathTimer<=0||(a.destination&&a.destination!==destination)){a.path=findPath(map,a.x,a.y,target.x,target.y);a.pathTimer=.9+Math.random()*.35;a.destination=destination;}
    if(a.path.length){const p=a.path[0],dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);
      if(d<.12)a.path.shift();else {const speed=Math.min(d,dt*2.2),x=a.x,y=a.y;moveActor(map,a,dx/d*speed,dy/d*speed,actors);
        if(Math.hypot(a.x-x,a.y-y)<.001)moveActor(map,a,-dy/d*speed,dx/d*speed,actors);
        a.moving=Math.hypot(a.x-x,a.y-y)>.001;if(!visible)a.angle=Math.atan2(dy,dx);
      }
    }
  }
  thinT-=dt;if(thinT<=0){thinT=1;thinBunch();}
}
function update(dt){
  if(state!=='playing'||paused||phase==='finished')return;
  elapsed+=dt;recoil=Math.max(0,recoil-dt*6);hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);nextShot=Math.max(0,nextShot-dt);if(player)player.spray=Math.max(0,(player.spray||0)-dt*1.8);feed.forEach(f=>f.t-=dt);feed=feed.filter(f=>f.t>0);feedTimer-=dt;if(feedTimer<=0){feedTimer=.5;paintFeed();}
  if(mpMode){mpUpdate(dt);return;}
  if(phase==='intermission'){intermission-=dt;if(intermission<=0){if(score.some(s=>s>=MATCH.winScore)||round>=MATCH.halfRounds*2)endMatch();else nextRound();}return;}
  clock-=dt;if(phase==='fight')updatePlayer(dt);updateGunMotion(dt);
  if(phase==='buy'){fightIn-=dt;if(fightIn<=0){beginFight();return;}$('#game-message').textContent=`БІЙ ЧЕРЕЗ ${Math.ceil(fightIn)}`;return;}
  if(phase==='countdown'){if(clock<=0)beginFight();else $('#game-message').textContent=`БІЙ ЧЕРЕЗ ${Math.ceil(clock)}`;return;}
  if(reload>0){reload-=dt;const p=reloadProgress();if(reloadStage===0&&p>=.38){reloadStage=1;sound('reload');}else if(reloadStage===1&&p>=.72){reloadStage=2;sound('reload');}if(reload<=0){reload=0;reloadTotal=0;reloadStage=0;const inv=player.inventory[player.weapon],take=Math.min(currentWeapon().size-inv.ammo,inv.reserve);inv.ammo+=take;inv.reserve-=take;sound('reload');updateHUD();}}
  if(shootHeld||touchFire){if(currentWeapon().automatic)shoot();}
  updateBots(dt);
  // The round deadline wins over a plant completed after time has expired.
  if(clock<=0&&!bomb.planted){endRound(0);return;}
  const event=stepBomb(map,bomb,actors,dt,a=>a.isPlayer?(keys.has('KeyE')||touchUse)&&!modal&&reload<=0:!a.flash);
  if(event==='planted'){sound('win');toast(`C4 ВСТАНОВЛЕНО · ${bomb.site.toUpperCase()} · 40 С`);}
  const winner=bombRoundWinner(actors,bomb,clock<=0);if(winner!==null)endRound(winner);
}
function updateObjectiveHUD(){
  const panel=$('#objective');panel.hidden=phase!=='fight';
  $('#touch-use').hidden=phase!=='fight'||!bombAction(map,bomb,player);
  if(phase!=='fight')return;
  const action=bombAction(map,bomb,player);
  const acting=bomb.user===player&&bomb.action;
  panel.classList.toggle('planted',bomb.planted);panel.classList.toggle('interacting',!!acting);panel.classList.toggle('available',!!action);
  $('#objective-title').textContent=bomb.planted?`C4 · ${bomb.site.toUpperCase()} · ${Math.ceil(bomb.timeLeft)} С`:bomb.carrier===player?'У ТЕБЕ C4 · ТОЧКИ A / B':bomb.dropped?'C4 НА ЗЕМЛІ':player.team?'СУПРОВОДЖУЙ C4':'ЗАХИЩАЙ A / B';
  $('#objective-hint').textContent=acting?`${bomb.action==='plant'?'ВСТАНОВЛЕННЯ':'ЗНЕШКОДЖЕННЯ'} · ${Math.floor(bomb.progress/action.duration*100)}%`:action?`ТРИМАЙ E · ${action.type==='plant'?'ВСТАНОВИТИ C4':'ЗНЕШКОДИТИ'} (${action.duration} С)`:bomb.planted?player.team?'ЗАХИЩАЙ C4 ДО ВИБУХУ':'ЗНАЙДИ C4 НА МІНІМАПІ · ТРИМАЙ E ПОРУЧ':player.team?'ВСТАНОВИ C4 АБО УСУНЬ CT':'НЕ ДАЙ T ВСТАНОВИТИ C4';
  $('#objective-progress').style.width=acting?`${Math.min(100,bomb.progress/action.duration*100)}%`:'0%';
}
function updateVitals(){
  const hp=Math.max(0,Math.ceil(player.hp)),armor=Math.max(0,Math.ceil(player.armor||0));
  $('#health').textContent=hp;$('#armor').textContent=armor;
  const bar=$('#health-bar');if(bar){bar.style.width=hp+'%';bar.classList.toggle('warning',hp>25&&hp<=50);bar.classList.toggle('critical',hp<=25);}
}
function updateHUD(){
  if(!player)return;
  const aimButton=$('#touch-aim');aimButton.ariaPressed=String(aiming);aimButton.classList.toggle('active',aiming);
  aimButton.hidden=player.hp<=0||(!mpMode&&phase!=='fight');
  $('#touch-shop').hidden=mpMode||phase!=='buy';
  $('#touch-reload').hidden=!!mpMode;
  $('#touch-weapon').hidden=!mpMode;
  const areas=[map.sites.a,map.sites.b,map.mid,...(map.callouts||[])];
  let area=null,distance=Infinity;
  for(const candidate of areas){const d=Math.hypot(player.x-candidate.point[0],player.y-candidate.point[1]);if(d<distance){distance=d;area=candidate;}}
  $('#map-location').textContent=distance<5?area.name:'';
  if(mpMode){
    $('#objective').hidden=true;$('#touch-use').hidden=true;
    const me=mpMe(),reloading=!me||me.ammo<=0;
    updateVitals();
    $('#ammo').textContent=reloading?'··':me.ammo;$('#reserve').textContent='∞';
    $('#weapon-name').textContent=reloading?'ПЕРЕЗАРЯДЖАННЯ':currentWeapon().name;
    $('#money').textContent='МЕРЕЖА';
    $('#blue-score').textContent=mpRoom?mpRoom.score[0]:0;$('#red-score').textContent=mpRoom?mpRoom.score[1]:0;
    const t=Math.max(0,mpRoom?mpRoom.timeLeft:0);
    $('#timer').textContent=`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
    $('#round-label').textContent=mpRoom?`ДО ${mpRoom.killTarget} ФРАГІВ`:'МЕРЕЖА';
    $('#map-name').textContent=map.name;
    const blues=mpRoom?mpRoom.players.filter(p=>p.team===0).length:0,reds=mpRoom?mpRoom.players.filter(p=>p.team===1).length:0;
    $('#phase-label').textContent=`${blues} CT / ${reds} T`;
    $('#buy-tip').hidden=true;$('#crosshair').hidden=!me||!me.alive||aimProgress()>.65;
    $('#crosshair').style.opacity=reloading?'.25':'1';
    $('#hit-marker').style.opacity=hitTime>0?'1':'0';$('#hurt').style.opacity=String(hurtTime*.9);
    return;
  }
  updateObjectiveHUD();
  const inv=player.inventory[player.weapon];updateVitals();$('#ammo').textContent=reload>0?'··':inv.ammo;$('#reserve').textContent=inv.reserve;$('#weapon-name').textContent=reload>0?'ПЕРЕЗАРЯДЖАННЯ':currentWeapon().name;$('#money').textContent=`$ ${player.money.toLocaleString('uk')}`;$('#blue-score').textContent=score[0];$('#red-score').textContent=score[1];$('#timer').textContent=`${Math.floor(Math.max(0,bomb?.planted&&phase==='fight'?bomb.timeLeft:(phase==='buy'?fightIn:clock))/60)}:${String(Math.floor(Math.max(0,bomb?.planted&&phase==='fight'?bomb.timeLeft:(phase==='buy'?fightIn:clock))%60)).padStart(2,'0')}`;$('#round-label').textContent=`РАУНД ${round} / 24`;$('#map-name').textContent=map.name;$('#phase-label').textContent=phase==='buy'?'ЗАКУПІВЛЯ':phase==='countdown'?'ПОЧАТОК БОЮ':`${actors.filter(a=>a.team===0&&a.hp>0).length} CT / ${actors.filter(a=>a.team===1&&a.hp>0).length} T`;$('#buy-tip').hidden=phase!=='buy'||!!modal;$('#crosshair').hidden=player.hp<=0||aimProgress()>.65;$('#crosshair').style.opacity=reload>0?'.25':'1';$('#hit-marker').style.opacity=hitTime>0?'1':'0';$('#hurt').style.opacity=String(hurtTime*.9);if($('#shop-timer'))$('#shop-timer').textContent=Math.ceil(Math.max(0,phase==='buy'?fightIn:clock));}

function resize(){const cap=settings.quality==='low'?640:960;canvas.width=Math.min(cap,innerWidth);canvas.height=Math.round(canvas.width*innerHeight/innerWidth);zbuffer=new Float32Array(canvas.width);terrainDepth=new Float32Array(canvas.width*canvas.height);}
addEventListener('resize',resize);
function viewActor(){if(mpMode||player.hp>0)return player;return actors.find(a=>a.team===player.team&&a.hp>0)||player;}
function render(){
  if(state!=='playing')return;
  ctx.imageSmoothingEnabled=false;
  const w=canvas.width,h=canvas.height,view=viewActor(),angle=view.angle,ca=Math.cos(angle),sa=Math.sin(angle),fov=view===player?viewFov():.78,projection=w/(2*fov),horizon=h*.48+(view===player?pitch*h:0)+(keys.has('ControlLeft')?h*.06:0);
  ctx.fillStyle=map.sky;ctx.fillRect(0,0,w,h);const sky=ctx.createLinearGradient(0,0,0,Math.max(1,horizon));sky.addColorStop(0,tint(map.sky,.53));sky.addColorStop(1,tint(map.sky,1.03));ctx.fillStyle=sky;ctx.fillRect(0,0,w,Math.max(1,horizon));
  ctx.fillStyle=tint(map.wall,.7);for(let i=-1;i<18;i++){const x=((i*113-angle*100)%(w+113)+w+113)%(w+113)-113;const bh=40+Math.sin(i*17)*25;ctx.fillRect(x,horizon-bh,70,bh);}
  const floor=ctx.createLinearGradient(0,Math.max(0,horizon),0,h);floor.addColorStop(0,tint(map.floor,.46));floor.addColorStop(1,tint(map.floor,.9));ctx.fillStyle=floor;ctx.fillRect(0,Math.max(0,horizon),w,h);
  const eye=actorHeight(map,view)+.5;
  if(map.heights){
    drawTerrain(ctx,map,view,{w,h,fov,projection,horizon,eye,colStep:settings.quality==='low'?2:1,depths:terrainDepth,zbuffer,wallTextures});
  }else{
  // Perspective floor grid: samples world coordinates in each screen row.
  const horizonY=Math.max(0,Math.floor(horizon+1));ctx.globalAlpha=.18;const floorStep=settings.quality==='low'?5:4;
  for(let sy=horizonY;sy<h;sy+=floorStep){const dist=projection*.5/(sy-horizon);if(dist>25)continue;const leftX=view.x+dist*(ca+sa*fov),leftY=view.y+dist*(sa-ca*fov),dx=-2*sa*fov*dist/w,dy=2*ca*fov*dist/w;
    for(let sx=0;sx<w;sx+=floorStep){
      const fx=leftX+dx*sx,fy=leftY+dy*sx,gx=Math.floor(fx),gy=Math.floor(fy),ground=map.ground[gy]?.[gx]||0;
      if(ground){
        ctx.globalAlpha=.65;
        if(ground<=2)ctx.fillStyle=ground===1?'#c18746':'#689b96';
        else{const tread=(ground===3?fx:fy)*3%1;ctx.fillStyle=tread<.17?'#716047':tread<.3?'#ead6ad':'#b69b73';}
        ctx.fillRect(sx,sy,floorStep,floorStep);ctx.globalAlpha=.18;
      }else if(fx-gx<.035||fy-gy<.035){ctx.fillStyle='#cbd0aa';ctx.fillRect(sx,sy,floorStep,floorStep);}else if((gx+gy)%2===0){ctx.fillStyle='#17271f';ctx.fillRect(sx,sy,floorStep,floorStep);}
    }
  }ctx.globalAlpha=1;
  const colStep=settings.quality==='low'?2:1;
  for(let x=0;x<w;x+=colStep){const camera=2*x/w-1,rx=ca-sa*fov*camera,ry=sa+ca*fov*camera;let mx=Math.floor(view.x),my=Math.floor(view.y);const ddx=Math.abs(1/rx),ddy=Math.abs(1/ry),sx=rx<0?-1:1,sy=ry<0?-1:1;let sideX=(rx<0?view.x-mx:mx+1-view.x)*ddx,sideY=(ry<0?view.y-my:my+1-view.y)*ddy,side=0,type=1;
    for(let k=0;k<80;k++){if(sideX<sideY){sideX+=ddx;mx+=sx;side=0;}else{sideY+=ddy;my+=sy;side=1;}type=map.grid[my]?.[mx]??1;if(type)break;}
    const dist=Math.max(.05,side?sideY-ddy:sideX-ddx),height=projection/dist,top=horizon-height*.5;let hit=side?view.x+dist*rx:view.y+dist*ry;hit-=Math.floor(hit);const tx=Math.floor(hit*64);
    ctx.drawImage(wallTextures[type]||wallTextures[1],tx,0,1,64,x,top,colStep,height);
    ctx.fillStyle=`rgba(8,22,22,${Math.min(.82,dist/30+(side?.19:0))})`;ctx.fillRect(x,top,colStep,height);
    zbuffer[x]=dist;if(colStep===2)zbuffer[x+1]=dist;
  }
  }
  if(!map.heights)for(let y=0;y<h;y++)for(let x=0;x<w;x++)terrainDepth[y*w+x]=zbuffer[x];
  const labels=drawOperators(ctx,map,actors,view,{w,h,projection,horizon,eye,depths:terrainDepth,time:elapsed,motion:settings.motion,skin:SKINS[settings.skin].color,glove:GLOVES[settings.glove].color});
  for(const {a,depth,x,y,bodyY} of labels){
    const sx=Math.round(x),sy=Math.floor(clamp(bodyY,0,h-1));
    if((a.team===player.team||mpMode)&&sx>=0&&sx<w&&y>0&&y<h&&depth<terrainDepth[sy*w+sx]+.4){
      ctx.fillStyle=a.team===0?'#c3f66b':'#f4a46a';ctx.font=`${Math.max(9,Math.min(13,projection/depth*.07))}px monospace`;ctx.textAlign='center';ctx.fillText(a.name,x,y);ctx.textAlign='left';
    }
  }
  if(!mpMode&&bomb&&(bomb.planted||bomb.dropped)){
    const dx=bomb.x-view.x,dy=bomb.y-view.y,depth=dx*ca+dy*sa;
    if(depth>.15){const x=w/2+(-dx*sa+dy*ca)*projection/depth,y=horizon-(floorHeight(map,bomb.x,bomb.y)+.12-eye)*projection/depth;
      if(x>0&&x<w&&y>0&&y<h&&depth<terrainDepth[Math.floor(y)*w+Math.floor(x)]+.3){
        const size=Math.max(4,projection*.18/depth);ctx.fillStyle='#23251f';ctx.fillRect(x-size,y-size,size*2,size);
        ctx.fillStyle=bomb.planted&&Math.sin(elapsed*8)>0?'#ff5b40':'#e1b75e';ctx.fillRect(x-size*.6,y-size*.8,size*1.2,size*.35);
        ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('C4',x,y-size-4);ctx.textAlign='left';
      }
    }
  }
  const vignette=ctx.createRadialGradient(w*.5,h*.45,w*.2,w*.5,h*.5,w*.75);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#04100b99');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  if(player.hp>0)drawGun(w,h);
  renderMinimap(view);
}
function drawGun(w,h){
  const pistol=player.weapon==='pistol';
  const p=reloadProgress();
  const downHold=p<=0?0:p<.25?p/.25:p<.65?1:1-(p-.65)/.35;
  const dip=p>0?Math.sin(p*Math.PI):0;
  const sway=p>0?Math.sin(p*Math.PI*2)*22*downHold:0;
  const cockJerk=p>.72&&p<.92?Math.sin((p-.72)/.2*Math.PI):0;
  const dropY=downHold*105+dip*18-cockJerk*22;
  const tilt=downHold*.5-cockJerk*.09;
  ctx.save();const scale=Math.min(w/900,h/560)*(touchDevice?.62:1);
  const physical=settings.motion,ads=aimProgress(),scoped=!!currentWeapon().scope;
  const wall=physical?clamp(gunMotion.wall.value,0,1):0;
  const gx=physical?gunMotion.x.value:0,gy=physical?gunMotion.y.value+gunMotion.kick.value:0;
  const angle=.48+ads*.85,muzzle=WEAPON_MUZZLES[player.weapon];
  const aimX=w*.5+(muzzle*Math.cos(angle)-24*Math.sin(angle))*scale;
  const aimY=h*.5+(120+muzzle*Math.sin(angle)+24*Math.cos(angle))*scale;
  const originX=w*(touchDevice?.8:pistol?.64:.78)*(1-ads)+aimX*ads;
  const originY=h*(1-ads)+aimY*ads;
  ctx.translate(originX+(sway+gx-wall*25)*scale,originY+(dropY+gy+wall*90)*scale);
  ctx.scale(scale*(1-wall*.12),scale*(1-wall*.12));ctx.rotate(-tilt*.55+(physical?gunMotion.roll.value:0)-wall*.28);
  ctx.globalAlpha=1-ads;
  drawHeldWeapon(ctx,player.weapon,{skin:SKINS[settings.skin].color,glove:GLOVES[settings.glove].color,ads,reload:p,flash:recoil});
  ctx.restore();
  if(ads>0&&!scoped){
    ctx.save();ctx.globalAlpha=ads;
    ctx.translate(w*.5+(1-ads)*w*.18,h*.5+(1-ads)*h*.25);
    ctx.scale(scale,scale);
    drawWeaponSights(ctx,player.weapon,{skin:SKINS[settings.skin].color,glove:GLOVES[settings.glove].color,flash:recoil});
    ctx.restore();
  }
  if(scoped&&ads>0)drawScopeOverlay(ctx,w,h,player.weapon,ads);
  // Шкала прогресу перезаряджання під прицілом.
  if(p>0){const bw=Math.min(220,w*.3),bx=w/2-bw/2,by=h*(touchDevice?.86:.56);ctx.save();ctx.globalAlpha=.92;ctx.fillStyle='#0b1513cc';ctx.fillRect(bx-8,by-8,bw+16,30);ctx.fillStyle='#2a3a32';ctx.fillRect(bx,by,bw,6);ctx.fillStyle='#c3f66b';ctx.fillRect(bx,by,bw*p,6);ctx.fillStyle='#eef1e8';ctx.font='11px monospace';ctx.textAlign='center';const label=p<.38?'МАГАЗИН ГЕТЬ':p<.72?'НОВИЙ МАГАЗИН':'ЗАТВОР · ГОТОВО';ctx.fillText(`${label} ${Math.round(p*100)}%`,w/2,by+22);ctx.textAlign='left';ctx.restore();}
}
function renderMinimap(view){
  const s=160/map.size;
  let background=minimapBackgrounds.get(map);
  if(!background){
    background=document.createElement('canvas');background.width=160;background.height=160;
    const c=background.getContext('2d');c.fillStyle='#102019';c.fillRect(0,0,160,160);
    for(let y=0;y<map.size;y++)for(let x=0;x<map.size;x++){
      if(map.grid[y][x]){c.fillStyle=map.heights?'#89765a':map.grid[y][x]===2?'#657156':'#45574c';c.fillRect(x*s,y*s,s,s);}
    }
    const tacticalMark=(label,[x,y],color)=>{c.fillStyle='#07110ee0';c.fillRect(x*s-5,y*s-5,10,10);c.fillStyle=color;c.fillRect(x*s-4,y*s-4,8,8);c.fillStyle='#07110e';c.font='bold 7px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(label,x*s,y*s+.5);};
    tacticalMark('A',map.sites.a.point,'#e4a062');tacticalMark('M',map.mid.point,'#f4d47c');tacticalMark('B',map.sites.b.point,'#83b7b0');
    minimapBackgrounds.set(map,background);
  }
  mc.drawImage(background,0,0);mc.textAlign='left';mc.textBaseline='alphabetic';
  for(const a of actors){if(a.hp<=0)continue;if(a.team!==view.team&&!lineOfSight(map,view.x,view.y,a.x,a.y,actorHeight(map,view)+.5,actorHeight(map,a)+.5))continue;mc.fillStyle=a.team===0?'#c3f66b':'#f4a46a';mc.beginPath();mc.arc(a.x*s,a.y*s,a.isPlayer?3.6:2.4,0,7);mc.fill();}
  if(!mpMode&&bomb&&(bomb.planted||bomb.dropped)){mc.fillStyle=bomb.planted?'#ff6250':'#ffcf69';mc.fillRect(bomb.x*s-3,bomb.y*s-3,6,6);mc.font='bold 10px monospace';mc.fillText('C4',bomb.x*s+4,bomb.y*s-4);}
  mc.strokeStyle='#c3f66b99';mc.beginPath();mc.moveTo(view.x*s,view.y*s);mc.lineTo((view.x+Math.cos(view.angle)*2)*s,(view.y+Math.sin(view.angle)*2)*s);mc.stroke();
}
function frame(now){const dt=Math.min(.045,(now-lastTime)/1000);lastTime=now;update(dt);render();hudTimer-=dt;if(hudTimer<=0){hudTimer=.08;if(state==='playing')updateHUD();}requestAnimationFrame(frame);}
requestAnimationFrame(frame);

addEventListener('keydown',e=>{
  if(state!=='playing'){if(e.code==='Escape'&&modal)closeDialog(false);return;}
  if(['Space','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){if(modal==='shop'||modal==='pause'||modal==='map')closeDialog();else if(!modal)pause();return;}
  if(e.code==='KeyM'){if(modal==='map')closeDialog();else if(!modal&&!paused)showMapPlan();return;}
  if(e.code==='KeyB'){if(modal==='shop')closeDialog();else if(!modal)openShop();return;}
  if(modal||paused)return;keys.add(e.code);
  if(mpMode){
    if(e.code==='KeyR')toast('Перезаряджання автоматичне після порожнього магазина');
    if(e.code==='Digit1')mpSwitchWeapon('pistol');if(e.code==='Digit2')mpSwitchWeapon('smg');if(e.code==='Digit3')mpSwitchWeapon('rifle');if(e.code==='Digit4')mpSwitchWeapon('shotgun');if(e.code==='Digit5')mpSwitchWeapon('kalash');if(e.code==='Digit6')mpSwitchWeapon('marksman');if(e.code==='Digit7')mpSwitchWeapon('sniper');
    if(e.code==='KeyB')toast('Магазина в мережі немає — усі 7 стволів доступні на 1–7');
    if(e.code==='Space')requestJump();
    if(e.code==='Tab'&&mpRoom)toast(`CT ${mpRoom.score[0]} : ${mpRoom.score[1]} T · Фраги: ${kills} · Смерті: ${deaths}`);
    return;
  }
  if(e.code==='KeyR')reloadWeapon();if(e.code==='Digit1'&&player.primary)switchWeapon(player.primary);if(e.code==='Digit2')switchWeapon(spawnSidearm(player.team));if(e.code==='Space')requestJump();
  if(e.code==='Tab')toast(`CT ${score[0]} : ${score[1]} T · Твої усунення: ${kills} · Смерті: ${deaths}`);
});
addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('mousedown',e=>{if(state!=='playing'||paused||modal)return;initAudio();if(!document.pointerLockElement){dragging=true;lock();}if(e.button===0){shootHeld=true;shoot();}if(e.button===2&&player.hp>0&&reload<=0&&mpReloadT<=0)aiming=true;});
addEventListener('mouseup',e=>{dragging=false;if(e.button===0)shootHeld=false;if(e.button===2)aiming=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(state!=='playing'||paused||modal||player.hp<=0)return;if(document.pointerLockElement===canvas||dragging){player.angle+=e.movementX*.0026*settings.sensitivity*(aiming?.6:1);pitch=clamp(pitch-e.movementY*.0019*settings.sensitivity,-.45,.45);}});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&state==='playing'&&!modal&&phase!=='finished')pause();});
addEventListener('blur',()=>{keys.clear();shootHeld=false;touchFire=false;aiming=false;if(state==='playing'&&!modal)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing'&&phase!=='finished'&&modal!=='pause')pause();});
$('#overlay').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const focusables=[...$('#dialog').querySelectorAll('button:not(:disabled),a[href],input,select')];if(!focusables.length)return;const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
const joy=$('#joystick');let joyId;
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);});joy.addEventListener('pointermove',e=>{if(e.pointerId!==joyId)return;const r=joy.getBoundingClientRect(),radius=r.width*.4,travel=r.width*.25;stick.x=clamp((e.clientX-r.left-r.width/2)/radius,-1,1);stick.y=clamp((e.clientY-r.top-r.height/2)/radius,-1,1);joy.firstElementChild.style.transform=`translate(${stick.x*travel}px,${stick.y*travel}px)`;});
function releaseJoy(){joyId=null;stick={x:0,y:0};joy.firstElementChild.style.transform='';}joy.addEventListener('pointerup',e=>{if(e.pointerId===joyId)releaseJoy();});joy.addEventListener('pointercancel',e=>{if(e.pointerId===joyId)releaseJoy();});
// Multi-touch: every finger drives its own button independently, so holding
// the joystick (or fire) never blocks jump, reload, aim, shop or C4.
// Momentary buttons fire on pointerdown and ignore extra concurrent touches
// (no double toggle from two fingers); hold buttons track all pointers.
function capturePress(el,e){e.preventDefault();try{el.setPointerCapture(e.pointerId);}catch{}}
function tapButton(el,action){
  let active=null;
  el.addEventListener('pointerdown',e=>{capturePress(el,e);if(active!==null)return;active=e.pointerId;action();});
  const clear=e=>{if(!e||e.pointerId===active)active=null;};
  el.addEventListener('pointerup',clear);el.addEventListener('pointercancel',clear);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
function holdButton(el,on,off){
  const held=new Set();
  el.addEventListener('pointerdown',e=>{capturePress(el,e);held.add(e.pointerId);if(held.size===1)on();});
  const release=e=>{if(e&&e.pointerId!==undefined)held.delete(e.pointerId);else held.clear();if(!held.size)off();};
  el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
$('#touch-controls').addEventListener('contextmenu',e=>e.preventDefault());
function toggleAim(){
  if(state!=='playing'||paused||modal||player.hp<=0||reload>0||mpReloadT>0||(!mpMode&&phase!=='fight'))return;
  aiming=!aiming;updateHUD();
}
tapButton($('#touch-aim'),toggleAim);
const useButton=$('#touch-use');
holdButton(useButton,()=>{touchUse=true;},()=>{touchUse=false;});
holdButton($('#touch-fire'),()=>{touchFire=true;shoot();},()=>{touchFire=false;});
tapButton($('#touch-jump'),()=>requestJump());
tapButton($('#touch-reload'),()=>reloadWeapon());
// Мережевий бій на сенсорі: клавіш 1–7 нема, тож зброя міняється кнопкою ⇄
// (той самий набір, що й на цифрах). Перезаряджання в мережі автоматичне,
// тому в mpMode кнопка R ховається й поступається місцем ⇄.
const MP_TOUCH_GUNS=['pistol','smg','rifle','shotgun','kalash','marksman','sniper'];
tapButton($('#touch-weapon'),()=>{
  if(!mpMode||!player||player.hp<=0)return;
  const next=MP_TOUCH_GUNS[(MP_TOUCH_GUNS.indexOf(player.weapon)+1+MP_TOUCH_GUNS.length)%MP_TOUCH_GUNS.length];
  mpSwitchWeapon(next);toast(WEAPONS[player.weapon].name);
});
tapButton($('#touch-shop'),()=>modal==='shop'?closeDialog():openShop());
canvas.style.touchAction='none';canvas.addEventListener('touchstart',e=>{if(paused||modal)return;const t=e.changedTouches[0];lookTouch={id:t.identifier,x:t.clientX,y:t.clientY};},{passive:true});canvas.addEventListener('touchmove',e=>{if(!lookTouch||paused||modal||player.hp<=0)return;const t=[...e.changedTouches].find(t=>t.identifier===lookTouch.id);if(!t)return;player.angle+=(t.clientX-lookTouch.x)*.004*settings.sensitivity*(aiming?.5:1);pitch=clamp(pitch-(t.clientY-lookTouch.y)*.003*settings.sensitivity*(aiming?.5:1),-.45,.45);lookTouch.x=t.clientX;lookTouch.y=t.clientY;e.preventDefault();},{passive:false});canvas.addEventListener('touchend',()=>lookTouch=null);canvas.addEventListener('touchcancel',()=>lookTouch=null);

// ---------- Мультиплеєр: лобі, кімнати, синхронізація ----------
function mpMe(){return mpRoom&&mpMyId?mpRoom.players.find(p=>p.id===mpMyId):null;}
function mpMyAmmo(){const me=mpMe();return me?me.ammo:0;}
function mpSetStatus(t){const e=$('#mp-status');if(e)e.textContent=t;}
function mpSetConnectionStatus(t,connected=false){const e=$('#connection-status');if(!e)return;e.textContent=t;e.classList.toggle('connected',connected);}
function mpSetup(){
  if(!mpWired){
    mpWired=true;
    $('#mp-room-map').innerHTML=MAPS.map((m,i)=>`<option value="${i}">${m.name}</option>`).join('');
    $('#mp-nick').value=settings.mpNick||'';$('#mp-server').value=String(settings.mpServer||SERVER_URL||'').trim();
    if(!$('#mp-transport').value)$('#mp-transport').value='server';
    // Усі кімнати — приватні за кодом, як у balloon-catcher. Публічний список
    // лишається лише для тих, хто явно обере «Публічна».
    if($('#mp-room-visibility')&&!$('#mp-room-visibility').value)$('#mp-room-visibility').value='private';
    $('#mp-connect').onclick=()=>mpConnect();
    $('#mp-server').onchange=()=>{settings.mpServer=$('#mp-server').value.trim();save();mpWarmUp();};
    $('#mp-transport').onchange=()=>{mpManualOff=false;mpDisconnect(true);mpTransportChanged();};
    $('#mp-disconnect').onclick=()=>{mpManualOff=true;mpDisconnect();};
    $('#mp-refresh').onclick=()=>mpServerAction({t:C2S.LIST});
    $('#mp-create').onclick=()=>{
      settings.mpNick=$('#mp-nick').value;save();
      const options={t:C2S.CREATE,name:$('#mp-room-name').value,isPublic:$('#mp-room-visibility').value==='public',mapId:Number($('#mp-room-map').value),maxPlayers:Number($('#mp-room-max').value)};
      if(mpUsesCode())mpCodeAction(null,options);
      else mpServerAction(options);
    };
    $('#mp-join-btn').onclick=()=>{
      if(mpUsesCode()){
        const code=normalizeRoomCode($('#mp-join-code').value);
        if(!validRoomCode(code))return toast('Введи код кімнати з 4 символів');
        mpCodeAction(code);return;
      }
      // Код кімнати як у balloon-catcher: 4 символи, малі літери й схожі українські приймаємо.
      const code=normalizeRoomCode($('#mp-join-code').value);
      if(!validRoomCode(code))return toast('Введи код кімнати з 4 символів');
      mpServerAction({t:C2S.JOIN_CODE,code});
    };
    $('#mp-join-code').addEventListener('keydown',e=>{if(e.key==='Enter')$('#mp-join-btn').onclick();});
    $('#mp-copy-code').onclick=()=>mpCopy('mp-short-code');
    $('#mp-copy-link').onclick=()=>mpCopyInvite();
    $('#mp-ready').onclick=()=>{if(mpClient&&mpRoom){const me=mpMe();mpClient.send({t:C2S.READY,ready:!(me&&me.ready)});}};
    $('#mp-start').onclick=()=>{if(mpClient&&mpRoom)mpClient.send({t:C2S.START});};
    $('#mp-leave').onclick=()=>{if(mpClient?.kind==='peer'){mpDisconnect();return;}if(mpClient)mpClient.send({t:C2S.LEAVE});mpRoom=null;mpShowHome();};
    const sendChat=()=>{const inp=$('#mp-chat-input'),text=inp.value.trim();if(text&&mpClient&&mpRoom){mpClient.send({t:C2S.CHAT,text});inp.value='';}};
    $('#mp-chat-send').onclick=sendChat;
    $('#mp-chat-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();e.stopPropagation();});
    // Тримаємо підключення до сервера постійно: якщо зв'язку нема і гравець його
    // не вимикав вручну — мовчки пробуємо знову кожні 5 секунд.
    if(!mpEnsureTimer)mpEnsureTimer=setInterval(()=>{
      if(mpManualOff||mpUsesPeer()||mpRoom||mpMode)return;
      if(mpClient&&(mpClient.connected||mpClient.connecting))return;
      // Адреси нема (статичний хостинг без сервера) — раз на 30 с перевіряємо
      // ws.json: господар міг підняти сервер уже після відкриття сторінки.
      if(!defaultMpUrl($('#mp-server').value)){
        const now=Date.now();
        if(now-mpSharedAt>30000){mpSharedAt=now;findSharedServer().then(url=>{if(url&&!mpClient?.connected&&!mpManualOff){$('#mp-server').value=url;settings.mpServer=url;save();mpConnect(null,true);}});}
        return;
      }
      mpConnect(null,true);
    },5000);
    mpWarmUp();
  }
}
function mpTabOpened(){
  mpSetup();
  mpTransportChanged();
  if(mpRoom)mpShowRoom();else mpShowHome();
  if(mpClient&&mpClient.connected&&!mpRoom&&mpClient.kind!=='peer')mpClient.send({t:C2S.LIST});
  else if(!mpUsesPeer()&&!mpManualOff&&!mpRoom&&!mpMode&&(!mpClient||!mpClient.connecting))mpConnect(null,true);
}
function mpUsesPeer(){return $('#mp-transport').value!=='server';}
function mpUsesCode(){return $('#mp-transport').value==='code';}
function mpTransportChanged(){
  const peer=mpUsesPeer(),code=mpUsesCode();
  // Адреса завжди видима: вона потрібна і онлайн-режиму, і сервісу коротких кодів.
  $('#mp-server-options').hidden=false;
  $('#mp-server-actions').hidden=code;
  $('#mp-room-visibility').hidden=peer;
  $('#mp-code-join').hidden=false;$('#mp-public').hidden=peer;
  $('#mp-join-code').maxLength=4;$('#mp-join-code').placeholder='КОД';
  if(!mpClient)mpSetStatus(peer?'СТВОРИ КІМНАТУ Й НАДІШЛИ ДРУГУ КОД':'ПІДКЛЮЧЕННЯ ПІД ЧАС СТВОРЕННЯ АБО ВХОДУ');
  mpWarmUp();
}
// Сервіс кодів підключаємо заздалегідь — одразу при відкритті вкладки, виборі
// режиму чи виході з кімнати. Тоді «Створити» і «Приєднатись» спрацьовують
// миттєво: з'єднання вже відкрите, чекати нема чого.
function mpWarmUp(){
  try{
    if(!mpUsesCode()||mpClient||mpRoom||mpMode){
      try{mpWarmSocket?.close?.();}catch{}
      mpWarmSocket=null;return;
    }
    const WS=globalThis.WebSocket;
    if(!WS)return;
    const url=defaultMpUrl($('#mp-server').value);
    if(!url){try{mpWarmSocket?.close?.();}catch{}mpWarmSocket=null;return;}
    if(mpWarmSocket&&(mpWarmSocket.readyState===1||mpWarmSocket.readyState===0)&&mpWarmUrl===url)return;
    try{mpWarmSocket?.close?.();}catch{}
    mpWarmUrl=url;
    const s=new WS(url);
    mpWarmSocket=s;
    s.onclose=()=>{if(mpWarmSocket===s)mpWarmSocket=null;};
    s.onerror=()=>{if(mpWarmSocket===s)mpWarmSocket=null;try{s.close();}catch{}};
  }catch{}
}
function mpTakeWarm(url){
  const s=mpWarmSocket;mpWarmSocket=null;
  if(s&&mpWarmUrl===url&&(s.readyState===1||s.readyState===0))return s;
  try{s?.close?.();}catch{}
  return null;
}
function mpCodeAction(code,options){
  mpDisconnect(true);settings.mpNick=$('#mp-nick').value;settings.mpServer=$('#mp-server').value;save();
  const url=defaultMpUrl(settings.mpServer);
  if(!url){const message=settings.mpServer.trim()?'Невірна адреса сервера. Приклад для локальної гри: http://localhost:4173.':'Для коротких кодів потрібен сервіс кімнат. Запусти npm start і відкрий http://localhost:4173 або вкажи адресу запущеного сервера.';$('#mp-code-status').textContent=message;toast(message);return;}
  mpClient=createPeerCodeClient(url,mpHandlers(mpEpoch),{socket:mpTakeWarm(url)});
  try{if(code)mpClient.join(code,settings.mpNick);else mpClient.host(options,settings.mpNick);}
  catch(error){mpDisconnect(true);$('#mp-code-status').textContent=error.message;toast(error.message);}
}
function mpServerAction(action){
  if(mpClient?.connected&&mpMyId&&mpClient.kind!=='peer')mpClient.send(action);
  else mpConnect(action);
}
function mpHandlers(epoch,action=null,automatic=false){
  const active=fn=>(...args)=>{if(epoch===mpEpoch)fn(...args);};
  return {
    onStatus:active(message=>{$('#mp-code-status').textContent=message;mpSetStatus(message);}),
    onCode:active(code=>{$('#mp-short-code').value=code;$('#mp-short-code-panel').hidden=!code;if(code)$('#mp-code-status').textContent='Код готовий. Скопіюй і надішли другу.';}),
    onOpen:active(()=>mpClient.send({t:C2S.HELLO,nick:settings.mpNick})),
    onWelcome:active(msg=>{
      mpMyId=msg.id;mpRooms=msg.rooms||[];mpRenderRooms();
      mpSetStatus(mpClient.kind==='peer'?'КІМНАТА НАПРЯМУ З ДРУЗЯМИ':`НА ЗВʼЯЗКУ · ${mpRooms.length} КІМНАТ`);
      mpSetConnectionStatus(mpClient.kind==='peer'?'НАПРЯМУ З ДРУЗЯМИ':'ОНЛАЙН · СЕРВЕР ПІДКЛЮЧЕНО',true);
      if(mpClient.kind!=='peer'){
        $('#mp-disconnect').hidden=false;
        mpListTimer=setInterval(()=>{if(mpClient?.connected&&!mpRoom&&!mpMode&&!$('#tab-mp').hidden)mpClient.send({t:C2S.LIST});},3000);
        if(action)mpClient.send(action);
      }
    }),
    onRooms:active(rooms=>{mpRooms=rooms;if(!mpRoom&&!mpMode){mpRenderRooms();mpSetStatus(`НА ЗВʼЯЗКУ · ${rooms.length} КІМНАТ`);}}),
    onJoined:active(room=>{mpRoom=room;mpChat=[];mpLastJoin={code:room.code};mpReconnectTries=0;mpShowRoom();}),
    onRoom:active(room=>{mpRoom=room;if(!mpMode)mpShowRoom();}),
    onMatchStart:active(room=>mpStartMatch(room)),
    onSnapshot:active(snap=>{if(mpMode)mpApplySnapshot(snap);}),
    onEvents:active(events=>{if(mpRoom||mpMode)mpHandleEvents(events);}),
    onMatchEnd:active(room=>{mpRoom=room;mpShowResult({winner:room.winner,score:room.score});}),
    onError:active(message=>{
      if(!automatic)toast(message);
      if(mpUsesCode()||mpClient?.kind==='peer')$('#mp-code-status').textContent=message;
      if(mpClient?.kind==='peer'){mpSetStatus(message);}
      else{mpSetStatus(message);mpSetConnectionStatus('СЕРВЕР НЕДОСТУПНИЙ');}
    }),
    onClose:active(message=>{
      const peer=mpClient?.kind==='peer';
      const join=mpLastJoin;
      mpDisconnect();
      const reason=message||(peer?'Зв’язок із власником кімнати втрачено. Попроси нове запрошення':'З’єднання з сервером втрачено');
      mpSetConnectionStatus(peer?'ЗВʼЯЗОК ІЗ ГРАВЦЕМ ВТРАЧЕНО':'СЕРВЕР НЕДОСТУПНИЙ');
      if(!automatic)toast(reason);
      if(peer)$('#mp-code-status').textContent=reason;
      // Обрив як у balloon-catcher: кімната на сервері живе, поки в ній є хоч хтось,
      // тож повертаємось у ту саму гру кілька разів, перш ніж відпустити в меню.
      if(!peer&&join?.code&&epoch===mpEpoch)mpReconnect(join.code);
    })
  };
}
// Повернення в кімнату після обриву: до 10 спроб із ростом паузи (~40 с разом).
// Сервер ще трохи тримає старе місце, тож перші спроби можуть бачити «кімната повна».
async function mpReconnect(code){
  for(let i=1;i<=10;i++){
    mpSetStatus(`Зв'язок обірвався. Повертаємось у кімнату ${code}… (${i}/10)`);
    await new Promise(r=>setTimeout(r,Math.min(1200*i,5000)));
    if(mpRoom||mpMode||!mpLastJoin||mpLastJoin.code!==code)return;
    if(state!=='lobby'&&!mpMode)return;
    mpReconnectTries=i;
    mpConnect({t:C2S.JOIN_CODE,code},true);
    await new Promise(r=>setTimeout(r,1500));
    if(mpRoom&&mpRoom.code===code)return;
  }
  mpLastJoin=null;
  mpSetStatus('Кімната '+code+' не відповідає');
}
async function mpCopyInvite(){
  const code=mpRoom?.code||normalizeRoomCode($('#mp-join-code').value);
  if(!validRoomCode(code||''))return toast('Введи код кімнати з 4 символів');
  const link=inviteLink(code,mpClient?.url||$('#mp-server').value);
  try{
    await navigator.clipboard.writeText(link);
    const btn=$('#mp-copy-link');
    if(btn){btn.textContent='Скопійовано ✓';setTimeout(()=>{btn.textContent='КОПІЮВАТИ ПОСИЛАННЯ';},1600);}
    toast('Посилання скопійовано — надішли другу');
  }catch{
    // Без HTTPS navigator.clipboard недоступний (типово на мобілці через http):
    // показуємо посилання текстом, щоб його можна було затиснути й скопіювати.
    const st=$('#mp-code-status');if(st)st.textContent=link;
    toast('Не вдалося скопіювати автоматично — затисни посилання вище');
  }
}
// Запрошення ?room=КОД (&ws=адреса) як у balloon-catcher: відкриває вкладку
// мультиплеєра і заходить само. Викликається один раз при старті.
async function mpCheckInvite(){
  if(mpInviteChecked)return;mpInviteChecked=true;
  let q;
  try{q=new URLSearchParams(location.search);}catch{return;}
  const fromQuery=serverUrlFromQuery();
  if(fromQuery){setSharedServerUrl(fromQuery);settings.mpServer=fromQuery;save();const inp=$('#mp-server');if(inp)inp.value=fromQuery;}
  else{
    // Статична збірка без сервера ховає онлайн (клас no-online), ws.json його повертає.
    try{
      if(location.hostname?.endsWith('.github.io')&&!String(SERVER_URL||'').trim()&&!q.get('ws'))document.body?.classList?.add('no-online');
    }catch{}
    await findSharedServer();
    const sharedNow=defaultMpUrl($('#mp-server')?.value);
    if(sharedNow&&$('#mp-server')&&!$('#mp-server').value){$('#mp-server').value=sharedNow;settings.mpServer=sharedNow;save();}
  }
  try{document.body?.classList?.toggle('no-online',!defaultMpUrl($('#mp-server')?.value));}catch{}
  const invite=normalizeRoomCode(q.get('room'));
  if(!invite||!validRoomCode(invite))return;
  if(mpUsesPeer()){const t=$('#mp-transport');if(t){t.value='server';mpTransportChanged();}}
  tab('mp');
  const inp=$('#mp-join-code');if(inp)inp.value=invite;
  mpLastJoin={code:invite};
  mpConnect({t:C2S.JOIN_CODE,code:invite});
}
function mpConnect(action=null,automatic=false){
  mpManualOff=false;
  mpDisconnect(true);
  settings.mpNick=$('#mp-nick').value;settings.mpServer=$('#mp-server').value;save();
  if(action?.t===C2S.JOIN_CODE&&validRoomCode(action.code||''))mpLastJoin={code:normalizeRoomCode(action.code)};
  const url=defaultMpUrl(settings.mpServer);
  if(!url){mpSetStatus('ВКАЖИ АДРЕСУ ІГРОВОГО СЕРВЕРА');mpSetConnectionStatus('СЕРВЕР НЕ НАЛАШТОВАНО');if(!automatic)toast('Для гри без ігрового сервера вибери «Напряму з друзями»');return;}
  mpSetStatus('ПІДКЛЮЧЕННЯ…');mpSetConnectionStatus('ПІДКЛЮЧЕННЯ ДО СЕРВЕРА…');
  mpClient=createMpClient(url,mpHandlers(mpEpoch,action,automatic));
  if(!mpClient){mpSetStatus('НЕ ВДАЛОСЯ ПІДКЛЮЧИТИСЯ');mpSetConnectionStatus('СЕРВЕР НЕДОСТУПНИЙ');}
}
function mpAutoConnect(){
  mpSetup();
  if(mpUsesPeer())return;
  const shared=String(settings.mpServer||SERVER_URL||'').trim();
  if(shared){settings.mpServer=shared;$('#mp-server').value=shared;save();}
  if(!defaultMpUrl($('#mp-server').value)){
    mpSetStatus('СЕРВЕР КІМНАТ ЗАРАЗ НЕ ПІДКЛЮЧЕНИЙ. З БОТАМИ МОЖНА ГРАТИ ОДРАЗУ.');
    mpSetConnectionStatus('СЕРВЕР НЕ НАЛАШТОВАНО');
    try{document.body?.classList?.add('no-online');}catch{}
    // Статичний сайт може знайти сервер пізніше через ws.json — тоді кімнати з'являться самі.
    findSharedServer().then(url=>{
      if(!url||mpManualOff||mpClient||mpRoom||mpMode||$('#mp-server').value.trim())return;
      $('#mp-server').value=url;settings.mpServer=url;save();
      if(mpUsesCode())mpWarmUp();else mpConnect(null,true);
    });
    return;
  }
  mpConnect(null,true);
}
function mpDisconnect(silent=false){
  const wasInMatch=state!=='lobby'&&(mpMode||mpRoom);
  mpEpoch++;
  clearTimeout(mpReconnectTimer);mpReconnectTimer=0;
  if(!silent)mpLastJoin=null;
  clearInterval(mpListTimer);mpListTimer=0;
  const old=mpClient;mpClient=null;if(old){try{old.close();}catch{}}
  mpRoom=null;mpMyId=null;mpMode=false;mpRemotes=new Map();mpReloadT=0;mpResultShown=false;mpRooms=[];
  $('#mp-disconnect').hidden=true;
  $('#mp-short-code-panel').hidden=true;
  $('#mp-short-code').value='';$('#mp-code-status').textContent='';
  if(!silent&&wasInMatch){
    state='lobby';paused=false;modal='';release();
    $('#overlay').hidden=true;canvas.hidden=true;$('#hud').hidden=true;$('#lobby').hidden=false;
    tab('mp');
  }
  if(state==='lobby')mpShowHome();
  mpTransportChanged();
}
async function mpCopy(id){
  const field=$('#'+id);if(!field.value)return;
  try{await navigator.clipboard.writeText(field.value);toast('Скопійовано — надішли другу');}
  catch{field.focus();field.select();toast('Текст виділено. Натисни Ctrl+C та надішли другу');}
}
function mpShowHome(){
  $('#mp-home').hidden=false;$('#mp-room').hidden=true;
  mpRenderRooms();
}
function mpRenderRooms(){
  const box=$('#mp-rooms');if(!box)return;
  if(!mpClient||!mpClient.connected){box.innerHTML='<p style="color:var(--muted)">Створи кімнату або онови список — підключення автоматичне.</p>';return;}
  if(!mpRooms.length){box.innerHTML='<p style="color:var(--muted)">Публічних кімнат немає — створи свою або ввійди за кодом.</p>';return;}
  box.innerHTML=mpRooms.map(r=>{
    const m=MAPS[clamp(r.mapId,0,MAPS.length-1)];
    const phase=r.phase==='playing'?'БІЙ ТРИВАЄ':r.phase==='finished'?'МАТЧ ЗАВЕРШЕНО':'ЛОБІ · МОЖНА ЗАЙТИ';
    return `<div class="map-card"><div class="map-detail"><h3>${escapeText(r.name)}</h3><p>${m.name} · ${r.players}/${r.maxPlayers} · ${phase}</p><div class="map-tags"><span>${r.isPublic?'ПУБЛІЧНА':'ПРИВАТНА'}</span><button class="text-button" data-join="${escapeText(r.id)}" ${r.phase!=='lobby'||r.players>=r.maxPlayers?'disabled':''}>УВІЙТИ ↗</button></div></div></div>`;
  }).join('');
  box.querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>mpServerAction({t:C2S.JOIN,id:b.dataset.join}));
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
  // Підпис як у balloon-catcher: скільки гравців і чи чекаємо ще.
  const waiting=room.phase==='lobby'&&room.players.length<2?` · Чекаємо на друзів… Дай їм код ${room.code}`:'';
  $('#mp-room-info').textContent=`${m.name} · ${room.players.length}/${room.maxPlayers} гравців · до ${room.killTarget} фрагів · ${Math.floor(room.matchTime/60)} хв${waiting}`;
  $('#mp-room-code').textContent=mpClient?.kind==='peer'?'НАПРЯМУ · ВХІД ЗА КОРОТКИМ КОДОМ':room.isPublic?`ПУБЛІЧНА · КОД ДЛЯ ДРУЗІВ: ${room.code}`:`КОД ДЛЯ ДРУЗІВ: ${room.code}`;
  const copyLink=$('#mp-copy-link');if(copyLink)copyLink.hidden=mpClient?.kind==='peer';
  $('#mp-players').innerHTML=room.players.map(p=>`<div><kbd style="border-color:${p.team===0?'#c3f66b':'#e49a62'};color:${p.team===0?'#c3f66b':'#e49a62'}">${p.team===0?'CT':'T'}</kbd>${escapeText(p.nick)}${p.id===mpMyId?' (ТИ)':''}${p.id===room.hostId?' ★':''}<span style="margin-left:auto">${room.phase!=='lobby'?'':p.ready?'✓ ГОТОВИЙ':'· ЧЕКАЄ'}</span></div>`).join('');
  $('#mp-ready').textContent=me&&me.ready?'НЕ ГОТОВИЙ ✕':'ГОТОВИЙ ✓';
  const startBtn=$('#mp-start');
  startBtn.hidden=room.hostId!==mpMyId;
  startBtn.disabled=!canStart(room,mpMyId);
  startBtn.innerHTML=room.phase==='finished'?'РЕВАНШ <span>→</span>':'РОЗПОЧАТИ <span>→</span>';
  mpRenderChat();
}
function mpRenderChat(){
  const box=$('#mp-chat');if(!box)return;
  box.innerHTML=mpChat.map(c=>`<div><b>${escapeText(c.nick)}</b> &nbsp; ━ &nbsp; <em>${escapeText(c.text)}</em></div>`).join('');
}
function mpStartMatch(room){
  initAudio();
  mpRoom=room;mpResultShown=false;kills=0;deaths=0;feed=[];mpChat=[];
  map=MAPS[clamp(room.mapId,0,MAPS.length-1)];
  wallTextures=textures(map);
  const me=room.players.find(p=>p.id===mpMyId);
  player=actor(me.x,me.y,me.team,me.nick);player.isPlayer=true;player.hp=me.hp;player.angle=me.angle;
  mpRemotes=new Map();mpReloadT=0;mpSendTimer=0;
  for(const p of room.players){
    if(p.id===mpMyId)continue;
    mpRemotes.set(p.id,{mpId:p.id,isRemote:true,x:p.x,y:p.y,tx:p.x,ty:p.y,angle:p.angle,tAngle:p.angle,team:p.team,name:p.nick,hp:p.hp,z:p.z??floorHeight(map,p.x,p.y),tz:p.z??floorHeight(map,p.x,p.y),grounded:false,armor:0,moving:false,flash:0,weapon:p.weapon,lastFlash:p.flashAt||0,pendingFlash:false});
  }
  actors=[player,...mpRemotes.values()];
  state='playing';phase='mp';paused=false;modal='';mpMode=true;
  pitch=0;aiming=false;shootHeld=false;touchFire=false;nextShot=0;reload=0;reloadTotal=0;reloadStage=0;recoil=0;hitTime=0;hurtTime=0;keys.clear();
  resetActorHeight(map,player);resetGunMotion();
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
    if(me.alive&&!wasAlive){player.x=me.x;player.y=me.y;player.angle=me.angle;pitch=0;resetActorHeight(map,player);resetGunMotion();$('#game-message').textContent='';}
    if(!me.alive)$('#game-message').textContent=`ЗАГИБЛИК · ВІДРОДЖЕННЯ ЧЕРЕЗ ${Math.max(1,Math.ceil(me.respawnIn))}`;
  }
  const seen=new Set();
  for(const p of snap.players){
    if(p.id===mpMyId)continue;
    seen.add(p.id);
    let a=mpRemotes.get(p.id);
    if(!a){a={mpId:p.id,isRemote:true,x:p.x,y:p.y,tx:p.x,ty:p.y,angle:p.angle,tAngle:p.angle,team:p.team,name:p.nick,hp:100,z:p.z??floorHeight(map,p.x,p.y),tz:p.z??floorHeight(map,p.x,p.y),grounded:false,armor:0,moving:false,flash:0,weapon:'pistol',lastFlash:p.flashAt||0,pendingFlash:false};mpRemotes.set(p.id,a);}
    a.tx=p.x;a.ty=p.y;a.tz=p.z??floorHeight(map,p.x,p.y);a.tAngle=p.angle;a.team=p.team;a.name=p.nick;a.hp=p.hp;a.moving=p.moving;a.weapon=p.weapon;
    if((p.flashAt||0)>a.lastFlash){a.lastFlash=p.flashAt;a.pendingFlash=true;}
  }
  for(const id of [...mpRemotes.keys()])if(!seen.has(id))mpRemotes.delete(id);
  actors=[player,...mpRemotes.values()];
  // Snapshots echo older local coordinates. Remote interpolation can overlap us;
  // let stepActor block/allow separation instead of rewinding to that stale echo.
  // Only respawning above should replace the local player's position.
  updateHUD();
}
function mpHandleEvents(events){
  for(const e of events){
    if(e.t==='kill'){
      feed.unshift({source:e.sourceNick,target:e.targetNick,t:6});feed=feed.slice(0,4);paintFeed();sound('hit');
      if(e.source===mpMyId)kills++;if(e.target===mpMyId)deaths++;
    }else if(e.t==='reload'){
      if(e.id===mpMyId){mpReloadT=(WEAPONS[player.weapon]||WEAPONS.pistol).reload;aiming=false;}
    }else if(e.t==='chat'){
      mpChat.push(e);mpChat=mpChat.slice(-30);mpRenderChat();
    }else if(e.t==='finish'){
      mpShowResult({winner:e.winner,score:e.score||[0,0]});
    }
  }
  updateHUD();
}
function mpUpdate(dt){
  mpReloadT=Math.max(0,mpReloadT-dt);
  updatePlayer(dt);updateGunMotion(dt);
  const me=mpMe();
  if(me&&me.alive&&player.hp>0&&mpClient){
    mpSendTimer-=dt;
    if(mpSendTimer<=0){mpSendTimer=1/MP.TICK_HZ;mpClient.send({t:C2S.STATE,x:+player.x.toFixed(2),y:+player.y.toFixed(2),angle:+player.angle.toFixed(3),moving:player.moving,weapon:player.weapon});}
  }
  if(shootHeld||touchFire){if((WEAPONS[player.weapon]||{}).automatic)shoot();}
  for(const a of mpRemotes.values()){
    a.x+=(a.tx-a.x)*Math.min(1,dt*12);a.y+=(a.ty-a.y)*Math.min(1,dt*12);a.angle=a.tAngle;a.z+=(a.tz-a.z)*Math.min(1,dt*12);
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

mpAutoConnect();
mpCheckInvite();

// Explicitly enabled only by the local browser verification harness.
if(new URLSearchParams(location.search).has('test'))window.__sector={start,beginFight,beginCountdown,shoot,purchase:id=>purchase(player,id),reload:reloadWeapon,reloadProgress,step:dt=>{update(dt);updateHUD();render();},setClock:n=>clock=n,setPitch:v=>pitch=v,setPaused:v=>paused=v,setPlayer:p=>Object.assign(player,p),get:()=>({bomb,state,phase,paused,modal,round,score,kills,deaths,clock,fightIn,touchFire,reload,reloadTotal,reloadStage,player,actors,gunMotion,aiming,aimProgress:aimProgress(),fov:viewFov(),map:map.id}),endRound,endMatch,leave,openShop};
