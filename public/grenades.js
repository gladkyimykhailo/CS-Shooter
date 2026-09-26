import { blocked, floorHeight, actorHeight, lineOfSight, clamp } from './core.js';

// World units and timings are tuned for SECTOR's compact maps.
export const GRENADES = {
  he:{name:'Осколкова HE',short:'HE',price:300,color:'#93a45b',icon:'✹',type:'ВИБУХОВА',description:'Вибух через 1,5 с · шкода залежить від відстані',fuse:1.5,radius:4},
  flashbang:{name:'Світлошумова',short:'FLASH',price:200,color:'#dce8e8',icon:'✦',type:'ЗАСЛІПЛЕННЯ',description:'Засліплює в полі зору · відвернися, щоб послабити ефект',fuse:1.5,radius:12},
  smoke:{name:'Димова',short:'SMOKE',price:300,color:'#a8bbc0',icon:'☁',type:'ДИМОВА ЗАВІСА',description:'18 с диму · блокує видимість та гасить вогонь',fuse:1.7,radius:2.7,duration:18},
  molotov:{name:'Молотов',short:'MOLOTOV',price:400,color:'#ed9855',icon:'♨',type:'ВОГОНЬ · T',side:'t',description:'Займається на землі · 7 с вогню · тільки T',fuse:3.5,radius:2.4,duration:7},
  incendiary:{name:'Запалювальна',short:'FIRE',price:500,color:'#ee6d4f',icon:'♨',type:'ВОГОНЬ · CT',side:'ct',description:'Займається на землі · 7 с вогню · тільки CT',fuse:3.5,radius:2.4,duration:7},
  decoy:{name:'Граната-приманка',short:'DECOY',price:50,color:'#baad88',icon:'♪',type:'ВІДВОЛІКАННЯ',description:'15 с імітації пострілів · відволікає ворожих ботів',fuse:1.7,radius:1.5,duration:15}
};
export const grenadeCount = a => Object.values(a.grenades||{}).reduce((sum,n)=>sum+n,0);
export function grenadePurchaseError(a,id){
  const g=GRENADES[id];
  if(!g)return 'Невідома граната';
  if(g.side&&(a.team===0?'ct':'t')!==g.side)return 'Недоступно для твоєї команди';
  if(grenadeCount(a)>=4)return 'Максимум 4 гранати';
  if((a.grenades?.[id]||0)>=(id==='flashbang'?2:1))return id==='flashbang'?'Максимум 2 світлошумові':'Ця граната вже є';
  if(a.money<g.price)return 'Бракує грошей';
  return '';
}
export function buyGrenade(a,id){
  const message=grenadePurchaseError(a,id);if(message)return {ok:false,message};
  a.money-=GRENADES[id].price;a.grenades??={};a.grenades[id]=(a.grenades[id]||0)+1;return {ok:true};
}
export function launchGrenade(map,owner,id,pitch=0,short=false){
  if(!GRENADES[id]||owner.hp<=0||!(owner.grenades?.[id]>0))return null;
  owner.grenades[id]--;
  const elevation=clamp(.3+pitch*1.8,-.5,1.1),speed=short?3:8;
  return {id,owner,x:owner.x,y:owner.y,z:actorHeight(map,owner)+.55,vx:Math.cos(owner.angle)*speed*Math.cos(elevation),vy:Math.sin(owner.angle)*speed*Math.cos(elevation),vz:speed*Math.sin(elevation),age:0,rest:false};
}
export function smokeBlocks(effects,a,b){
  return effects.some(e=>{
    if(e.kind!=='smoke'||e.left<=0)return false;
    const dx=b.x-a.x,dy=b.y-a.y,dz=(b.z??.5)-(a.z??.5),len=dx*dx+dy*dy+dz*dz;
    const t=len?clamp(((e.x-a.x)*dx+(e.y-a.y)*dy+(e.z+.7-(a.z??.5))*dz)/len,0,1):0;
    return Math.hypot(a.x+dx*t-e.x,a.y+dy*t-e.y,(a.z??.5)+dz*t-e.z-.7)<e.radius;
  });
}
export function grenadeVisible(map,a,b){
  return lineOfSight(map,a.x,a.y,b.x,b.y,a.z??floorHeight(map,a.x,a.y)+.25,b.hp!==undefined?actorHeight(map,b)+.5:b.z??floorHeight(map,b.x,b.y)+.25);
}
function grenadeBurst(map,g,actors,effects,hit,notify){
  const def=GRENADES[g.id],kind=g.id==='molotov'||g.id==='incendiary'?'fire':g.id;
  notify(kind,g);
  if(kind==='he'||kind==='flashbang'){
    effects.push({kind:'burst',x:g.x,y:g.y,z:g.z,radius:kind==='he'?1.5:2,left:.35,duration:.35,color:def.color});
    for(const a of actors){
      if(a.hp<=0||!grenadeVisible(map,g,a))continue;
      const d=Math.hypot(a.x-g.x,a.y-g.y,actorHeight(map,a)+.5-g.z);
      if(d>=def.radius)continue;
      if(kind==='he'){if(a===g.owner||a.team!==g.owner.team)hit(a,98*(1-d/def.radius),g.owner,'he');}
      else {
        const facing=Math.cos(Math.atan2(g.y-a.y,g.x-a.x)-a.angle),strength=(1-d/def.radius)*(facing>.3?1:facing>-.4?.55:.18);
        a.blind=Math.max(a.blind||0,4*strength);a.blindPeak=Math.max(a.blindPeak||0,a.blind);
      }
    }
  }else {
    const z=floorHeight(map,g.x,g.y)+.06;
    effects.push({kind,x:g.x,y:g.y,z,radius:def.radius,left:def.duration,duration:def.duration,owner:g.owner,pulse:0,color:def.color});
  }
}
// Substeps keep bounces and damage stable at different display frame rates.
export function stepGrenades(map,projectiles,effects,actors,dt,hit=()=>{},notify=()=>{}){
  let remaining=dt;
  while(remaining>1e-8){
    const step=Math.min(1/60,remaining);remaining-=step;
    for(const a of actors){a.blind=Math.max(0,(a.blind||0)-step);if(!a.blind)a.blindPeak=0;}
    for(const e of effects){
      e.left-=step;if(e.left<=0)continue;
      if(e.kind==='fire'){
        if(effects.some(s=>s.kind==='smoke'&&s.left>0&&Math.hypot(s.x-e.x,s.y-e.y)<s.radius+e.radius&&grenadeVisible(map,s,e))){e.left=0;continue;}
        for(const a of actors)if(a.hp>0&&(a===e.owner||a.team!==e.owner.team)&&Math.hypot(a.x-e.x,a.y-e.y)<e.radius&&Math.abs(actorHeight(map,a)-e.z)<.6&&grenadeVisible(map,e,a))hit(a,32*step,e.owner,'fire');
      }
      if(e.kind==='decoy'){e.pulse-=step;if(e.pulse<=0){e.pulse=.7;notify('decoy-shot',e);}}
    }
    for(let i=effects.length-1;i>=0;i--)if(effects[i].left<=0)effects.splice(i,1);
    for(let i=projectiles.length-1;i>=0;i--){
      const g=projectiles[i];g.age+=step;let landed=false;
      if(!g.rest){
        g.vz-=7.5*step;
        const solid=(x,y)=>blocked(map,x,y)||floorHeight(map,x,y)>g.z-.06;
        const nx=g.x+g.vx*step;if(solid(nx,g.y))g.vx*=-.52;else g.x=nx;
        const ny=g.y+g.vy*step;if(solid(g.x,ny))g.vy*=-.52;else g.y=ny;
        g.z+=g.vz*step;const floor=floorHeight(map,g.x,g.y)+.08;
        if(g.z<=floor){g.z=floor;landed=true;g.vz=Math.abs(g.vz)*.36;g.vx*=.62;g.vy*=.62;if(g.vz<.45&&Math.hypot(g.vx,g.vy)<.65){g.rest=true;g.vz=0;}}
      }
      const incendiary=g.id==='molotov'||g.id==='incendiary';
      const settled=g.id==='smoke'||g.id==='decoy';
      if((incendiary&&landed)||(!settled&&g.age>=GRENADES[g.id].fuse)||(settled&&g.age>=GRENADES[g.id].fuse&&g.rest)){
        grenadeBurst(map,g,actors,effects,hit,notify);projectiles.splice(i,1);
      }
    }
  }
}

// Depth-clipped world particles; smoke is opaque enough to conceal silhouettes.
export function drawGrenades(c,projectiles,effects,view,{w,h,projection,horizon,eye,depths,time,map}){
  const inside=effects.find(e=>e.kind==='smoke'&&Math.hypot(view.x-e.x,view.y-e.y,eye-e.z-.7)<e.radius*.85);
  if(inside){c.save();c.globalAlpha=Math.min(.98,inside.left/1.5);c.fillStyle='#9aa39e';c.fillRect(0,0,w,h);c.restore();if(inside.left>1.5)return;}
  const ca=Math.cos(view.angle),sa=Math.sin(view.angle),particles=[];
  for(const g of projectiles)particles.push({...g,r:.10,color:GRENADES[g.id].color,alpha:1});
  for(const e of effects){
    if(e.kind==='smoke'){
      for(let i=0;i<19;i++){const a=i*2.4,r=i?e.radius*.58:0,p={x:e.x+Math.cos(a)*r,y:e.y+Math.sin(a)*r,z:e.z+.3+(i%3)*.45,r:e.radius*.7,color:i%2?'#929b98':'#a8afab',alpha:Math.min(1,e.left/1.5)};if(!map||(!blocked(map,p.x,p.y)&&grenadeVisible(map,e,p)))particles.push(p);}
    }else if(e.kind==='fire'){
      for(let i=0;i<22;i++){const a=i*2.4,r=e.radius*Math.sqrt(i/22),p={x:e.x+Math.cos(a)*r,y:e.y+Math.sin(a)*r,z:e.z+.12+(Math.sin(time*12+i)+1)*.12,r:.18+(Math.sin(time*9+i)+1)*.06,color:i%3?'#ff9d35':'#ffe48a',alpha:Math.min(1,e.left)};if(!map||(!blocked(map,p.x,p.y)&&grenadeVisible(map,e,p)))particles.push(p);}
    }else particles.push({...e,r:e.kind==='burst'?e.radius*(1-e.left/e.duration)+.1:.13,color:e.kind==='burst'?'#ffdca2':e.color,alpha:e.kind==='burst'?e.left/e.duration:1});
  }
  for(const p of particles)p.depth=(p.x-view.x)*ca+(p.y-view.y)*sa;
  particles.sort((a,b)=>b.depth-a.depth);
  c.save();
  for(const p of particles){
    if(p.depth<.08)continue;
    const sx=w/2+(-(p.x-view.x)*sa+(p.y-view.y)*ca)*projection/p.depth,sy=horizon-(p.z-eye)*projection/p.depth,r=Math.min(w*2,p.r*projection/p.depth);
    if(sx+r<0||sx-r>w||sy+r<0||sy-r>h)continue;
    c.fillStyle=p.color;c.globalAlpha=p.alpha;
    for(let y=Math.max(0,Math.floor(sy-r));y<Math.min(h,sy+r);y+=4)for(let x=Math.max(0,Math.floor(sx-r));x<Math.min(w,sx+r);x+=4){
      if((x-sx)**2+(y-sy)**2>r*r||p.depth-p.r>depths[y*w+x]+.05)continue;
      c.fillRect(x,y,4,4);
    }
  }
  c.restore();
}
export function drawHeldGrenade(c,id,w,h,glove){
  const g=GRENADES[id],scale=Math.min(w/900,h/560);
  c.save();c.translate(w*.72,h*.88);c.scale(scale,scale);c.rotate(-.2);
  c.fillStyle=glove;c.fillRect(-42,5,94,110);c.fillStyle='#303932';c.fillRect(-48,14,98,40);
  c.fillStyle=g.color;
  if(id==='molotov'){c.fillStyle='#597642';c.fillRect(-25,-65,50,91);c.fillRect(-11,-113,22,48);c.fillStyle='#e4c694';c.fillRect(-27,-37,54,38);c.fillStyle='#c2b6a0';c.fillRect(-7,-128,12,20);c.fillRect(1,-132,24,10);}
  else {if(id==='he'){c.beginPath();c.ellipse(0,-24,39,51,0,0,Math.PI*2);c.fill();}else c.fillRect(-30,-78,62,98);c.fillStyle='#27322e';c.fillRect(-30,-34,62,22);c.fillRect(-16,-100,32,24);c.fillStyle='#cbd0ba';c.fillRect(10,-101,34,9);c.fillRect(37,-93,7,63);}
  c.fillStyle='#17201b';c.font='bold 12px monospace';c.textAlign='center';c.fillText(g.short,0,-47);c.restore();
}

export function grenadeIcon(id){
  const g=GRENADES[id];
  const body=id==='molotov'?'<path d="M52 15h16v28l12 14v64H40V57l12-14z" fill="#597642"/><path d="M58 16V5h25v8H65" fill="#c2b6a0"/>':`<rect x="36" y="40" width="49" height="80" rx="${id==='he'?23:5}" fill="${g.color}"/><path d="M49 40V24h23v16M64 24h27v63" fill="none" stroke="#bec6be" stroke-width="6"/>`;
  return `<svg class="grenade-icon" viewBox="0 0 120 140" aria-hidden="true">${body}<path d="M40 78h40v18H40z" fill="#28362d"/><text x="60" y="90" text-anchor="middle" fill="#eef1df" font-size="8" font-family="monospace">${g.short}</text></svg>`;
}
