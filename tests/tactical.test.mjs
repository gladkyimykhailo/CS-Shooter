import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WEAPONS, canStand, findPath, purchase, applyDamage } from '../public/core.js';
import { MATCH, teamSpawns, createBomb, bombAction, stepBomb, bombRoundWinner, rewardRound, assignBotRoutes } from '../public/tactical.js';

function scenario() {
  const map=MAPS[0], [x,y]=map.sites.a.point;
  const ct={team:0,x,y,hp:100,money:800,grounded:true,moving:false};
  const t={team:1,x,y,hp:100,money:800,grounded:true,moving:false};
  const actors=[ct,t],bomb=createBomb(actors);
  return {map,ct,t,actors,bomb,step:(dt,user)=>stepBomb(map,bomb,actors,dt,a=>a===user)};
}

test('all nine maps have five distinct reachable spawns per side',()=>{
  for(const map of MAPS)for(const team of [0,1]){
    const spawns=teamSpawns(map,team);assert.equal(spawns.length,5);
    for(const [i,[x,y]] of spawns.entries()){
      assert.ok(canStand(map,x,y));assert.ok(findPath(map,x,y,...map.sites.a.point).length);
      for(const p of spawns.slice(i+1))assert.ok(Math.hypot(x-p[0],y-p[1])>=.8);
    }
  }
});

test('arsenal uses Counter-Strike names across shared client/server definitions',()=>{
  assert.deepEqual(Object.values(WEAPONS).map(w=>w.name),['USP-S','Glock-18','P250','Dual Berettas','Desert Eagle','Five-SeveN','Tec-9','CZ75-Auto','MP9','MAC-10','MP5-SD','MP7','UMP-45','P90','PP-Bizon','M4A4','AK-47','FAMAS','Galil AR','M4A1-S','AUG','SG 553','SSG 08','AWP','G3SG1','SCAR-20','Nova','XM1014','MAG-7','Sawed-Off','Negev','M249']);
});

test('plant requires the carrier on a site; releasing, moving, or jumping resets progress',()=>{
  const s=scenario();
  assert.equal(bombAction(s.map,s.bomb,s.ct),null);
  s.t.x+=6;assert.equal(bombAction(s.map,s.bomb,s.t),null);s.t.x-=6;
  s.step(2,s.t);assert.equal(s.bomb.planted,false);
  s.step(.1,null);assert.equal(s.bomb.progress,0);
  s.step(2,s.t);s.t.moving=true;s.step(.1,s.t);assert.equal(s.bomb.progress,0);
  s.t.moving=false;s.step(2,s.t);s.t.grounded=false;s.step(.1,s.t);assert.equal(s.bomb.progress,0);
  s.t.grounded=true;assert.equal(s.step(MATCH.plantTime,s.t),'planted');
  assert.equal(s.bomb.site,'a');assert.equal(s.bomb.timeLeft,40);assert.equal(s.t.money,1100);
});

test('dead carrier drops C4 and a living terrorist must physically retrieve it',()=>{
  const s=scenario(),other={...s.t,x:s.t.x+4};s.actors.push(other);s.t.hp=0;
  s.step(.1,null);assert.equal(s.bomb.dropped,true);assert.equal(s.bomb.carrier,null);
  other.x=s.t.x;s.step(.1,null);assert.equal(s.bomb.carrier,other);assert.equal(s.bomb.dropped,false);
});

test('planting on B records the actual location; defuse needs proximity',()=>{
  const s=scenario();[s.t.x,s.t.y]=s.map.sites.b.point;
  s.step(3.2,s.t);assert.equal(s.bomb.site,'b');
  assert.equal(bombAction(s.map,s.bomb,s.ct),null);
  s.step(10,s.ct);assert.equal(s.bomb.resolved,null);
});

test('post-plant elimination and round timeout still require CT to defuse',()=>{
  const s=scenario();s.step(3.2,s.t);s.t.hp=0;
  assert.equal(bombRoundWinner(s.actors,s.bomb,true),null);
  assert.equal(s.step(9.9,s.ct),null);assert.equal(s.step(.1,s.ct),'defused');
  assert.equal(bombRoundWinner(s.actors,s.bomb),0);assert.equal(s.ct.money,1100);
});

test('kit halves defuse time and a late defuse loses to the bomb timer',()=>{
  const fast=scenario();fast.ct.kit=true;fast.step(3.2,fast.t);
  assert.equal(fast.step(4.9,fast.ct),null);assert.equal(fast.step(.1,fast.ct),'defused');
  const late=scenario();late.step(3.2,late.t);late.bomb.timeLeft=4;
  assert.equal(late.step(10,late.ct),'exploded');assert.equal(bombRoundWinner(late.actors,late.bomb),1);
});

test('defuse progress belongs to one living CT and resets when they leave or die',()=>{
  const s=scenario();s.step(3.2,s.t);s.step(4,s.ct);
  const other={...s.ct};s.actors.push(other);s.ct.hp=0;s.step(.1,other);
  assert.equal(s.bomb.progress,.1);other.x+=5;s.step(.1,other);assert.equal(s.bomb.progress,0);
});

test('CT wins an unplanted timeout regardless of remaining health; T wins elimination',()=>{
  const s=scenario();s.ct.hp=1;
  assert.equal(bombRoundWinner(s.actors,s.bomb),null);
  assert.equal(bombRoundWinner(s.actors,s.bomb,true),0);
  s.ct.hp=0;assert.equal(bombRoundWinner(s.actors,s.bomb),1);
});

test('round economy ramps loss rewards, adds plant compensation and caps money',()=>{
  const s=scenario(),losses=[0,0];
  rewardRound(s.actors,0,losses,s.bomb);assert.equal(s.ct.money,4050);assert.equal(s.t.money,2200);
  rewardRound(s.actors,0,losses,s.bomb);assert.equal(s.t.money,4100);
  s.bomb.planted=true;s.bomb.resolved='defused';rewardRound(s.actors,0,losses,s.bomb);assert.equal(s.t.money,7300);
  s.ct.money=15900;rewardRound(s.actors,0,losses,s.bomb);assert.equal(s.ct.money,16000);
  rewardRound(s.actors,1,losses,s.bomb);assert.equal(losses[1],0);
});

test('pistol budget, helmet damage, CT kit restriction and primary replacement',()=>{
  const s=scenario();Object.assign(s.ct,{armor:0,primary:null,weapon:'pistol',inventory:{pistol:{ammo:12,reserve:36}}});
  assert.equal(purchase(s.ct,'rifle').ok,false);assert.equal(s.ct.money,800);
  assert.equal(purchase(s.ct,'kit').ok,true);assert.equal(s.ct.money,400);
  assert.equal(purchase(s.ct,'kit').ok,false);assert.equal(purchase(s.t,'kit').ok,false);
  s.ct.money=1000;assert.equal(purchase(s.ct,'helmet').ok,true);applyDamage(s.ct,60,true);
  assert.equal(s.ct.hp,70);assert.equal(s.ct.armor,70);
  s.ct.money=10000;purchase(s.ct,'rifle');purchase(s.ct,'m4a1');
  assert.equal(s.ct.inventory.rifle,undefined);assert.ok(s.ct.inventory.pistol);assert.ok(s.ct.inventory.m4a1);
  assert.equal(purchase(s.ct,'kalash').ok,false,'CT не купить AK-47');
  assert.equal(purchase(s.t,'rifle').ok,false,'T не купить M4A4');
});

function seededRandom(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}

test('random bot plans cover A, B and mid with reachable separate positions on every map',()=>{
  for(const map of MAPS)for(const playerTeam of [0,1])for(const seed of [1,42,2026]){
    const actors=[0,1].flatMap(team=>teamSpawns(map,team).map(([x,y],slot)=>({x,y,team,hp:100,isPlayer:team===playerTeam&&slot===0})));
    const bomb=createBomb(actors,seed%2?'a':'b');
    assignBotRoutes(map,actors,bomb,seededRandom(seed));
    assert.equal(actors.find(a=>a.isPlayer).route,undefined,'only bots receive plans');
    for(const team of [0,1]){
      const bots=actors.filter(a=>a.team===team&&!a.isPlayer);
      assert.deepEqual([...new Set(bots.map(a=>a.route.lane))].sort(),['a','b','mid']);
      for(const lane of ['a','b','mid'])assert.ok(bots.filter(a=>a.route.lane===lane).length<=2);
      assert.equal(new Set(bots.map(a=>a.route.x+','+a.route.y)).size,bots.length);
      for(const a of bots)assert.ok(findPath(map,a.x,a.y,a.route.x,a.route.y).length,`${map.id}: route is reachable`);
    }
    if(!bomb.carrier.isPlayer)assert.equal(bomb.carrier.route.lane,bomb.site);
    const first=JSON.stringify(actors.map(a=>a.route));
    assignBotRoutes(map,actors,bomb,seededRandom(seed));
    assert.equal(JSON.stringify(actors.map(a=>a.route)),first,'seed determines the plan');
    assignBotRoutes(map,actors,bomb,seededRandom(seed+1));
    assert.notEqual(JSON.stringify(actors.map(a=>a.route)),first,'a new random draw changes the plan');
  }
});
