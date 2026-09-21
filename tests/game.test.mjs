import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Executes the real game and UI handlers without a browser. Only DOM/canvas APIs
// are substituted; combat, movement, economy, timers and bot AI are unmodified.
function fixture(saved={}){
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
  const sandbox={document,console,URLSearchParams,location:{search:'?test=1'},innerWidth:320,innerHeight:200,performance:{now:()=>0},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(fn){sandbox.frame=fn;},addEventListener(name,fn){(listeners[name]??=[]).push(fn);}};
  sandbox.window=sandbox;const context=vm.createContext(sandbox);
  const source=['core.js','art.js','game.js'].map(f=>readFileSync(new URL(`../public/${f}`,import.meta.url),'utf8').replace(/^import .+?;\s*$/gm,'').replace(/^export /gm,'')).join('\n');
  vm.runInContext(source,context,{timeout:10000});
  const key=(code,type='keydown')=>{for(const fn of listeners[type]||[])fn({code,repeat:false,preventDefault(){}});};
  return {game:sandbox.__sector,document,key,storage,drawCalls:()=>drawCalls,frame:sandbox.frame,tick:dt=>vm.runInContext(`update(${Number(dt)})`,context)};
}

test('меню запускає гру, магазин купує зброю та броню, бій закриває закупівлю',()=>{
  const f=fixture();assert.equal(f.document.querySelectorAll('.map-card').length,3);f.document.querySelector('#start').onclick();assert.equal(f.game.get().phase,'buy');assert.equal(f.game.get().actors.length,6);
  f.document.querySelectorAll('[data-buy]').find(b=>b.dataset.buy==='smg').onclick();f.document.querySelectorAll('[data-buy]').find(b=>b.dataset.buy==='armor').onclick();assert.equal(f.game.get().player.money,650);assert.equal(f.game.get().player.armor,50);
  f.document.querySelector('#shop-ready').onclick();assert.equal(f.game.get().phase,'fight');assert.equal(f.game.get().modal,'');f.game.openShop();assert.equal(f.game.get().modal,'');f.game.step(.016);assert.ok(f.drawCalls()>1000,'renderer executes');
});

test('рух, постріли, стіни та перезаряджання працюють у реальному ігровому циклі',()=>{
  const f=fixture();f.game.start();f.game.beginFight();f.game.setPlayer({x:2.5,y:3.5,angle:Math.PI/2});const p=f.game.get().player;
  f.key('KeyW');f.game.step(.04);f.key('KeyW','keyup');assert.ok(p.y>3.5);
  const enemies=f.game.get().actors.filter(a=>a.team===1);enemies[0].x=2.5;enemies[0].y=6.5;enemies[0].armor=0;enemies[0].cooldown=999;f.game.shoot();assert.equal(p.inventory.pistol.ammo,11);assert.equal(enemies[0].hp,75);
  f.game.step(.31);f.game.setPlayer({x:5.5,y:4.5,angle:0});enemies[0].x=8.5;enemies[0].y=4.5;f.game.shoot();assert.equal(enemies[0].hp,75,'wall blocks shot');
  f.game.reload();f.game.step(1.5);assert.equal(p.inventory.pistol.ammo,12);assert.equal(p.inventory.pistol.reserve,34);f.key('Escape');assert.equal(f.game.get().paused,true);const y=p.y;f.key('KeyW');f.game.step(.2);assert.equal(p.y,y);f.document.querySelector('#resume').onclick();assert.equal(f.game.get().paused,false);
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
  for(let i=0;i<3;i++){const f=fixture({map:i,skin:2,glove:1});f.game.start();f.game.beginFight();f.game.step(.016);assert.equal(f.game.get().map,['depot','port','city'][i]);assert.ok(f.drawCalls()>1000);}
  const f=fixture();f.document.querySelectorAll('[data-skin]')[1].onclick();const stored=JSON.parse(f.storage.get('sector-settings'));assert.equal(stored.skin,1);
});

test('автономний HTML не потребує жодних зовнішніх файлів чи завантажень',()=>{
  const html=readFileSync(new URL('../play.html',import.meta.url),'utf8');assert.ok(html.includes('ТВІЙ СЕКТОР.'));assert.ok(!html.includes('type="module"'));assert.ok(!html.includes('src="game.js"'));assert.ok(!html.includes('@import'));assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/.test(html));const js=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new vm.Script(js));
});

test('боти на всіх трьох мапах знаходять бій і завершують раунд без участі гравця',()=>{
  for(let i=0;i<3;i++){
    const f=fixture({map:i});f.game.start();f.game.beginFight();
    let exchangedFire=false;
    for(let t=0;t<2450&&f.game.get().phase==='fight';t++){
      f.tick(.05);if(f.game.get().actors.some(a=>a.hp<100))exchangedFire=true;
    }
    assert.ok(exchangedFire,`map ${i}: bots must reach and attack opponents`);
    assert.equal(f.game.get().phase,'intermission',`map ${i}: round must end`);
  }
});
