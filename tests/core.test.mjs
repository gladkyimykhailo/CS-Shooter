import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WEAPONS, canStand, canTraverse, moveActor, lineOfSight, findPath, applyDamage, purchase, roundWinner } from '../public/core.js';

test('pathfinding respects edits to custom maps and never returns shared mutable routes',()=>{
  const map={size:5,grid:Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>x===0||y===0||x===4||y===4?1:0))};
  const direct=findPath(map,1.5,2.5,3.5,2.5);
  assert.deepEqual(direct,[{x:2.5,y:2.5},{x:3.5,y:2.5}]);
  map.grid[2][2]=1;
  const detour=findPath(map,1.5,2.5,3.5,2.5);
  assert.equal(detour.length,4);assert.ok(detour.every(p=>canStand(map,p.x,p.y)));
  map.grid[1][2]=map.grid[3][2]=1;assert.deepEqual(findPath(map,1.5,2.5,3.5,2.5),[]);
  const builtIn=MAPS[0],first=findPath(builtIn,...builtIn.blue[0],...builtIn.red[0]);
  const expected=structuredClone(first);first[0].x=-999;first.pop();
  assert.deepEqual(findPath(builtIn,...builtIn.blue[0],...builtIn.red[0]),expected);
});

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
test('ротація містить дев’ять мап за наданими фото',()=>{
  assert.deepEqual(MAPS.map(m=>m.id),['mirage','dust2','overpass','ancient','inferno','vertigo','office','cache','nuke']);
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
  const map=MAPS.find(m=>m.id==='dust2'),a={x:3.21,y:8.5};moveActor(map,a,-.4,.4);assert.equal(a.x,3.21);assert.ok(Math.abs(a.y-8.9)<1e-6);assert.equal(canStand(map,-1,2),false);
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
for(const id of ['dust2','overpass','ancient','inferno','vertigo','office','cache','nuke'])test(`${id}: усі двори й сходи доступні з урахуванням висот, периметр закритий`,()=>{
  const map=MAPS.find(m=>m.id===id);
  assert.ok(map.grid[0].every(Boolean)&&map.grid.at(-1).every(Boolean));
  for(const row of map.grid)assert.ok(row[0]&&row.at(-1));
  const queue=[map.blue[0].map(Math.floor)],seen=new Set([queue[0].join(',')]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(!seen.has(key)&&map.grid[ny]?.[nx]===0&&canTraverse(map,x+.5,y+.5,nx+.5,ny+.5)){
        seen.add(key);queue.push([nx,ny]);
      }
    }
  }
  for(let y=0;y<map.size;y++)for(let x=0;x<map.size;x++)if(map.grid[y][x]===0)assert.ok(seen.has(`${x},${y}`),`reachable floor ${x},${y}`);
  for(const stair of map.stairs)for(let y=stair.y;y<stair.y+stair.h;y++)for(let x=stair.x;x<stair.x+stair.w;x++)assert.ok(canStand(map,x+.5,y+.5),'no cover obstructs stairs');
});
test('нові мапи зберігають альтернативні підходи при перекритті одного маршруту',()=>{
  const cases=[
    ['vertigo','a',[[35,13,5,10],[23,34,6,6]],[23,29,23,28]],
    ['vertigo','a',[[35,13,5,10],[23,23,6,5]],[23,29,34,40]],
    ['office','b',[[12,7,8,3],[18,17,7,6]],[35,40,26,31]],
    ['office','b',[[12,7,8,3],[35,24,5,7]],[18,25,18,22]],
    ['cache','a',[[13,6,7,4],[12,15,4,5]],[5,10,16,20]],
    ['cache','a',[[13,6,7,4],[5,15,5,6]],[12,16,15,20]],
    ['nuke','b',[[36,26,6,3],[31,24,6,5]],[35,40,12,18]],
    ['nuke','b',[[36,26,6,3],[35,12,5,6]],[31,35,24,29]]
  ];
  for(const [id,site,barriers,gate] of cases){
    const map=MAPS.find(m=>m.id===id),grid=map.grid.map(row=>[...row]);
    for(const [x,y,w,h] of barriers)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;
    const start=id==='office'?map.blue[0]:map.red[0];
    const path=findPath({...map,grid},...start,...map.sites[site].point);
    assert.ok(path.length,`${id}: alternate approach`);
    assert.ok(path.some(p=>p.x>=gate[0]&&p.x<gate[1]&&p.y>=gate[2]&&p.y<gate[3]),`${id}: uses expected passage`);
  }
});
test('Inferno: Banana веде до B без MID, Short і апартаменти дають окремі підходи до A',()=>{
  const map=MAPS.find(m=>m.id==='inferno');
  for(const route of ['banana','short','apartments']){
    const grid=map.grid.map(row=>[...row]);
    const close=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;};
    close(12,7,7,4); // prevent rotating from Banana through CT
    close(29,11,4,6); // arch cannot substitute for the two A approaches
    if(route==='short')close(39,19,5,5);else close(22,16,4,21);
    const path=findPath({...map,grid},...map.red[0],...map.sites[route==='banana'?'b':'a'].point);
    assert.ok(path.length,route);
    const gate={banana:[10,14,16,19],short:[33,37,20,23],apartments:[34,38,34,37]}[route];
    assert.ok(path.some(p=>p.x>=gate[0]&&p.x<gate[1]&&p.y>=gate[2]&&p.y<gate[3]),route);
  }
  assert.equal(lineOfSight(map,...map.sites.a.point,...map.sites.b.point),false);
});
test('Overpass: окремі маршрути через Long/туалети до A та канал/Monster до B',()=>{
  const map=MAPS.find(m=>m.id==='overpass');
  for(const route of ['long','bathrooms','canal','monster']){
    const grid=map.grid.map(row=>[...row]);
    const close=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;};
    close(23,7,6,3); // heaven cannot substitute for either approach
    const site=route==='long'||route==='bathrooms'?'a':'b';
    if(site==='a'){
      close(20,13,4,17);
      if(route==='long')close(12,13,5,6);else close(3,13,4,6);
    }else{
      close(23,16,6,4);
      if(route==='monster')close(29,22,5,3);else close(36,22,4,3);
    }
    const path=findPath({...map,grid},...map.red[0],...map.sites[site].point);
    assert.ok(path.length,route);
    const gate={long:[3,7,15,18],bathrooms:[12,17,15,18],canal:[29,34,22,25],monster:[36,40,22,25]}[route];
    assert.ok(path.some(p=>p.x>=gate[0]&&p.x<gate[1]&&p.y>=gate[2]&&p.y<gate[3]),route);
  }
  assert.equal(lineOfSight(map,...map.sites.a.point,...map.sites.b.point),false);
});
test('Dust II: CT може зайти на B окремо через двері або підняте вікно',()=>{
  const map=MAPS.find(m=>m.id==='dust2');
  for(const route of ['doors','window']){
    const grid=map.grid.map(row=>[...row]);
    const close=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;};
    close(18,13,5,2);close(26,8,1,3); // isolate CT from MID and the A rotation
    if(route==='doors')close(13,6,3,2);else close(13,9,3,4);
    const path=findPath({...map,grid},...map.blue[0],...map.sites.b.point);
    assert.ok(path.length,route);
    assert.ok(path.some(p=>p.x>=13&&p.x<16&&(route==='doors'?p.y>=10&&p.y<12:p.y>=6&&p.y<8)),route);
  }
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
