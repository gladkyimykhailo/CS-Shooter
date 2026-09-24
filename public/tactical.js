import { canStand, findPath, floorHeight, lineOfSight } from './core.js';

export const MATCH = { startMoney:800, maxMoney:16000, buyTime:30, countdownTime:10, roundTime:115, bombTime:40, plantTime:3.2, defuseTime:10, kitTime:5, winScore:13, halfRounds:12 };

export function teamSpawns(map, team) {
  const positions=(team?map.red:map.blue).map(p=>[...p]);
  const [sx,sy]=positions[0];
  for(let radius=1;positions.length<5&&radius<5;radius++) {
    for(let dy=-radius;dy<=radius&&positions.length<5;dy++)for(let dx=-radius;dx<=radius&&positions.length<5;dx++) {
      const x=sx+dx,y=sy+dy;
      if(!canStand(map,x,y)||positions.some(p=>Math.hypot(p[0]-x,p[1]-y)<.8))continue;
      if(Math.hypot(x-sx,y-sy)>4||!findPath(map,sx,sy,x,y).length)continue;
      positions.push([x,y]);
    }
  }
  if(positions.length!==5)throw new Error(`No five-player spawn for ${map.id}`);
  return positions;
}

export function createBomb(actors, targetSite='a') {
  const terrorists=actors.filter(a=>a.team===1&&a.hp>0);
  return {carrier:terrorists.find(a=>a.isPlayer)||terrorists[0]||null, dropped:false, planted:false, x:0, y:0, site:targetSite, timeLeft:MATCH.bombTime, progress:0, user:null, action:null, resolved:null};
}

// Balance directions before choosing individual positions, so randomness cannot
// send the whole team down one lane. Plans remain stable until the next round.
export function assignBotRoutes(map, actors, bomb, random=Math.random) {
  const areas={a:map.sites.a.point,b:map.sites.b.point,mid:map.mid.point};
  for(const team of [0,1]) {
    const bots=actors.filter(a=>a.team===team&&!a.isPlayer&&a.hp>0);
    for(let i=bots.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bots[i],bots[j]]=[bots[j],bots[i]];}
    const counts={a:0,b:0,mid:0},used=[];
    if(bots.includes(bomb.carrier)) {
      const [x,y]=areas[bomb.site];
      bomb.carrier.route={lane:bomb.site,x,y};counts[bomb.site]++;used.push({x,y});
    }
    for(const a of bots) {
      if(a===bomb.carrier)continue;
      const lanes=Object.keys(areas).filter(lane=>counts[lane]===Math.min(...Object.values(counts)));
      const lane=lanes[Math.floor(random()*lanes.length)],[cx,cy]=areas[lane];
      const candidates=[];
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) {
        const x=cx+dx,y=cy+dy;
        if(canStand(map,x,y)&&!used.some(p=>Math.hypot(x-p.x,y-p.y)<1)&&lineOfSight(map,cx,cy,x,y))candidates.push({x,y});
      }
      let point={x:cx,y:cy};
      while(candidates.length) {
        const candidate=candidates.splice(Math.floor(random()*candidates.length),1)[0];
        if(findPath(map,a.x,a.y,candidate.x,candidate.y).length){point=candidate;break;}
      }
      a.route={lane,...point};counts[lane]++;used.push(point);
    }
  }
}

function nearObjective(map,a,x,y,radius) {
  return Math.hypot(a.x-x,a.y-y)<=radius&&Math.abs(floorHeight(map,a.x,a.y)-floorHeight(map,x,y))<.25&&lineOfSight(map,a.x,a.y,x,y);
}

export function bombAction(map,bomb,a) {
  if(!bomb||bomb.resolved||a.hp<=0||a.grounded===false)return null;
  if(bomb.planted)return a.team===0&&nearObjective(map,a,bomb.x,bomb.y,1.6)?{type:'defuse',duration:a.kit?MATCH.kitTime:MATCH.defuseTime}:null;
  if(bomb.carrier!==a)return null;
  for(const [site,{point}] of Object.entries(map.sites))if(nearObjective(map,a,...point,1.5))return {type:'plant',duration:MATCH.plantTime,site};
  return null;
}

// Interaction must remain uninterrupted, stationary, and on the ground.
export function stepBomb(map,bomb,actors,dt,wantsInteraction) {
  if(bomb.resolved)return null;
  if(bomb.carrier?.hp<=0) {
    bomb.x=bomb.carrier.x; bomb.y=bomb.carrier.y; bomb.carrier=null; bomb.dropped=true;
  }
  if(bomb.dropped) {
    const picker=actors.find(a=>a.team===1&&a.hp>0&&nearObjective(map,a,bomb.x,bomb.y,1));
    if(picker){bomb.carrier=picker;bomb.dropped=false;}
  }
  const candidates=actors.filter(a=>!a.moving&&wantsInteraction(a)&&bombAction(map,bomb,a));
  const user=candidates.includes(bomb.user)?bomb.user:candidates[0];
  const action=user?bombAction(map,bomb,user):null;
  if(user!==bomb.user||action?.type!==bomb.action){bomb.progress=0;bomb.user=user||null;bomb.action=action?.type||null;}
  const remaining=action?action.duration-bomb.progress:Infinity;
  if(bomb.planted&&bomb.timeLeft<=dt&&(!action||remaining>bomb.timeLeft)) {
    bomb.timeLeft=0;bomb.resolved='exploded';return 'exploded';
  }
  if(bomb.planted)bomb.timeLeft=Math.max(0,bomb.timeLeft-dt);
  if(!action)return null;
  bomb.progress+=dt;
  if(bomb.progress+1e-9<action.duration)return null;
  if(action.type==='plant') {
    bomb.planted=true;bomb.carrier=null;bomb.x=user.x;bomb.y=user.y;bomb.site=action.site;
    user.money=Math.min(MATCH.maxMoney,user.money+300);
    bomb.progress=0;bomb.user=null;bomb.action=null;
    return 'planted';
  }
  bomb.resolved='defused';user.money=Math.min(MATCH.maxMoney,user.money+300);return 'defused';
}

export function bombRoundWinner(actors,bomb,timedOut=false) {
  if(bomb.resolved==='defused')return 0;
  if(bomb.resolved==='exploded')return 1;
  const ct=actors.some(a=>a.team===0&&a.hp>0),t=actors.some(a=>a.team===1&&a.hp>0);
  if(!ct)return 1;
  if(!bomb.planted&&(!t||timedOut))return 0;
  return null;
}

export function rewardRound(actors,winner,losses,bomb) {
  losses[winner]=0;losses[1-winner]++;
  const winReward=bomb.resolved?3500:3250;
  const lossReward=Math.min(3400,1400+(losses[1-winner]-1)*500);
  for(const a of actors)a.money=Math.min(MATCH.maxMoney,a.money+(a.team===winner?winReward:lossReward)+(a.team===1&&winner===0&&bomb.planted?800:0));
}
