import test from 'node:test';
import assert from 'node:assert/strict';
import { actorHeight, resetActorHeight, jumpActor, stepActor } from '../public/core.js';

function arena(height=0){
  return {size:8,heightScale:3,
    grid:Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x===0||y===0||x===7||y===7?1:0)),
    heights:Array.from({length:24},()=>Array.from({length:24},(_,x)=>x>=12?height:0))};
}
function body(map,x=2.5){const a={x,y:3.5};resetActorHeight(map,a);return a;}

test('jump lifts the body with gravity, rejects air jumps and lands exactly on the floor',()=>{
  const map=arena(),a=body(map);
  assert.equal(jumpActor(map,a),true);
  stepActor(map,a,0,0,.35);
  assert.ok(Math.abs(actorHeight(map,a)-.735)<1e-6);
  assert.equal(a.grounded,false);
  assert.equal(jumpActor(map,a),false);
  stepActor(map,a,0,0,.4);
  assert.equal(a.z,0);assert.equal(a.vz,0);assert.equal(a.grounded,true);
  assert.ok(a.landingSpeed>4);
  assert.equal(jumpActor(map,a),true);
});

test('jump trajectory is independent of frame rate and reset clears flight',()=>{
  const map=arena(),a=body(map),b=body(map);jumpActor(map,a);jumpActor(map,b);
  stepActor(map,a,0,0,.3);
  for(let i=0;i<30;i++)stepActor(map,b,0,0,.01);
  assert.ok(Math.abs(a.z-b.z)<1e-9);assert.ok(Math.abs(a.vz-b.vz)<1e-9);
  resetActorHeight(map,a);assert.equal(a.grounded,true);assert.equal(a.z,0);assert.equal(a.vz,0);
});

test('a jump clears a low ledge and lands on it; walking and a taller ledge remain blocked',()=>{
  for(const height of [.6,.9]){
    const map=arena(height),walker=body(map,3.5),a=body(map,3.5);
    stepActor(map,walker,1,0,.3);assert.ok(walker.x<4);
    jumpActor(map,a);stepActor(map,a,0,0,.28);
    stepActor(map,a,1,0,.2);stepActor(map,a,0,0,.5);
    if(height===.6){assert.ok(a.x>4.4);assert.equal(a.z,.6);assert.equal(a.grounded,true);}
    else{assert.ok(a.x<4);assert.equal(a.z,0);}
  }
});

test('walking off a ledge falls, and jumping cannot cross solid perimeter walls',()=>{
  const map=arena(.6),a=body(map,4.5);
  stepActor(map,a,-1,0,.2);assert.equal(a.grounded,false);assert.ok(a.z>0&&a.z<.6);
  stepActor(map,a,0,0,.6);assert.equal(a.z,0);assert.equal(a.grounded,true);
  jumpActor(map,a);stepActor(map,a,-8,0,1);
  assert.ok(a.x>=1.21);assert.equal(a.z,0);
});
