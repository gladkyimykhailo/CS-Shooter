import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WEAPONS, canStand, moveActor, lineOfSight, findPath, applyDamage, purchase, roundWinner } from '../public/core.js';

test('кожна мапа має прохідні точки старту та маршрути між усіма учасниками',()=>{
  for(const map of MAPS){
    for(const [x,y]of [...map.blue,...map.red])assert.ok(canStand(map,x,y),`${map.id}: spawn ${x},${y}`);
    for(const a of map.blue)for(const b of map.red){const p=findPath(map,...a,...b);assert.ok(p.length>0,`${map.id}: route`);for(const step of p)assert.ok(canStand(map,step.x,step.y));}
    assert.equal(lineOfSight(map,...map.blue[0],...map.red[0]),false,`${map.id}: safe spawn`);
  }
});
test('колізії не дозволяють пройти зовнішню стіну та дозволяють рух уздовж неї',()=>{
  const a={x:1.3,y:1.5};moveActor(MAPS[0],a,-.4,.4);assert.equal(a.x,1.3);assert.equal(a.y,1.9);assert.equal(canStand(MAPS[0],-1,2),false);
});
test('броня поглинає шкоду, вичерпується, голова не захищена',()=>{
  const a={hp:100,armor:10};applyDamage(a,30);assert.equal(a.armor,0);assert.equal(a.hp,80);applyDamage(a,30);assert.equal(a.hp,50);
  const b={hp:100,armor:50};applyDamage(b,60,true);assert.equal(b.hp,40);assert.equal(b.armor,50);applyDamage(b,500);assert.equal(b.hp,0);
});
const buyer=()=>({money:2500,armor:0,primary:null,weapon:'pistol',inventory:{pistol:{ammo:12,reserve:36}}});
test('покупка атомарна, повторення не списує гроші, недостатній баланс не видає зброю',()=>{
  const p=buyer();assert.equal(purchase(p,'rifle').ok,true);assert.equal(p.money,100);assert.equal(p.weapon,'rifle');assert.deepEqual(p.inventory.rifle,{ammo:30,reserve:90});
  assert.equal(purchase(p,'rifle').ok,false);assert.equal(p.money,100);assert.equal(purchase(p,'armor').ok,false);assert.equal(p.armor,0);assert.equal(purchase(p,'unknown').ok,false);assert.equal(p.money,100);
});
test('броня відновлюється до 50, не накопичується; заміна зброї коштує повну ціну',()=>{
  const p=buyer();purchase(p,'smg');purchase(p,'armor');assert.equal(p.money,650);assert.equal(p.armor,50);assert.equal(purchase(p,'armor').ok,false);assert.equal(p.money,650);
  p.armor=10;purchase(p,'armor');assert.equal(p.armor,50);assert.equal(p.money,0);p.money=3000;purchase(p,'shotgun');assert.equal(p.money,1200);assert.equal(p.primary,'shotgun');
});
test('раунд завершується за усуненням, часом, кількістю живих і здоров’ям',()=>{
  const a=[{team:0,hp:100},{team:1,hp:100}];assert.equal(roundWinner(a),null);assert.equal(roundWinner(a,true),-1);a[1].hp=50;assert.equal(roundWinner(a,true),0);a[0].hp=0;assert.equal(roundWinner(a),1);a[1].hp=0;assert.equal(roundWinner(a),-1);
  assert.equal(roundWinner([{team:0,hp:1},{team:0,hp:1},{team:1,hp:100}],true),0);
});
test('зброя має скінченні параметри й осмислений запас патронів',()=>{for(const w of Object.values(WEAPONS)){assert.ok(w.damage>0&&w.size>0&&w.reload>0&&w.rate>0);assert.ok(w.pellets>=1);}});
test('калаш: ціна як у CS, ваншот у голову без броні',()=>{
  const k=WEAPONS.kalash;
  assert.equal(k.price,2500);assert.equal(k.size,30);assert.equal(k.automatic,true);assert.equal(k.headMult,3);
  assert.ok(k.damage*(k.headMult||2)>=100,'34 × 3 = 102: ваншот у голову');
  const p=buyer();assert.equal(purchase(p,'kalash').ok,true);assert.equal(p.money,0);assert.equal(p.weapon,'kalash');
  assert.deepEqual(p.inventory.kalash,{ammo:30,reserve:90});
});
