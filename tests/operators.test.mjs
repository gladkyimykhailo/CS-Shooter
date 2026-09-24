import test from 'node:test';
import assert from 'node:assert/strict';
import { stepActor, jumpActor, moveActor, actorPathClear, ACTOR_HEIGHT } from '../public/core.js';
import { drawOperators, hitOperator } from '../public/operators.js';

const map={size:10,grid:Array.from({length:10},()=>Array(10).fill(0))};
const body=(x,y=4,z=0)=>({x,y,z,angle:0,hp:100,grounded:z===0,weapon:'pistol',team:0});

test('solid bodies stop fast movement for both teams and allow sliding and retreat',()=>{
  for(const team of [0,1]){
    const a=body(2),b={...body(3),team};
    stepActor(map,a,3,0,.2,[a,b]);assert.ok(a.x<=2.52&&a.x>2.45);
    const before=a.x;stepActor(map,a,0,.7,.2,[a,b]);assert.ok(a.y>4.6);
    stepActor(map,a,-.5,0,.2,[a,b]);assert.ok(a.x<before-.4);
    const bot=body(2);moveActor(map,bot,3,0,[bot,b]);assert.equal(bot.x,2,'bot sweep cannot tunnel');
  }
});

test('body collisions respect altitude, corpses and overlapping spawns',()=>{
  const a=body(2),b=body(3);
  assert.equal(actorPathClear(map,a,4,4,[a,b]),false);
  b.hp=0;assert.equal(actorPathClear(map,a,4,4,[a,b]),true);
  b.hp=100;b.z=ACTOR_HEIGHT+.1;b.grounded=false;
  assert.equal(actorPathClear(map,a,4,4,[a,b]),true);
  b.z=0;b.x=2;stepActor(map,a,.7,0,.2,[a,b]);assert.ok(a.x>2.6);
});

test('falling onto another actor stops at the top and walks off into gravity',()=>{
  const a=body(3,4,1.8),b=body(3);a.vz=0;
  stepActor(map,a,0,0,.6,[a,b]);assert.ok(Math.abs(a.z-ACTOR_HEIGHT)<.002);assert.equal(a.grounded,true);
  stepActor(map,a,1,0,.3,[a,b]);stepActor(map,a,0,0,.6,[a,b]);assert.equal(a.z,0);
});

test('shots hit actual head, torso and side solids but miss air between the legs',()=>{
  const a=body(4);
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    a.angle=angle;
    assert.ok(hitOperator(map,a,{x:1,y:4,z:.65},{x:1,y:0,z:0}));
    assert.equal(hitOperator(map,a,{x:1,y:4,z:.95},{x:1,y:0,z:0}).head,true);
  }
  a.angle=0;
  assert.equal(hitOperator(map,a,{x:1,y:4,z:.15},{x:1,y:0,z:0}),null);
  assert.equal(hitOperator(map,a,{x:1,y:4.5,z:.65},{x:1,y:0,z:0}),null);
});

function render(actors,view=body(1),initial=Infinity){
  const w=160,h=120,depths=new Float32Array(w*h).fill(initial);let calls=0;
  drawOperators({fillRect(){calls++;}},map,actors,view,{w,h,projection:100,horizon:60,eye:.5,depths});
  return {depths,calls};
}

test('3D faces have varying depth, survive side views and clip at the camera plane',()=>{
  const a=body(3);
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    a.angle=angle;const {depths,calls}=render([a]);
    assert.ok(calls>20);const visible=[...depths].filter(Number.isFinite);
    assert.ok(Math.max(...visible)-Math.min(...visible)>.15);
  }
  const result=render([body(1.1)]);assert.ok(result.calls>0);
  assert.ok([...result.depths].every(d=>d>0&&!Number.isNaN(d)));
});

test('wall and per-pixel cover depth hide models; actor draw order does not change depth',()=>{
  const near=body(3),far=body(4);
  assert.equal(render([near],body(1),.5).calls,0);
  assert.deepEqual(render([near,far]).depths,render([far,near]).depths);
  const w=160,h=120,depths=new Float32Array(w*h).fill(Infinity);
  depths.fill(.5,60*w);
  drawOperators({fillRect(x,y){assert.ok(y<60);}},map,[near],body(1),{w,h,projection:100,horizon:60,eye:.5,depths});
  assert.ok([...depths.slice(0,60*w)].some(Number.isFinite));
});


test('an actor can jump off a body and falls when its support dies',()=>{
  const a=body(3,4,1.8),b=body(3);a.vz=0;
  stepActor(map,a,0,0,.6,[a,b]);assert.equal(jumpActor(map,a),true);
  stepActor(map,a,0,0,.8,[a,b]);assert.equal(a.z,ACTOR_HEIGHT);
  b.hp=0;stepActor(map,a,0,0,.8,[a,b]);assert.equal(a.z,0);
});
