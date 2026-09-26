import test from 'node:test';
import assert from 'node:assert/strict';
import { GRENADES, buyGrenade, launchGrenade, stepGrenades, smokeBlocks } from '../public/grenades.js';
const arena=()=>({size:24,grid:Array.from({length:24},(_,y)=>Array.from({length:24},(_,x)=>x===0||y===0||x===23||y===23?1:0))});
const soldier=(props={})=>({x:8,y:8,z:0,angle:0,hp:100,team:0,money:5000,grenades:{},...props});
const tick=(map,shots,effects,actors,dt)=>stepGrenades(map,shots,effects,actors,dt,(a,n)=>a.hp=Math.max(0,a.hp-n));

test('purchase enforces four slots, two flashes, side and balance without spending on failure',()=>{
  const a=soldier();assert.equal(buyGrenade(a,'molotov').ok,false);assert.equal(a.money,5000);
  for(const id of ['flashbang','flashbang','smoke','incendiary'])assert.equal(buyGrenade(a,id).ok,true);
  const money=a.money;assert.equal(buyGrenade(a,'he').ok,false);assert.equal(a.money,money);
  const t=soldier({team:1,money:400});assert.equal(buyGrenade(t,'molotov').ok,true);assert.equal(t.money,0);assert.equal(buyGrenade(t,'he').ok,false);
  const b=soldier();buyGrenade(b,'he');assert.equal(buyGrenade(b,'he').ok,false);
});
test('throws consume one grenade and bounce without tunneling through walls',()=>{
  const map=arena(),a=soldier({grenades:{he:1},x:10.8});for(let y=0;y<24;y++)map.grid[y][12]=1;
  const g=launchGrenade(map,a,'he'),shots=[g];assert.equal(a.grenades.he,0);assert.equal(launchGrenade(map,a,'he'),null);
  tick(map,shots,[],[a],.35);assert.ok(g.x<12);assert.ok(g.vx<0);
  assert.ok(launchGrenade(map,soldier({grenades:{smoke:1}}),'smoke',0,true).vx<launchGrenade(map,soldier({grenades:{smoke:1}}),'smoke').vx);
});
test('HE has distance falloff, self damage, teammate protection and wall occlusion',()=>{
  const map=arena(),owner=soldier({x:8.1}),near=soldier({x:9,team:1}),far=soldier({x:11,team:1}),friend=soldier({x:8.5}),shielded=soldier({x:8,y:10,team:1});map.grid[9][8]=1;
  const shots=[{id:'he',owner,x:8,y:8,z:.5,age:1.49,rest:true}];tick(map,shots,[],[owner,near,far,friend,shielded],.02);
  assert.equal(shots.length,0);assert.ok(near.hp<far.hp);assert.ok(owner.hp<100);assert.equal(friend.hp,100);assert.equal(shielded.hp,100);
});
test('flash strength depends on facing and walls block the effect',()=>{
  const map=arena(),owner=soldier(),front=soldier({x:10,angle:Math.PI}),back=soldier({x:10,angle:0}),blocked=soldier({x:8,y:10});map.grid[9][8]=1;
  tick(map,[{id:'flashbang',owner,x:8,y:8,z:.5,age:1.49,rest:true}],[],[front,back,blocked],.02);
  assert.ok(front.blind>2);assert.ok(back.blind<1);assert.equal(blocked.blind,0);
  tick(map,[],[],[front,back],5);assert.equal(front.blind,0);
});
test('smoke settles, blocks sight both ways, expires and extinguishes fire',()=>{
  const map=arena(),owner=soldier({grenades:{smoke:1}}),shots=[launchGrenade(map,owner,'smoke',0,true)],effects=[];
  tick(map,shots,effects,[owner],5);assert.equal(shots.length,0);const smoke=effects.find(e=>e.kind==='smoke');assert.ok(smoke);
  const a={x:smoke.x-4,y:smoke.y},b={x:smoke.x+4,y:smoke.y};assert.equal(smokeBlocks(effects,a,b),true);assert.equal(smokeBlocks(effects,b,a),true);
  assert.equal(smokeBlocks(effects,{...a,y:a.y+5},{...b,y:b.y+5}),false);
  effects.push({kind:'fire',...b,x:smoke.x,z:smoke.z,radius:2.4,left:7,owner});tick(map,shots,effects,[owner],.1);assert.ok(!effects.some(e=>e.kind==='fire'));
  tick(map,shots,effects,[owner],20);assert.equal(effects.length,0);
});
test('fire ignites on impact, damages over time, respects walls and jumping height',()=>{
  const map=arena(),owner=soldier({grenades:{molotov:1}}),shots=[launchGrenade(map,owner,'molotov',-.4,true)],effects=[];
  tick(map,shots,effects,[owner],.8);assert.equal(shots.length,0);const fire=effects.find(e=>e.kind==='fire');assert.ok(fire);
  const enemy=soldier({x:fire.x,y:fire.y,team:1}),jumping=soldier({x:fire.x,y:fire.y,z:1.2,grounded:false,team:1});
  const hp=enemy.hp;tick(map,shots,effects,[enemy,jumping],1);assert.ok(Math.abs(hp-enemy.hp-32)<.01);assert.equal(jumping.hp,100);
});
test('decoy starts only after landing, pulses and expires',()=>{
  const map=arena(),a=soldier({grenades:{decoy:1}}),shots=[launchGrenade(map,a,'decoy',0,true)],effects=[],sounds=[];
  stepGrenades(map,shots,effects,[a],5,()=>{},kind=>sounds.push(kind));assert.ok(effects.some(e=>e.kind==='decoy'));assert.ok(sounds.includes('decoy-shot'));
  tick(map,shots,effects,[a],20);assert.equal(effects.length,0);
});
test('all grenade types resolve and stable substeps give consistent flight',()=>{
  for(const id of Object.keys(GRENADES)){
    const map=arena(),a=soldier({grenades:{[id]:1}}),shots=[launchGrenade(map,a,id)],effects=[];tick(map,shots,effects,[a],8);assert.equal(shots.length,0,id);
  }
  const map=arena(),a=soldier({grenades:{he:2}}),g1=launchGrenade(map,a,'he'),g2=launchGrenade(map,a,'he');tick(map,[g1],[],[a],.5);for(let i=0;i<30;i++)tick(map,[g2],[],[a],1/60);assert.ok(Math.abs(g1.x-g2.x)<1e-8);
});

test('fire cannot damage through walls or be extinguished by smoke in another room',()=>{
  const map=arena();for(let x=1;x<23;x++)map.grid[9][x]=1;
  const owner=soldier({x:8,y:8}),enemy=soldier({x:8,y:10,team:1});
  const effects=[{kind:'fire',x:8,y:8,z:.06,radius:2.4,left:7,owner},{kind:'smoke',x:8,y:10,z:.06,radius:2.7,left:18}];
  tick(map,[],effects,[enemy],1);assert.equal(enemy.hp,100);assert.ok(effects.some(e=>e.kind==='fire'));
});
