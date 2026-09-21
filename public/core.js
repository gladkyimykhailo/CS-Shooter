export const WEAPONS = {
  pistol: { name: 'P-12', type: 'ПІСТОЛЕТ', price: 0, damage: 25, size: 12, rate: .29, reload: 1.35, spread: .012, pellets: 1, automatic: false, icon: '▰━', description: 'Надійний запасний. 25 шкоди · 12 патронів' },
  smg: { name: 'VIPER', type: 'ПІСТОЛЕТ-КУЛЕМЕТ', price: 1200, damage: 18, size: 30, rate: .09, reload: 1.65, spread: .027, pellets: 1, automatic: true, icon: '▰▰━━', description: 'Швидкі черги. 18 шкоди · 30 патронів' },
  rifle: { name: 'RANGER', type: 'ШТУРМОВИЙ АВТОМАТ', price: 2400, damage: 30, size: 30, rate: .14, reload: 2, spread: .016, pellets: 1, automatic: true, icon: '▰▰━━━━', description: 'Контроль дистанції. 30 шкоди · 30 патронів' },
  shotgun: { name: 'HAMMER', type: 'ДРОБОВИК', price: 1800, damage: 8, size: 6, rate: .85, reload: 2.1, spread: .11, pellets: 10, automatic: false, icon: '▰━━━━━', description: 'Близький контакт. 10 дробин × 8 · 6 патронів' },
  kalash: { name: 'KALASH', type: 'ШТУРМОВИЙ АВТОМАТ', price: 2500, damage: 34, size: 30, rate: .11, reload: 2.2, spread: .02, pellets: 1, automatic: true, headMult: 3, icon: '▰▰━━━', description: 'Легенда штурмових. 34 шкоди · ×3 у голову · 30 патронів' }
};
const specs = [
  { id:'depot', name:'ДЕПО', desc:'Сталь, бетон і короткі перестрілки.', tag:'ІНДУСТРІАЛЬНА ЗОНА', label:'БАЛАНС', wall:'#61746c', light:'#bcc1a0', sky:'#769391', floor:'#566257', accent:'#d7a05f', blocks:[[6,3,2,6,1],[12,2,2,4,1],[17,4,4,2,2],[3,11,4,2,2],[9,9,5,2,1],[12,14,2,6,1],[17,10,3,3,2],[4,17,4,3,2],[17,17,2,4,1],[9,5,1,2,3],[8,15,2,1,3]] },
  { id:'port', name:'ПОРТ', desc:'Контейнери. Довгі лінії. Жодних гарантій.', tag:'ВАНТАЖНИЙ ТЕРМІНАЛ', label:'ДИСТАНЦІЯ', wall:'#5e777c', light:'#c0cebc', sky:'#859fa6', floor:'#555d5b', accent:'#c98650', blocks:[[5,3,2,7,2],[10,3,2,5,1],[16,2,2,6,2],[3,13,5,2,1],[10,11,6,2,2],[18,11,3,2,1],[4,18,5,2,2],[12,16,2,5,1],[18,16,2,4,2],[8,6,1,2,3]] },
  { id:'city', name:'СТАРЕ МІСТО', desc:'Тихі двори. Небезпечні повороти.', tag:'МІСЬКИЙ КВАРТАЛ', label:'МАНЕВРИ', wall:'#aa9b7c', light:'#dbd0ab', sky:'#b5ab93', floor:'#7b7764', accent:'#608580', blocks:[[5,2,3,6,1],[11,2,3,5,1],[18,3,3,5,1],[2,11,5,3,1],[10,10,3,3,2],[16,10,5,3,1],[5,17,3,4,1],[11,16,3,6,1],[18,17,2,3,3],[8,9,1,1,3]] }
];
export const MAPS = specs.map(s=>{
  const grid = Array.from({length:24},(_,y)=>Array.from({length:24},(_,x)=>x===0||y===0||x===23||y===23?1:0));
  for(const [x,y,w,h,t] of s.blocks) for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) grid[j][i]=t;
  return {...s,grid,blue:[[2.5,3.5],[3.5,2.5],[3.5,4.5]],red:[[21.5,20.5],[20.5,21.5],[20.5,19.5]]};
});
export const SKINS = [{name:'Ліс',color:'#657f67'},{name:'Ніч',color:'#546477'},{name:'Пісок',color:'#ab9970'}];
export const GLOVES = [{name:'Графіт',color:'#333b37'},{name:'Олива',color:'#60714b'},{name:'Койот',color:'#93724e'}];
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export function blocked(map,x,y){ return (map.grid[Math.floor(y)]?.[Math.floor(x)]??1)!==0; }
export function canStand(map,x,y,r=.21){return !blocked(map,x-r,y-r)&&!blocked(map,x+r,y-r)&&!blocked(map,x-r,y+r)&&!blocked(map,x+r,y+r);}
export function moveActor(map,a,dx,dy){if(canStand(map,a.x+dx,a.y))a.x+=dx;if(canStand(map,a.x,a.y+dy))a.y+=dy;}
export function lineOfSight(map,x,y,tx,ty){const d=Math.hypot(tx-x,ty-y);for(let s=.08;s<d;s+=.08)if(blocked(map,x+(tx-x)*s/d,y+(ty-y)*s/d))return false;return true;}
export function findPath(map,sx,sy,tx,ty){
  sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);
  if(blocked(map,tx,ty))return [];
  const queue=[[sx,sy]], prev=new Map([[`${sx},${sy}`,null]]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];if(x===tx&&y===ty){const path=[];let key=`${x},${y}`;while(prev.get(key)!==null){const [px,py]=key.split(',').map(Number);path.unshift({x:px+.5,y:py+.5});key=prev.get(key);}return path;}
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(!prev.has(k)&&!blocked(map,nx+.5,ny+.5)){prev.set(k,`${x},${y}`);queue.push([nx,ny]);}}
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
