import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, floorHeight, canTraverse, moveActor, findPath, lineOfSight } from '../public/core.js';
import { terrainColumn, drawTerrain } from '../public/terrain.js';

const mirage=MAPS.find(m=>m.id==='mirage');

test('every stair can be climbed and descended in small physical steps',()=>{
  for(const map of MAPS.filter(m=>m.heights))for(const s of map.stairs){
    const length=s.axis==='x'?s.w:s.h;
    const actor={x:s.x+s.w/2,y:s.y+s.h/2};
    actor[s.axis]=(s.axis==='x'?s.x:s.y)+.25;
    const start={...actor},heights=[floorHeight(map,actor.x,actor.y)];
    const distance=length-.5,count=Math.ceil(distance/.05),delta=distance/count;
    for(let i=0;i<count;i++){
      moveActor(map,actor,s.axis==='x'?delta:0,s.axis==='y'?delta:0);
      heights.push(actor.z);
    }
    assert.ok(Math.abs(actor[s.axis]-start[s.axis]-distance)<1e-6,`stair ${s.x},${s.y} is traversable`);
    assert.ok(Math.max(...heights)-Math.min(...heights)>s.rise*.8);
    for(let i=1;i<heights.length;i++){assert.ok((heights[i]-heights[i-1])*s.dir>=-1e-6);assert.ok(Math.abs(heights[i]-heights[i-1])<=.1);}
    for(let i=0;i<count;i++)moveActor(map,actor,s.axis==='x'?-delta:0,s.axis==='y'?-delta:0);
    assert.ok(Math.abs(actor[s.axis]-start[s.axis])<1e-6);
    assert.ok(Math.abs(actor.z-heights[0])<1e-6);
  }
});

test('bot paths follow the same climbable surfaces as movement',()=>{
  for(const map of MAPS.filter(m=>m.heights))for(const area of map.callouts){
    const actor={x:map.blue[0][0],y:map.blue[0][1]};
    const path=findPath(map,actor.x,actor.y,...area.point);
    if(area.name!=='CT')assert.ok(path.length,area.name);
    for(const p of path){
      assert.ok(canTraverse(map,actor.x,actor.y,p.x,p.y),area.name);
      moveActor(map,actor,p.x-actor.x,p.y-actor.y);
      assert.ok(Math.hypot(actor.x-p.x,actor.y-p.y)<1e-6,area.name);
    }
  }
});

function ledgeMap(){
  const size=8,heightScale=3;
  return {size,heightScale,wall:'#c5a273',floor:'#b19a77',light:'#f3dfb3',
    grid:Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>x===0||y===0||x===size-1||y===size-1?1:0)),
    ground:Array.from({length:size},()=>Array(size).fill(0)),
    heights:Array.from({length:size*3},()=>Array.from({length:size*3},(_,x)=>x>=12?.9:0))};
}

test('a high platform blocks climbing its side, tunnelling and low shots',()=>{
  const map=ledgeMap(),actor={x:3.5,y:3.5};
  assert.equal(canTraverse(map,3.5,3.5,4.5,3.5),false);
  moveActor(map,actor,2,0);assert.ok(actor.x<4);assert.equal(actor.z,0);
  assert.equal(lineOfSight(map,2.5,3.5,5.5,3.5,.5,.5),false);
  assert.equal(lineOfSight(map,2.5,3.5,5.5,3.5,1.2,1.4),true);
});

test('terrain ray resolves balcony treads as separate horizontal and vertical surfaces',()=>{
  const surfaces=terrainColumn(mirage,18.5,36.5,1,0);
  const risers=surfaces.filter(s=>s.kind==='riser');
  assert.equal(risers.length,15);
  assert.ok(Math.abs(risers[0].near-.5)<1e-6);
  assert.ok(Math.abs(risers.at(-1).high-.9)<1e-6);
  assert.ok(surfaces.some(s=>s.kind==='floor'&&s.z===.9));
  for(const [rx,ry] of [[1,0],[0,1],[-1,0],[0,-1]])for(const s of terrainColumn(mirage,20.5,36.5,rx,ry)){
    assert.ok(Number.isFinite(s.near)&&s.near>=0);
    if(s.kind==='floor')assert.ok(Number.isFinite(s.far)&&s.far>=s.near);
  }
});

test('per-pixel terrain depth hides a target behind a riser but preserves sky',()=>{
  const map=ledgeMap(),w=80,h=60,depths=new Float32Array(w*h),zbuffer=new Float32Array(w);
  const ctx={fillRect(){},drawImage(){}};
  drawTerrain(ctx,map,{x:2.5,y:3.5,angle:0},{w,h,fov:.78,projection:50,horizon:30,eye:.5,colStep:1,depths,zbuffer,wallTextures:[null,{}]});
  assert.ok(Math.abs(depths[30*w+40]-1.5)<1e-6,'vertical face lies in front of the far wall');
  assert.ok(Math.abs(zbuffer[40]-4.5)<1e-6);
  assert.ok(depths[59*w+40]<1.5,'near floor occludes the bottom of the face');
  assert.equal(depths[0*w+40],Infinity,'sky above the wall is clear');
  assert.ok([...depths].every(v=>!Number.isNaN(v)&&v>0));
});
