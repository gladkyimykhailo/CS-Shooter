import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Executes the real game and UI handlers without a browser. Only DOM/canvas APIs
// are substituted; combat, movement, economy, timers and bot AI are unmodified.
function fixture(saved={},browser={},serverUrl=''){
  const listeners={},storage=new Map([['sector-settings',JSON.stringify(saved)]]);let drawCalls=0;
  const canvasContext=new Proxy({}, {get:(obj,key)=>key in obj?obj[key]:key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{drawCalls++;}});
  class Element{
    constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs=attrs;this.id=attrs.id;this.type=attrs.type||'';this.dataset={};for(const [k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;this.children=[];this.style={};this.hidden='hidden'in attrs;this.checked='checked'in attrs;this.disabled='disabled'in attrs;this.value=attrs.value||'';this.width=Number(attrs.width)||320;this.height=Number(attrs.height)||200;this.events={};this.classList={toggle:(name,value)=>{const classes=new Set((this.attrs.class||'').split(' '));if(value)classes.add(name);else classes.delete(name);this.attrs.class=[...classes].join(' ');}};}
    set innerHTML(html){this.children=parse(html);this.html=html;}
    get innerHTML(){return this.html||'';}
    get firstElementChild(){return this.children[0];}
    addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
    focus(){document.activeElement=this;}
    getContext(){return canvasContext;}
    getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
    setPointerCapture(){}
    requestPointerLock(){document.pointerLockElement=this;return Promise.resolve();}
    matches(s){if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return (this.attrs.class||'').split(' ').includes(s.slice(1));if(s.startsWith('['))return s.slice(1,-1).split('=')[0]in this.attrs;return this.tagName.toLowerCase()===s;}
    querySelectorAll(s){const found=[];function scan(e){for(const c of e.children){if(c.matches(s))found.push(c);scan(c);}}scan(this);return found;}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
  }
  function parse(html){const root=new Element(),stack=[root],voids=new Set(['meta','link','input','br','img','hr']);const tags=html.matchAll(/<\/?([\w-]+)\b([^>]*?)>/g);for(const match of tags){const tag=match[1].toLowerCase();if(match[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}const attrs={};for(const m of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[m[1]]=m[2]??'';const el=new Element(tag,attrs);stack.at(-1).children.push(el);if(!voids.has(tag)&&!match[0].endsWith('/>'))stack.push(el);}return root.children;}
  const document=new Element('document');document.innerHTML=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');document.createElement=tag=>new Element(tag);document.exitPointerLock=()=>document.pointerLockElement=null;document.hidden=false;
  const sandbox={document,console,URL,URLSearchParams,location:{search:'?test=1'},innerWidth:320,innerHeight:200,performance:{now:()=>0},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},requestAnimationFrame(fn){sandbox.frame=fn;},addEventListener(name,fn){(listeners[name]??=[]).push(fn);}};
  Object.assign(sandbox,browser);sandbox.window=sandbox;const context=vm.createContext(sandbox);
  const source=['config.js','core.js','art.js','net.js','peer.js','game.js','mp.js'].map(f=>readFileSync(new URL(`../public/${f}`,import.meta.url),'utf8').replace(/^import .+?;\s*$/gm,'').replace(/^export /gm,'')).join('\n').replace("const SERVER_URL = '';",`const SERVER_URL = ${JSON.stringify(serverUrl)};`);
  vm.runInContext(source,context,{timeout:10000});
  const key=(code,type='keydown')=>{for(const fn of listeners[type]||[])fn({code,repeat:false,preventDefault(){}});};
  const mouse=(button,type='mousedown')=>{const handlers=type==='mousedown'?document.querySelector('#game').events[type]:listeners[type];for(const fn of handlers||[])fn({button});};
  return {game:sandbox.__sector,document,key,mouse,storage,drawCalls:()=>drawCalls,frame:sandbox.frame,tick:dt=>vm.runInContext(`update(${Number(dt)})`,context)};
}

test('ПКМ вирівнює приціл, прибирає хрестик і повертає стрільбу від стегна після відпускання',()=>{
  for(const id of ['pistol','smg','rifle','shotgun','kalash']){
    const f=fixture();f.game.start();if(id!=='pistol')f.game.purchase(id);f.game.beginFight();
    f.game.setPlayer({x:2.5,y:3.5,angle:Math.PI/2});
    f.game.get().actors.forEach(a=>a.cooldown=999);
    f.mouse(2);f.game.step(.03);
    assert.equal(f.game.get().aiming,true);
    assert.ok(f.game.get().fov<.78&&f.game.get().fov>.5,'zoom follows the transition');
    for(let i=0;i<90;i++)f.tick(1/60);
    f.game.step(.001);
    assert.ok(f.game.get().aimProgress>.999);
    assert.equal(f.document.querySelector('#crosshair').hidden,true);
    const enemy=f.game.get().actors.find(a=>a.team===1);
    Object.assign(enemy,{x:2.5,y:6.5,hp:100,armor:0});
    f.game.shoot();assert.ok(enemy.hp<100,`${id}: target under the sight is hit`);
    f.mouse(2,'mouseup');f.game.step(.7);
    assert.equal(f.game.get().aiming,false);
    assert.equal(f.document.querySelector('#crosshair').hidden,false);
    assert.ok(Math.abs(f.game.get().fov-.78)<.001);
  }
});

test('прицілювання працює без анімацій; перезаряджання й смерть не дозволяють підняти приціл',()=>{
  const f=fixture({motion:false});f.game.start();f.game.beginFight();
  f.mouse(2);f.game.step(.016);
  assert.equal(f.game.get().aimProgress,1);
  assert.equal(f.document.querySelector('#crosshair').hidden,true);
  f.game.shoot();f.game.reload();f.mouse(2);f.game.step(.016);
  assert.equal(f.game.get().aiming,false);
  assert.equal(f.game.get().aimProgress,0);
  f.game.step(1.5);f.game.setPlayer({hp:0});f.mouse(2);f.game.step(.016);
  assert.equal(f.game.get().aimProgress,0);
});

test('меню запускає гру, закупівля має категорії та купує зброю й броню',()=>{
  const f=fixture();assert.equal(f.document.querySelectorAll('.map-card').length,9);assert.match(f.document.querySelector('#map-cards').innerHTML,/A \/ B · ТОЧКИ/);assert.match(f.document.querySelector('#map-cards').innerHTML,/MID · КРИНИЦЯ/);f.document.querySelector('#start').onclick();assert.equal(f.game.get().phase,'buy');assert.equal(f.game.get().actors.length,6);assert.equal(f.document.querySelectorAll('[data-category]').length,7);
  f.document.querySelectorAll('[data-category]').find(b=>b.dataset.category==='sniper').onclick();assert.equal(f.document.querySelectorAll('[data-buy]').length,2);assert.ok(f.document.querySelectorAll('[data-buy]').some(b=>b.dataset.buy==='marksman'));
  f.document.querySelectorAll('[data-category]').find(b=>b.dataset.category==='smg').onclick();f.document.querySelectorAll('[data-buy]').find(b=>b.dataset.buy==='smg').onclick();f.document.querySelectorAll('[data-category]').find(b=>b.dataset.category==='gear').onclick();f.document.querySelectorAll('[data-buy]').find(b=>b.dataset.buy==='armor').onclick();assert.equal(f.game.get().player.money,650);assert.equal(f.game.get().player.armor,50);
  f.document.querySelector('#shop-ready').onclick();assert.equal(f.game.get().phase,'fight');assert.equal(f.game.get().modal,'');f.game.openShop();assert.equal(f.game.get().modal,'');f.game.step(.016);assert.ok(f.drawCalls()>1000,'renderer executes');
});

test('HUD показує числове здоровʼя і помітну смугу HP',()=>{
  const f=fixture();f.game.start();f.game.setPlayer({hp:37,armor:12});f.game.step(.001);
  assert.equal(Number(f.document.querySelector('#health').textContent),37);
  assert.equal(f.document.querySelector('#health-bar').style.width,'37%');
  assert.match(f.document.querySelector('#health-bar').attrs.class,/warning/);
  f.game.setPlayer({hp:18});f.game.step(.001);
  assert.equal(f.document.querySelector('#health-bar').style.width,'18%');
  assert.match(f.document.querySelector('#health-bar').attrs.class,/critical/);
});

test('снайперські гвинтівки купуються, звужують поле зору та стріляють через оптику',()=>{
  for(const id of ['marksman','sniper']){
    const f=fixture();f.game.start();f.game.setPlayer({money:5000});f.game.purchase(id);f.game.beginFight();
    assert.equal(f.game.get().player.weapon,id);f.mouse(2);for(let i=0;i<90;i++)f.tick(1/60);f.game.step(.001);
    assert.ok(f.game.get().fov<=(id==='sniper' ? .251 : .381),`${id}: scope zooms farther than iron sights`);
    const enemy=f.game.get().actors.find(a=>a.team===1);Object.assign(enemy,{x:2.5,y:6.5,hp:100,armor:0,cooldown:999});f.game.setPlayer({x:2.5,y:3.5,angle:Math.PI/2});f.game.shoot();assert.ok(enemy.hp<100,`${id}: scope shot reaches target`);
  }
});

test('рух, постріли, стіни та перезаряджання працюють у реальному ігровому циклі',()=>{
  const f=fixture();f.game.start();f.game.beginFight();f.game.setPlayer({x:2.5,y:3.5,angle:Math.PI/2});const p=f.game.get().player;
  f.key('KeyW');f.game.step(.04);f.key('KeyW','keyup');assert.ok(p.y>3.5);
  const enemies=f.game.get().actors.filter(a=>a.team===1);enemies[0].x=2.5;enemies[0].y=6.5;enemies[0].armor=0;enemies[0].cooldown=999;f.game.shoot();assert.equal(p.inventory.pistol.ammo,11);assert.equal(enemies[0].hp,75);
  f.game.step(.31);f.game.setPlayer({x:5.5,y:4.5,angle:0});enemies[0].x=8.5;enemies[0].y=4.5;f.game.shoot();assert.equal(enemies[0].hp,75,'wall blocks shot');
  f.game.reload();f.game.step(1.5);assert.equal(p.inventory.pistol.ammo,12);assert.equal(p.inventory.pistol.reserve,34);f.key('Escape');assert.equal(f.game.get().paused,true);const y=p.y;f.key('KeyW');f.game.step(.2);assert.equal(p.y,y);f.document.querySelector('#resume').onclick();assert.equal(f.game.get().paused,false);
});

test('калаш: покупка, стрільба зі спреєм і довге перезаряджання',()=>{
  const f=fixture();f.game.start();f.game.purchase('kalash');f.game.beginFight();
  const p=f.game.get().player;
  assert.equal(p.weapon,'kalash');assert.equal(p.money,0);
  f.game.shoot();assert.equal(p.inventory.kalash.ammo,29);
  assert.ok(p.spray>0,'черга розкидає спрей');
  const s1=p.spray;f.game.step(.5);assert.ok(p.spray<s1,'спрей гасне без стрільби');
  f.game.setPlayer({inventory:{kalash:{ammo:5,reserve:90}}});
  f.game.reload();f.game.step(2.3);
  assert.equal(p.inventory.kalash.ammo,30);assert.equal(p.inventory.kalash.reserve,65);
});

test('фізика зброї працює у бою, зупиняється на паузі та скидається між раундами',()=>{
  const f=fixture();f.game.start();f.game.beginFight();
  f.game.shoot();f.game.step(.03);
  assert.ok(f.game.get().gunMotion.kick.value>0);
  const kicked=f.game.get().gunMotion.kick.value;
  f.game.setPaused(true);f.game.step(.5);
  assert.equal(f.game.get().gunMotion.kick.value,kicked);
  f.game.setPaused(false);f.game.step(1);
  assert.ok(Math.abs(f.game.get().gunMotion.kick.value)<.01);
  f.game.setPlayer({x:5.7,y:4.5,angle:0});f.game.step(.1);
  assert.ok(f.game.get().gunMotion.wall.value>0);
  f.game.endRound(0);f.game.step(3.6);
  for(const axis of Object.values(f.game.get().gunMotion))assert.equal(axis.value,0);
});

test('вимкнення руху зброї прибирає фізичні коливання без зміни стрільби',()=>{
  const f=fixture({motion:false});f.game.start();f.game.beginFight();
  f.game.shoot();f.key('KeyD');f.game.step(.04);f.key('KeyD','keyup');
  assert.equal(f.game.get().player.inventory.pistol.ammo,11);
  for(const axis of Object.values(f.game.get().gunMotion)){
    assert.equal(axis.value,0);assert.equal(axis.velocity,0);
  }
});

test('зміна зброї підіймає новий ствол, а рух у стіну не спричиняє кроків',()=>{
  const f=fixture();f.game.start();f.game.purchase('smg');f.game.beginFight();f.game.step(.02);
  f.key('Digit2');f.game.step(.02);
  assert.equal(f.game.get().player.weapon,'pistol');
  assert.ok(f.game.get().gunMotion.y.value>30);
  f.game.setPlayer({x:1.22,y:3.5,angle:Math.PI});f.key('KeyW');f.game.step(.04);
  assert.equal(f.game.get().player.moving,false);
});

test('перемога дає нагороду, наступний раунд зберігає зброю, завершення матчу має повтор',()=>{
  const f=fixture();f.game.start();f.game.purchase('smg');f.game.beginFight();const p=f.game.get().player;
  f.game.get().actors.filter(a=>a.team===1).forEach(a=>a.hp=0);f.game.step(.01);assert.equal(f.game.get().score[0],1);assert.equal(p.money,2800);assert.equal(f.game.get().phase,'intermission');f.game.step(3.6);assert.equal(f.game.get().round,2);assert.equal(p.primary,'smg');assert.equal(p.inventory.smg.ammo,30);
  for(let i=0;i<4;i++){f.game.beginFight();f.game.endRound(0);f.game.step(3.6);}assert.equal(f.game.get().phase,'finished');assert.equal(f.game.get().score[0],5);assert.ok(f.document.querySelector('#again'));f.document.querySelector('#menu').onclick();assert.equal(f.game.get().state,'lobby');
});

test('смерть прибирає основну зброю у наступному раунді, таймер магазину починає бій',()=>{
  const f=fixture();f.game.start();f.game.purchase('rifle');f.game.setPlayer({hp:0,armor:20});f.game.endRound(1);f.game.step(3.6);assert.equal(f.game.get().player.primary,null);assert.equal(f.game.get().player.armor,0);assert.equal(f.game.get().player.hp,100);f.game.setClock(.01);f.game.step(.02);assert.equal(f.game.get().phase,'fight');assert.equal(f.game.get().modal,'');
});

test('обрана мапа та вигляд зберігаються; усі мапи запускають і відмальовують бій',()=>{
  const ids=['dunes','arcade','furnace','canal','citadel','market','terminal','summit','palace'];
  for(let i=0;i<ids.length;i++){const f=fixture({map:i,skin:2,glove:1});f.game.start();f.game.beginFight();f.game.step(.016);assert.equal(f.game.get().map,ids[i]);assert.ok(f.drawCalls()>1000);}
  const f=fixture();f.document.querySelectorAll('[data-skin]')[1].onclick();const stored=JSON.parse(f.storage.get('sector-settings'));assert.equal(stored.skin,1);
});

test('кімната створюється без WebSocket, має власника та вихід назад до запрошень',()=>{
  const f=fixture();
  f.document.querySelectorAll('.nav').find(b=>b.dataset.tab==='mp').onclick();
  const mode=f.document.querySelector('#mp-transport');mode.value='peer';mode.onchange();
  assert.equal(f.document.querySelector('#tab-mp').hidden,false);
  assert.equal(f.document.querySelector('#mp-server-options').hidden,true);
  assert.equal(f.document.querySelector('#mp-peer-join').hidden,false);
  assert.equal(f.document.querySelector('#mp-room-map').children.length,9);
  f.document.querySelector('#mp-nick').value='ТАЙФУН';
  f.document.querySelector('#mp-room-name').value='З друзями';
  f.document.querySelector('#mp-create').onclick();
  assert.equal(f.document.querySelector('#mp-room').hidden,false);
  assert.equal(f.document.querySelector('#mp-home').hidden,true);
  assert.equal(f.document.querySelector('#mp-peer-host').hidden,false);
  assert.match(f.document.querySelector('#mp-room-title').textContent,/З друзями/);
  assert.match(f.document.querySelector('#mp-players').innerHTML,/ТАЙФУН/);
  assert.equal(f.document.querySelector('#mp-start').disabled,true);
  f.document.querySelector('#mp-ready').onclick();
  assert.match(f.document.querySelector('#mp-players').innerHTML,/ГОТОВИЙ/);
  assert.equal(f.document.querySelector('#mp-start').disabled,true,'one player cannot start a multiplayer match');
  f.document.querySelector('#mp-leave').onclick();
  assert.equal(f.document.querySelector('#mp-home').hidden,false);
  assert.equal(f.document.querySelector('#mp-room').hidden,true);
});

test('імена й чат кімнати показуються як текст, а не виконуваний HTML',()=>{
  const f=fixture();f.document.querySelectorAll('.nav').find(b=>b.dataset.tab==='mp').onclick();
  const mode=f.document.querySelector('#mp-transport');mode.value='peer';mode.onchange();
  f.document.querySelector('#mp-nick').value='<img src=x>';
  f.document.querySelector('#mp-create').onclick();
  assert.ok(f.document.querySelector('#mp-players').innerHTML.includes('&lt;img'));
  f.document.querySelector('#mp-chat-input').value='<img src=x onerror=alert(1)>';
  f.document.querySelector('#mp-chat-send').onclick();
  assert.ok(f.document.querySelector('#mp-chat').innerHTML.includes('&lt;img'));
  assert.ok(!f.document.querySelector('#mp-chat').innerHTML.includes('<img'));
});

test('серверний режим повідомляє про відсутню адресу на автономній сторінці',()=>{
  const f=fixture();f.document.querySelectorAll('.nav').find(b=>b.dataset.tab==='mp').onclick();
  const mode=f.document.querySelector('#mp-transport');mode.value='server';mode.onchange();
  assert.equal(f.document.querySelector('#mp-server-options').hidden,false);
  assert.equal(f.document.querySelector('#mp-peer-join').hidden,true);
  f.document.querySelector('#mp-create').onclick();
  assert.match(f.document.querySelector('#mp-status').textContent,/АДРЕСУ/);
});

test('серверна кімната автоматично підключається і створюється лише після welcome',()=>{
  const sockets=[];
  class Socket{
    constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}
    send(text){this.sent.push(JSON.parse(text));}
    close(){this.readyState=3;this.onclose?.();}
    open(){this.readyState=1;this.onopen();}
    receive(msg){this.onmessage({data:JSON.stringify(msg)});}
  }
  const f=fixture({}, {WebSocket:Socket});f.document.querySelectorAll('.nav').find(b=>b.dataset.tab==='mp').onclick();
  const mode=f.document.querySelector('#mp-transport');mode.value='server';mode.onchange();
  f.document.querySelector('#mp-server').value='https://game.example';
  f.document.querySelector('#mp-room-name').value='Автоматично';
  f.document.querySelector('#mp-create').onclick();
  assert.equal(sockets.length,1);assert.equal(sockets[0].url,'wss://game.example/mp');
  sockets[0].open();assert.deepEqual(sockets[0].sent.map(m=>m.t),['hello']);
  sockets[0].receive({t:'welcome',id:'me',rooms:[]});
  assert.equal(sockets[0].sent.at(-1).t,'create');assert.equal(sockets[0].sent.at(-1).name,'Автоматично');
  f.document.querySelector('#mp-connect').onclick();
  sockets[0].onclose();
  sockets[1].open();sockets[1].receive({t:'welcome',id:'new',rooms:[]});
  f.document.querySelector('#mp-create').onclick();
  assert.equal(sockets.length,2,'stale close must not disconnect the new client');
  assert.equal(sockets[1].sent.at(-1).t,'create');
  const actor=(id,team,x,y)=>({id,team,x,y,nick:id,hp:100,armor:0,alive:true,ammo:12,angle:0,weapon:'pistol'});
  sockets[1].receive({t:'matchStart',room:{mapId:0,score:[0,0],timeLeft:300,killTarget:20,players:[actor('new',0,2.5,3.5),actor('other',1,21.5,20.5)]}});
  assert.equal(f.game.get().state,'playing');
  const shots=()=>sockets[1].sent.filter(m=>m.t==='shoot').length;
  f.game.shoot();assert.equal(shots(),1,'a miss is also sent to the host');
  f.game.step(.15);f.game.shoot();assert.equal(shots(),1,'multiplayer cooldown must not tick twice');
  f.game.step(.15);f.game.shoot();assert.equal(shots(),2);
  sockets[1].close();assert.equal(f.game.get().state,'lobby','disconnect returns from the match');
});

test('гра підключається до налаштованого сервера одразу після запуску',()=>{
  const sockets=[];
  class Socket{
    constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}
    send(text){this.sent.push(JSON.parse(text));}
    close(){this.readyState=3;this.onclose?.();}
    open(){this.readyState=1;this.onopen();}
    receive(msg){this.onmessage({data:JSON.stringify(msg)});}
  }
  const f=fixture({mpNick:'ТАЙФУН'}, {WebSocket:Socket}, 'https://game.example');
  assert.equal(sockets.length,1);assert.equal(sockets[0].url,'wss://game.example/mp');
  assert.equal(f.document.querySelector('#mp-server').value,'https://game.example');
  assert.match(f.document.querySelector('#connection-status').textContent,/ПІДКЛЮЧЕННЯ/);
  sockets[0].open();assert.deepEqual(sockets[0].sent.map(m=>m.t),['hello']);assert.equal(sockets[0].sent[0].nick,'ТАЙФУН');
  sockets[0].receive({t:'welcome',id:'me',rooms:[]});
  assert.match(f.document.querySelector('#connection-status').textContent,/ОНЛАЙН/);
});

test('автономний HTML не потребує жодних зовнішніх файлів чи завантажень',()=>{
  const html=readFileSync(new URL('../play.html',import.meta.url),'utf8');assert.ok(html.includes('ТВІЙ СЕКТОР.'));assert.ok(!html.includes('type="module"'));assert.ok(!html.includes('src="game.js"'));assert.ok(!html.includes('@import'));assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/.test(html));const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new vm.Script(js));
});

test('боти на всіх мапах знаходять бій і завершують раунд без участі гравця',()=>{
  for(let i=0;i<9;i++){
    const f=fixture({map:i});f.game.start();f.game.beginFight();
    let exchangedFire=false;
    for(let t=0;t<2450&&f.game.get().phase==='fight';t++){
      f.tick(.05);if(f.game.get().actors.some(a=>a.hp<100))exchangedFire=true;
    }
    assert.ok(exchangedFire,`map ${i}: bots must reach and attack opponents`);
    assert.equal(f.game.get().phase,'intermission',`map ${i}: round must end`);
  }
});
