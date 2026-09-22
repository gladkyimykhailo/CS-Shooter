import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WEAPONS, createWeaponMotion, kickWeaponMotion, stepWeaponMotion, weaponWallProximity } from '../public/core.js';

test('spring recoil agrees at 30, 60 and 144 FPS and settles at rest',()=>{
  for(const id of Object.keys(WEAPONS)){
    const samples=[30,60,144].map(fps=>{
      const motion=createWeaponMotion();kickWeaponMotion(motion,id);
      for(let i=0;i<fps;i++)stepWeaponMotion(motion,id,{},1/fps);
      return motion;
    });
    for(const motion of samples){
      for(const key of Object.keys(motion)){
        assert.ok(Math.abs(motion[key].value-samples[0][key].value)<1e-8);
        assert.ok(Math.abs(motion[key].velocity)<.05,`${id}: ${key} settles`);
      }
    }
  }
});

test('weapon weight, aimed recoil, turn inertia and landing affect the spring',()=>{
  const pistol=createWeaponMotion(),shotgun=createWeaponMotion(),aimed=createWeaponMotion();
  kickWeaponMotion(pistol,'pistol');kickWeaponMotion(shotgun,'shotgun');kickWeaponMotion(aimed,'shotgun',true);
  for(const [motion,id] of [[pistol,'pistol'],[shotgun,'shotgun'],[aimed,'shotgun']])stepWeaponMotion(motion,id,{},.04);
  assert.ok(shotgun.kick.value>pistol.kick.value);
  assert.ok(aimed.kick.value<shotgun.kick.value);
  const moving=createWeaponMotion();
  stepWeaponMotion(moving,'rifle',{turn:2,side:1,landing:-2},.03);
  assert.ok(moving.x.value<0,'gun lags behind a right turn');
  assert.ok(moving.roll.value<0);
  assert.ok(moving.y.value>0,'landing carries the gun downward');
  for(let i=0;i<120;i++)stepWeaponMotion(moving,'rifle',{},1/60);
  assert.ok(Math.abs(moving.x.value)<.001);
  assert.ok(Math.abs(moving.y.value)<.001);
});

test('long barrels retract earlier; empty space and walls behind do not retract',()=>{
  const map=MAPS.find(candidate=>candidate.id==='furnace');
  assert.ok(map);
  assert.equal(weaponWallProximity(map,2.5,3.5,0,'rifle'),0);
  assert.equal(weaponWallProximity(map,5.3,4.5,0,'pistol'),0);
  assert.ok(weaponWallProximity(map,5.3,4.5,0,'rifle')>0);
  assert.ok(weaponWallProximity(map,5.7,4.5,0,'rifle')>.5);
  assert.equal(weaponWallProximity(map,5.7,4.5,Math.PI,'rifle'),0);
});

test('sustained fire and large timesteps keep every axis finite and bounded',()=>{
  const motion=createWeaponMotion();
  for(let i=0;i<500;i++){
    kickWeaponMotion(motion,'kalash');
    stepWeaponMotion(motion,'kalash',{turn:1000,look:-1000,wall:1,aiming:true},.11);
    for(const axis of Object.values(motion)){
      assert.ok(Number.isFinite(axis.value)&&Number.isFinite(axis.velocity));
      assert.ok(Math.abs(axis.value)<100);
    }
  }
  stepWeaponMotion(motion,'kalash',{},10);
  assert.ok(Math.abs(motion.kick.value)<.001);
});
