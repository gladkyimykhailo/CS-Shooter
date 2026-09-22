import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WEAPONS, canStand, moveActor, lineOfSight, findPath, applyDamage, purchase, roundWinner } from '../public/core.js';

test('кожна мапа має прохідні точки старту та маршрути між усіма учасниками',()=>{
  for(const map of MAPS){
    for(const [x,y]of [...map.blue,...map.red])assert.ok(canStand(map,x,y),`${map.id}: spawn ${x},${y}`);
    for(const a of map.blue)for(const b of map.red){const p=findPath(map,...a,...b);assert.ok(p.length>0,`${map.id}: route`);for(const step of p)assert.ok(canStand(map,step.x,step.y));}
    assert.ok(map.mid?.name&&Array.isArray(map.mid.point),`${map.id}: MID metadata`);assert.ok(canStand(map,...map.mid.point),`${map.id}: MID is reachable`);
    for(const [label,site]of Object.entries(map.sites||{})){assert.ok(site.name&&canStand(map,...site.point),`${map.id}: ${label} site`);}
    for(const start of [...map.blue,...map.red]){assert.ok(findPath(map,...start,...map.mid.point).length>0,`${map.id}: spawn reaches MID`);for(const site of Object.values(map.sites))assert.ok(findPath(map,...start,...site.point).length>0,`${map.id}: spawn reaches tactical site`);}
    assert.equal(lineOfSight(map,...map.blue[0],...map.red[0]),false,`${map.id}: safe spawn`);
  }
});
test('палац має власний двір, терасу та відокремлені стартові зони',()=>{
  const palace=MAPS.find(map=>map.id==='palace');
  assert.ok(palace);assert.equal(palace.name,'ПАЛАЦ');assert.match(palace.desc,/двір/);assert.equal(palace.label,'ВЕРХНЯ ТЕРАСА');
  assert.notDeepEqual(palace.blue,MAPS[0].blue);assert.notDeepEqual(palace.red,MAPS[0].red);
});
test('тераси мають власну схему з нижніми й верхніми сходами та балконом',()=>{
  const terraces=MAPS.find(map=>map.id==='terraces');
  assert.ok(terraces);assert.equal(terraces.name,'ТЕРАСИ');assert.match(terraces.desc,/Високі сходи/);
  assert.equal(terraces.sites.a.name,'НИЖНІ СХОДИ');assert.equal(terraces.mid.name,'ВЕРХНІ СХОДИ');assert.equal(terraces.sites.b.name,'БАЛКОН');
  assert.equal(MAPS.some(map=>map.id==='arcade'),false);
});
test('Mirage: усі кімнати, сходові проходи й зони з’єднані, зовнішні стіни закриті',()=>{
  const map=MAPS.find(m=>m.id==='mirage');assert.ok(map);
  assert.equal(map.grid.length,40);
  for(const row of map.grid){assert.equal(row.length,map.size);assert.ok(row[0]&&row.at(-1));}
  assert.ok(map.grid[0].every(Boolean)&&map.grid.at(-1).every(Boolean));
  const seen=new Set(),queue=[map.blue[0].map(Math.floor)];
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i],key=`${x},${y}`;if(seen.has(key))continue;seen.add(key);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(map.grid[y+dy]?.[x+dx]===0&&!seen.has(`${x+dx},${y+dy}`))queue.push([x+dx,y+dy]);
  }
  assert.equal(seen.size,map.grid.flat().filter(t=>t===0).length,'no disconnected rooms');
  for(const area of map.callouts){assert.ok(canStand(map,...area.point),area.name);assert.ok(seen.has(area.point.map(Math.floor).join(',')),area.name);}
  for(const stair of map.stairs)for(let y=stair.y;y<stair.y+stair.h;y++)for(let x=stair.x;x<stair.x+stair.w;x++)assert.ok(canStand(map,x+.5,y+.5),'stair route is walkable');
});
test('Mirage: рампа й палац дають незалежні маршрути T до A без MID',()=>{
  const map=MAPS.find(m=>m.id==='mirage');
  const close=(grid,x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;};
  for(const blockedRoute of ['ramp','palace']){
    const grid=map.grid.map(row=>[...row]);
    close(grid,18,12,5,14);close(grid,12,3,20,4);
    if(blockedRoute==='ramp')close(grid,25,28,3,5);else close(grid,30,28,6,8);
    assert.ok(findPath({...map,grid},...map.red[0],...map.sites.a.point).length,`alternate route with ${blockedRoute} blocked`);
  }
  assert.equal(lineOfSight(map,...map.sites.a.point,...map.sites.b.point),false);
});
test('колізії не дозволяють пройти зовнішню стіну та дозволяють рух уздовж неї',()=>{
  const map=MAPS.find(m=>m.id==='furnace'),a={x:1.3,y:1.5};moveActor(map,a,-.4,.4);assert.equal(a.x,1.3);assert.equal(a.y,1.9);assert.equal(canStand(map,-1,2),false);
});
test('Dust II: Long і Short дають окремі підходи до A, тунелі ведуть до B без MID',()=>{
  const map=MAPS.find(m=>m.id==='dust2');assert.ok(map);
  const close=(grid,x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;};
  for(const route of ['long','short']){
    const grid=map.grid.map(row=>[...row]);close(grid,23,8,5,3);
    if(route==='long')close(grid,25,18,4,3);else close(grid,34,14,4,3);
    const path=findPath({...map,grid},...map.red[0],...map.sites.a.point);
    assert.ok(path.length,route);
    assert.ok(path.some(p=>route==='long'?p.x>=34&&p.y>=15&&p.y<18:p.x>=25&&p.x<29&&p.y>=18&&p.y<21),route);
  }
  const grid=map.grid.map(row=>[...row]);close(grid,18,12,5,17);
  assert.ok(findPath({...map,grid},...map.red[0],...map.sites.b.point).length,'tunnels bypass MID');
  for(const area of map.callouts)assert.ok(canStand(map,...area.point),area.name);
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
test('дві снайперські гвинтівки мають оптику, різну ціну й запас патронів',()=>{
  const light=WEAPONS.marksman,heavy=WEAPONS.sniper;
  assert.ok(light.scope<.5&&heavy.scope<light.scope);assert.ok(heavy.damage>light.damage);assert.ok(heavy.price>light.price);
  const p=buyer();assert.equal(purchase(p,'marksman').ok,true);assert.equal(p.primary,'marksman');assert.deepEqual(p.inventory.marksman,{ammo:10,reserve:30});
  p.money=5000;assert.equal(purchase(p,'sniper').ok,true);assert.equal(p.primary,'sniper');assert.deepEqual(p.inventory.sniper,{ammo:5,reserve:15});
});
test('калаш: ціна й ваншот у голову без броні',()=>{
  const k=WEAPONS.kalash;
  assert.equal(k.price,2500);assert.equal(k.size,30);assert.equal(k.automatic,true);assert.equal(k.headMult,3);
  assert.ok(k.damage*(k.headMult||2)>=100,'34 × 3 = 102: ваншот у голову');
  const p=buyer();assert.equal(purchase(p,'kalash').ok,true);assert.equal(p.money,0);assert.equal(p.weapon,'kalash');
  assert.deepEqual(p.inventory.kalash,{ammo:30,reserve:90});
});
