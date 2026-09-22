export const WEAPONS = {
  pistol: { name: 'P-12', type: 'ПІСТОЛЕТ', price: 0, damage: 25, size: 12, rate: .29, reload: 1.35, spread: .012, pellets: 1, automatic: false, icon: '▰━', description: 'Надійний запасний. 25 шкоди · 12 патронів' },
  smg: { name: 'VIPER', type: 'ПІСТОЛЕТ-КУЛЕМЕТ', price: 1200, damage: 18, size: 30, rate: .09, reload: 1.65, spread: .027, pellets: 1, automatic: true, icon: '▰▰━━', description: 'Швидкі черги. 18 шкоди · 30 патронів' },
  rifle: { name: 'RANGER', type: 'ШТУРМОВИЙ АВТОМАТ', price: 2400, damage: 30, size: 30, rate: .14, reload: 2, spread: .016, pellets: 1, automatic: true, icon: '▰▰━━━━', description: 'Контроль дистанції. 30 шкоди · 30 патронів' },
  shotgun: { name: 'HAMMER', type: 'ДРОБОВИК', price: 1800, damage: 8, size: 6, rate: .85, reload: 2.1, spread: .11, pellets: 10, automatic: false, icon: '▰━━━━━', description: 'Близький контакт. 10 дробин × 8 · 6 патронів' },
  kalash: { name: 'KALASH', type: 'ШТУРМОВИЙ АВТОМАТ', price: 2500, damage: 34, size: 30, rate: .11, reload: 2.2, spread: .02, pellets: 1, automatic: true, headMult: 3, icon: '▰▰━━━', description: 'Легенда штурмових. 34 шкоди · ×3 у голову · 30 патронів' },
  marksman: { name: 'LOOKOUT M7', type: 'ТОЧНА ГВИНТІВКА', price: 1900, damage: 70, size: 10, rate: .68, reload: 2.35, spread: .004, pellets: 1, automatic: false, headMult: 2, scope: .38, icon: '◄══════⊙', description: 'Швидкий точний постріл. Оптика ×2 · 10 патронів' },
  sniper: { name: 'NORTHSTAR', type: 'ВАЖКА СНАЙПЕРСЬКА', price: 3900, damage: 110, size: 5, rate: 1.12, reload: 3.05, spread: .0015, pellets: 1, automatic: false, headMult: 2, scope: .25, icon: '◄════════⊙', description: 'Один влучний постріл. Оптика ×4 · 5 патронів' }
};
// A tile-based adaptation of the supplied Mirage floor-plan reference.
// Rooms are carved from solid masonry, so routes cannot bypass the buildings.
const mirageRooms = [
  [3,4,8,8], [10,5,4,3], [12,3,20,4], [29,3,6,8], // B, apartments, back rooms
  [32,9,4,13], [33,17,5,8], [20,12,14,4], [18,12,5,14], // T, top mid, mid
  [8,10,5,3], [10,11,4,7], [12,14,8,4], [15,6,3,10], // short and underpass
  [3,14,6,7], [4,10,3,6], [2,19,4,12], [2,28,7,8], // market and CT approach
  [12,20,5,5], [16,21,4,2], [9,23,7,4], [16,24,4,6], // window, jungle, connector
  [13,27,6,4], [8,29,12,7], [19,30,9,4], [25,24,3,9], // A and ramp
  [27,22,9,5], [33,24,3,7], [30,28,6,8], [18,35,18,3] // T approach, palace, balcony
];
const mirageCallouts = [
  {name:'АПАРТАМЕНТИ',point:[22.5,4.5]}, {name:'РИНОК',point:[5.5,17.5]},
  {name:'SHORT',point:[13.5,15.5]}, {name:'ПІДЗЕМНИЙ ПРОХІД',point:[16.5,9.5]},
  {name:'ВІКНО',point:[14.5,22.5]}, {name:'КОНЕКТОР',point:[17.5,26.5]},
  {name:'JUNGLE',point:[11.5,25.5]}, {name:'РАМПА A',point:[26.5,29.5]},
  {name:'ПАЛАЦ',point:[32.5,32.5]}, {name:'БАЛКОН',point:[22.5,36.5]},
  {name:'CT',point:[5.5,32.5]}, {name:'T',point:[35.5,20.5]}
];
// Dust II reference: B and tunnels to the west, mid through the centre,
// the bent short approach and long lane converge on the elevated A courtyard.
const dust2Rooms = [
  [3,4,10,10], [12,9,6,4], [16,6,10,7], [23,8,8,3], // B, B doors, CT, A approach
  [27,3,10,10], [25,10,7,6], [25,15,4,10], [22,22,6,4], // A, short, catwalk
  [18,12,5,17], [18,26,5,9], [8,31,14,6], // mid, top mid, T courtyard
  [4,19,8,7], [5,12,4,9], [10,22,11,4], [5,25,5,10], // upper/lower tunnels
  [20,31,13,5], [30,25,5,10], [30,23,7,4], // T to long doors
  [34,8,4,17], [30,18,8,6], [29,16,4,5] // long A, corner, pit
];
const dust2Callouts = [
  {name:'LONG A',point:[35.5,16.5]}, {name:'SHORT A',point:[26.5,18.5]},
  {name:'ДВЕРІ LONG',point:[32.5,25.5]}, {name:'ЯМА',point:[30.5,17.5]},
  {name:'ВЕРХНІ ТУНЕЛІ',point:[7.5,22.5]}, {name:'НИЖНІ ТУНЕЛІ',point:[15.5,23.5]},
  {name:'ДВЕРІ MID',point:[20.5,15.5]}, {name:'ДВЕРІ B',point:[14.5,10.5]},
  {name:'TOP MID',point:[20.5,28.5]}, {name:'СХОДИ A',point:[26.5,13.5]},
  {name:'CT',point:[20.5,8.5]}, {name:'T',point:[12.5,34.5]}
];
const specs = [
  { id:'mirage', name:'MIRAGE · PIXEL', desc:'За твоєю схемою: A, B, MID, палац, апартаменти, ринок і конектор. Без контейнерів.', tag:'ПІКСЕЛЬНА АДАПТАЦІЯ', label:'ПАЛАЦ · MID · АПАРТАМЕНТИ', size:40, rooms:mirageRooms, callouts:mirageCallouts,
    wall:'#c5a273', light:'#f3dfb3', sky:'#b9d4d7', floor:'#b19a77', accent:'#779c9b',
    blue:[[5.5,32.5],[4.5,31.5],[6.5,34.5]], red:[[35.5,20.5],[34.5,19.5],[36.5,22.5]],
    platforms:[{x:24,y:35,w:12,h:3,z:.9},{x:30,y:28,w:6,h:7,z:.9},{x:12,y:20,w:5,h:5,z:.6},{x:9,y:23,w:7,h:4,z:.6},{x:16,y:24,w:4,h:2,z:.6},{x:12,y:3,w:23,h:8,z:.6}],
    stairs:[
      {x:16,y:26,w:4,h:3,axis:'y',dir:-1,rise:.6},
      {x:16,y:21,w:4,h:2,axis:'x',dir:-1,rise:.6},
      {x:25,y:28,w:3,h:6,axis:'y',dir:-1,rise:.9},
      {x:25,y:24,w:3,h:4,axis:'y',dir:1,rise:.9},
      {x:33,y:24,w:3,h:4,axis:'y',dir:1,rise:.9},
      {x:19,y:35,w:5,h:3,axis:'x',dir:1,rise:.9},
      {x:10,y:5,w:4,h:3,axis:'x',dir:1,rise:.6},
      {x:32,y:9,w:4,h:4,axis:'y',dir:-1,rise:.6},
      {x:15,y:8,w:3,h:5,axis:'y',dir:-1,rise:.6}
    ],
    blocks:[[5,6,1,2,2],[8,8,1,2,2],[31,5,1,1,1],[10,31,1,2,2],[14,33,2,1,2],[17,30,1,2,2],[30,30,1,1,2],[33,34,1,1,2]] },
  { id:'terraces', name:'ТЕРАСИ', desc:'Високі сходи, балкони й відкритий MID між двома ярусами.', tag:'МІСЬКІ ТЕРАСИ', label:'ВЕРХНІЙ МАРШРУТ', wall:'#aa9276', light:'#e5d3ac', sky:'#b8a185', floor:'#756f61', accent:'#678d8a', blocks:[[4,2,2,7,1],[6,5,2,4,2],[10,3,5,2,2],[17,3,3,5,1],[3,11,4,2,1],[8,9,2,3,3],[14,10,4,2,2],[19,12,2,4,1],[5,17,3,4,2],[11,16,3,5,1],[16,17,4,2,1],[8,6,1,2,3]] },
  { id:'furnace', name:'ГОРНИЛО', desc:'Промислові шахти, вузькі проходи й силові точки.', tag:'ЕНЕРГЕТИЧНИЙ ВУЗОЛ', label:'БЛИЖНІЙ БІЙ', wall:'#6c7771', light:'#c3c4a6', sky:'#596a70', floor:'#4d5b57', accent:'#d0784c', blocks:[[6,2,2,7,2],[12,2,3,5,1],[18,3,3,4,2],[3,11,5,2,1],[9,9,4,3,2],[15,10,3,5,1],[19,11,2,3,3],[5,17,4,2,2],[10,16,2,5,1],[16,17,3,3,2],[7,6,1,2,3]] },
  { id:'canal', name:'КАНАЛ', desc:'Склади біля води з перехресним вогнем через містки.', tag:'ПОРТОВИЙ РАЙОН', label:'ДОВГІ ЛІНІЇ', wall:'#668187', light:'#c4d4ca', sky:'#789aa2', floor:'#52676b', accent:'#d59559', blocks:[[5,3,2,5,1],[10,2,4,3,2],[17,3,2,6,1],[3,11,5,2,2],[8,10,2,5,1],[13,10,5,2,3],[19,11,2,4,1],[5,16,2,5,1],[10,17,5,2,2],[17,16,2,4,1],[7,8,1,1,3]] },
  { id:'citadel', name:'ЦИТАДЕЛЬ', desc:'Кам’яні двори, вузькі брами й захищений центр.', tag:'ГІРСЬКА ФОРТЕЦЯ', label:'МАНЕВРИ', wall:'#938a70', light:'#d9cfae', sky:'#9b9c8d', floor:'#68675c', accent:'#8b6b48', blocks:[[5,2,3,6,1],[11,3,3,4,1],[18,3,3,5,2],[2,11,5,2,1],[8,10,5,3,2],[16,10,5,3,1],[5,17,3,4,1],[11,16,3,5,1],[18,17,2,3,3],[8,8,1,1,3]] },
  { id:'market', name:'РИНОК', desc:'Кам’яний ринок: фонтан у MID, високі сходи й відкриті двори.', tag:'МІСЬКИЙ РИНОК', label:'ФОНТАН У MID', wall:'#a88364', light:'#e8cf9b', sky:'#b7835d', floor:'#735c49', accent:'#6d8d78', blocks:[[5,2,3,5,2],[11,2,4,2,1],[18,3,2,6,3],[3,10,4,2,1],[8,8,2,4,2],[14,8,2,4,2],[10,10,2,2,3],[17,11,4,2,1],[5,16,2,5,3],[10,16,4,2,1],[17,17,3,3,2],[8,14,2,2,1]] },
  { id:'terminal', name:'ТЕРМІНАЛ', desc:'Перони та службові коридори з кількома обходами.', tag:'ТРАНЗИТНИЙ ЦЕНТР', label:'ШВИДКИЙ ТЕМП', wall:'#727b81', light:'#cfd1b7', sky:'#84939a', floor:'#5b6368', accent:'#c97053', blocks:[[5,3,3,5,1],[11,2,2,6,2],[17,3,4,3,1],[3,11,5,3,2],[9,10,5,2,1],[16,10,4,4,2],[5,17,2,4,1],[10,16,4,2,3],[16,17,3,4,1],[8,6,1,2,3]] },
  { id:'summit', name:'ВЕРШИНА', desc:'Холодна станція, відкриті підходи та міцні укриття.', tag:'ВИСОКОГІРНА БАЗА', label:'ДИСТАНЦІЯ', wall:'#74848b', light:'#d4ded5', sky:'#9aaebb', floor:'#5b6f78', accent:'#d7a85d', blocks:[[6,3,2,5,1],[11,2,4,3,2],[18,3,2,6,1],[3,10,4,3,1],[8,9,2,5,2],[13,10,5,2,1],[19,11,2,3,3],[5,17,4,2,1],[10,16,2,5,2],[16,17,4,3,1],[7,6,1,2,3]] },
  { id:'palace', name:'ПАЛАЦ', desc:'Сонячний двір, великі парадні сходи й верхні тераси.', tag:'КОЛИШНЯ РЕЗИДЕНЦІЯ', label:'ВЕРХНЯ ТЕРАСА', wall:'#c8a471', light:'#f6dfad', sky:'#d39a61', floor:'#80654c', accent:'#4f8790', blue:[[2.5,4.5],[3.5,3.5],[3.5,5.5]], red:[[21.5,18.5],[20.5,19.5],[20.5,17.5]], blocks:[[5,2,3,3,2],[11,2,5,2,1],[18,3,3,5,3],[4,7,2,5,1],[8,7,2,3,2],[14,7,2,3,2],[10,10,4,2,3],[3,13,5,2,3],[8,13,2,3,2],[14,13,2,3,2],[18,12,2,5,1],[10,16,4,2,3],[5,18,3,3,1],[12,19,5,2,2]] }
];
// Append to preserve the numeric map selections saved by existing players.
specs.push({
  id:'dust2',name:'DUST II · PIXEL',desc:'A/B, MID, Long, Short і тунелі за твоєю схемою. Об’ємні сходи та кам’яні двори без контейнерів.',
  tag:'ПІКСЕЛЬНА АДАПТАЦІЯ',label:'LONG · SHORT · ТУНЕЛІ',size:40,rooms:dust2Rooms,callouts:dust2Callouts,
  wall:'#c2a16c',light:'#f0dca9',sky:'#ccdbd4',floor:'#af9465',accent:'#9e855a',
  blue:[[20.5,8.5],[18.5,7.5],[21.5,10.5]],red:[[12.5,34.5],[14.5,32.5],[10.5,35.5]],
  platforms:[{x:27,y:3,w:10,h:10,z:.9},{x:25,y:10,w:4,h:12,z:.6},{x:25,y:10,w:4,h:2,z:.9},{x:34,y:14,w:4,h:11,z:.45},{x:30,y:21,w:8,h:3,z:.45},{x:4,y:19,w:8,h:7,z:.6}],
  stairs:[
    {x:23,y:8,w:5,h:3,axis:'x',dir:1,rise:.9},
    {x:25,y:12,w:4,h:4,axis:'y',dir:-1,base:.6,rise:.3},
    {x:25,y:21,w:4,h:4,axis:'y',dir:-1,rise:.6},
    {x:34,y:8,w:4,h:6,axis:'y',dir:-1,base:.45,rise:.45},
    {x:31,y:24,w:4,h:4,axis:'y',dir:-1,rise:.45},
    {x:30,y:18,w:3,h:4,axis:'y',dir:1,rise:.45},
    {x:5,y:13,w:4,h:6,axis:'y',dir:1,rise:.6},
    {x:5,y:25,w:5,h:4,axis:'y',dir:-1,rise:.6},
    {x:10,y:22,w:8,h:4,axis:'x',dir:-1,rise:.6}
  ],
  blocks:[[5,6,2,1,2],[9,9,1,2,2],[4,11,1,2,2],[29,5,2,1,2],[33,8,1,2,2],[18,15,2,1,3],[22,15,1,1,3],[32,23,1,1,3],[7,20,1,1,2]]
});
const TACTICAL_LAYOUTS = {
  dust2:{a:{name:'A SITE',point:[32.5,6.5]},mid:{name:'MID',point:[20.5,19.5]},b:{name:'B SITE',point:[7.5,9.5]}},
  mirage:{a:{name:'A SITE',point:[13.5,31.5]},mid:{name:'MID',point:[20.5,19.5]},b:{name:'B SITE',point:[7.5,9.5]}},
  terraces:{a:{name:'НИЖНІ СХОДИ',point:[6,18]},mid:{name:'ВЕРХНІ СХОДИ',point:[12,12]},b:{name:'БАЛКОН',point:[18,6]}},
  furnace:{a:{name:'КРАН',point:[6,17]},mid:{name:'КОТЕЛ',point:[13,12]},b:{name:'ПІЧ',point:[18,6]}},
  canal:{a:{name:'ДОК',point:[6,17]},mid:{name:'МІСТ',point:[12,12]},b:{name:'МАЯК',point:[18,6]}},
  citadel:{a:{name:'НИЖНІЙ ДВІР',point:[6,17]},mid:{name:'БРАМА',point:[13,13]},b:{name:'ВЕРХНЯ БРАМА',point:[18,6]}},
  market:{a:{name:'КРАМНИЦІ',point:[6,17]},mid:{name:'ФОНТАН',point:[12,12]},b:{name:'ЛОЖІ',point:[18,6]}},
  terminal:{a:{name:'ПЕРОН',point:[6,17]},mid:{name:'ПЕРЕХІД',point:[12,12]},b:{name:'ВИХІД',point:[18,6]}},
  summit:{a:{name:'АНГАР',point:[6,17]},mid:{name:'ВЕЖА',point:[12,12]},b:{name:'РАДІОВЕЖА',point:[18,6]}},
  palace:{a:{name:'САД',point:[6,17]},mid:{name:'ДВІР',point:[12,13]},b:{name:'ТЕРАСА',point:[18,6]}}
};
function nearestOpen(grid,[x,y]){
  let point=[1.5,1.5],distance=Infinity;
  for(let gy=1;gy<grid.length-1;gy++)for(let gx=1;gx<grid[gy].length-1;gx++)if(grid[gy][gx]===0){const next=(gx+.5-x)**2+(gy+.5-y)**2;if(next<distance){distance=next;point=[gx+.5,gy+.5];}}
  return point;
}
export const MAPS = specs.map(s=>{
  const size=s.size||24;
  const grid = Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>s.rooms||x===0||y===0||x===size-1||y===size-1?1:0));
  for(const [x,y,w,h] of s.rooms||[])for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=0;
  for(const [x,y,w,h,t] of s.blocks) for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) grid[j][i]=t;
  const tactical=TACTICAL_LAYOUTS[s.id],mark=area=>({name:area.name,point:nearestOpen(grid,area.point)});
  const sites={a:mark(tactical.a),b:mark(tactical.b)};
  const ground=Array.from({length:size},()=>Array(size).fill(0));
  if(s.platforms){
    for(const [id,site] of [[1,sites.a],[2,sites.b]]){
      const [cx,cy]=site.point.map(Math.floor);
      for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(grid[y]?.[x]===0)ground[y][x]=id;
    }
    for(const stair of s.stairs)for(let y=stair.y;y<stair.y+stair.h;y++)for(let x=stair.x;x<stair.x+stair.w;x++)if(grid[y][x]===0)ground[y][x]=stair.axis==='x'?3:4;
  }
  // Three physical treads per map tile. The same height field drives movement,
  // visibility, projection and remote actors; no client-supplied altitude is needed.
  const heightScale=3;
  const heights=s.platforms?Array.from({length:size*heightScale},(_,y)=>Array.from({length:size*heightScale},(_,x)=>{
    const px=(x+.5)/heightScale,py=(y+.5)/heightScale;
    let z=0;
    for(const p of s.platforms)if(px>=p.x&&px<p.x+p.w&&py>=p.y&&py<p.y+p.h)z=p.z;
    for(const p of s.stairs)if(px>=p.x&&px<p.x+p.w&&py>=p.y&&py<p.y+p.h){
      const length=p.axis==='x'?p.w:p.h,offset=p.axis==='x'?px-p.x:py-p.y;
      const step=Math.floor(offset*heightScale),count=length*heightScale;
      z=(p.base||0)+p.rise*(p.dir===1?step+1:count-step)/count;
    }
    return z;
  })):null;
  return {...s,size,sites,ground,heights,heightScale,mid:mark(tactical.mid),routes:['ЛІВИЙ','MID','ПРАВИЙ'],grid,blue:s.blue||[[2.5,3.5],[3.5,2.5],[3.5,4.5]],red:s.red||[[21.5,20.5],[20.5,21.5],[20.5,19.5]]};
});
export const SKINS = [{name:'Ліс',color:'#657f67'},{name:'Ніч',color:'#546477'},{name:'Пісок',color:'#ab9970'}];
export const GLOVES = [{name:'Графіт',color:'#333b37'},{name:'Олива',color:'#60714b'},{name:'Койот',color:'#93724e'}];
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
// Viewmodel mass, spring response, recoil impulse and barrel reach (map units).
export const WEAPON_PHYSICS = {
  pistol: { mass:.8, frequency:20, kick:1, reach:.55 },
  smg: { mass:1.1, frequency:19, kick:.65, reach:.7 },
  rifle: { mass:1.6, frequency:17, kick:1.1, reach:.95 },
  shotgun: { mass:2, frequency:15, kick:2.1, reach:1.05 },
  kalash: { mass:1.8, frequency:16, kick:1.4, reach:1 },
  marksman: { mass:2.1, frequency:14, kick:2.25, reach:1.22 },
  sniper: { mass:2.7, frequency:14, kick:3.1, reach:1.42 }
};
export function createWeaponMotion(){
  return Object.fromEntries(['x','y','roll','kick','aim','wall'].map(key=>[key,{value:0,velocity:0}]));
}
// Exact damped-spring solution for a constant target: stable across frame rates.
function weaponSpring(axis,target,frequency,dt){
  const damping=frequency*.72,omega=frequency*Math.sqrt(1-.72**2);
  const offset=axis.value-target,b=(axis.velocity+damping*offset)/omega;
  const decay=Math.exp(-damping*dt),cos=Math.cos(omega*dt),sin=Math.sin(omega*dt);
  axis.value=target+decay*(offset*cos+b*sin);
  axis.velocity=decay*((-damping*offset+omega*b)*cos+(-damping*b-omega*offset)*sin);
}
export function kickWeaponMotion(motion,id,aiming=false){
  const force=WEAPON_PHYSICS[id].kick*(aiming?.6:1);
  motion.kick.velocity=Math.min(600,motion.kick.velocity+force*220);
  motion.roll.velocity=Math.max(-3,motion.roll.velocity-force*.85);
}
export function stepWeaponMotion(motion,id,input,dt){
  if(!Number.isFinite(dt)||dt<=0)return;
  const profile=WEAPON_PHYSICS[id],steady=input.aiming?.35:1;
  const turn=clamp(input.turn||0,-6,6),look=clamp(input.look||0,-3,3);
  const side=clamp(input.side||0,-1,1),forward=clamp(input.forward||0,-1,1);
  const bob=input.moving?Math.sin(input.walk||0):0;
  const targets={
    x:(-turn*4*profile.mass-side*7+bob*5)*steady,
    y:(look*13*profile.mass+forward*4+Math.abs(bob)*4-(input.lift||0)*10)*steady,
    roll:(-turn*.012*profile.mass-side*.035)*steady,
    kick:0,aim:input.aiming?1:0,wall:clamp(input.wall||0,0,1)
  };
  if(input.landing)motion.y.velocity+=Math.min(3,Math.abs(input.landing))*65*profile.mass;
  for(const key of Object.keys(targets))weaponSpring(motion[key],targets[key],profile.frequency,dt);
}
export function weaponWallProximity(map,x,y,angle,id){
  const reach=WEAPON_PHYSICS[id].reach;
  for(let distance=.1;distance<=reach;distance+=.05){
    // A narrow barrel volume catches corners as well as walls directly ahead.
    for(const side of [-.08,0,.08]){
      if(blocked(map,x+Math.cos(angle)*distance-Math.sin(angle)*side,y+Math.sin(angle)*distance+Math.cos(angle)*side))return 1-distance/reach;
    }
  }
  return 0;
}
export function blocked(map,x,y){ return (map.grid[Math.floor(y)]?.[Math.floor(x)]??1)!==0; }
export function canStand(map,x,y,r=.21){return !blocked(map,x-r,y-r)&&!blocked(map,x+r,y-r)&&!blocked(map,x-r,y+r)&&!blocked(map,x+r,y+r);}
export function floorHeight(map,x,y){return map.heights?.[Math.floor(y*map.heightScale)]?.[Math.floor(x*map.heightScale)]||0;}
export function canTraverse(map,x,y,tx,ty,r=.21){
  const count=Math.max(1,Math.ceil(Math.hypot(tx-x,ty-y)/.08));let z=floorHeight(map,x,y);
  for(let i=1;i<=count;i++){
    const px=x+(tx-x)*i/count,py=y+(ty-y)*i/count,next=floorHeight(map,px,py);
    if(!canStand(map,px,py,r)||Math.abs(next-z)>.181)return false;
    // Do not enter a high riser from its side or hang over a platform edge.
    for(const [dx,dy] of [[-r,-r],[r,-r],[-r,r],[r,r]])if(Math.abs(floorHeight(map,px+dx,py+dy)-next)>.181)return false;
    z=next;
  }
  return true;
}
export function moveActor(map,a,dx,dy){
  if(!map.heights){if(canStand(map,a.x+dx,a.y))a.x+=dx;if(canStand(map,a.x,a.y+dy))a.y+=dy;return;}
  const count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.08));
  for(let i=0;i<count;i++){if(canTraverse(map,a.x,a.y,a.x+dx/count,a.y))a.x+=dx/count;if(canTraverse(map,a.x,a.y,a.x,a.y+dy/count))a.y+=dy/count;}
  a.z=floorHeight(map,a.x,a.y);
}
export function lineOfSight(map,x,y,tx,ty,z=floorHeight(map,x,y)+.5,tz=floorHeight(map,tx,ty)+.5){
  const d=Math.hypot(tx-x,ty-y);
  for(let s=.08;s<d;s+=.08){const px=x+(tx-x)*s/d,py=y+(ty-y)*s/d;if(blocked(map,px,py)||floorHeight(map,px,py)>z+(tz-z)*s/d+.001)return false;}
  return true;
}
export function findPath(map,sx,sy,tx,ty){
  sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);
  if(blocked(map,tx,ty))return [];
  const queue=[[sx,sy]], prev=new Map([[`${sx},${sy}`,null]]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];if(x===tx&&y===ty){const path=[];let key=`${x},${y}`;while(prev.get(key)!==null){const [px,py]=key.split(',').map(Number);path.unshift({x:px+.5,y:py+.5});key=prev.get(key);}return path;}
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(!prev.has(k)&&!blocked(map,nx+.5,ny+.5)&&(!map.heights||canTraverse(map,x+.5,y+.5,nx+.5,ny+.5))){prev.set(k,`${x},${y}`);queue.push([nx,ny]);}}
  }return [];
}
export function applyDamage(actor,damage,head=false){const absorbed=head?0:Math.min(actor.armor,damage*.5);actor.armor-=absorbed;actor.hp=Math.max(0,actor.hp-damage+absorbed);return actor.hp;}
export function purchase(player,id){
  if(id==='armor'){if(player.armor>=50)return {ok:false,message:'Броня вже повна'};if(player.money<650)return {ok:false,message:'Недостатньо кредитів'};player.money-=650;player.armor=50;return {ok:true};}
  const w=WEAPONS[id];if(!w||!w.price)return {ok:false,message:'Недоступна зброя'};
  if(player.primary===id)return {ok:false,message:'Уже в спорядженні'};
  if(player.money<w.price)return {ok:false,message:'Недостатньо кредитів'};
  player.money-=w.price;player.primary=id;player.weapon=id;player.inventory[id]={ammo:w.size,reserve:w.size*3};return {ok:true};
}
export function roundWinner(actors,timedOut=false){
  const blue=actors.filter(a=>a.team===0&&a.hp>0),red=actors.filter(a=>a.team===1&&a.hp>0);
  if(!blue.length&&!red.length)return -1;if(!blue.length)return 1;if(!red.length)return 0;
  if(!timedOut)return null;if(blue.length!==red.length)return blue.length>red.length?0:1;
  const diff=blue.reduce((s,a)=>s+a.hp,0)-red.reduce((s,a)=>s+a.hp,0);return diff===0?-1:diff>0?0:1;
}
