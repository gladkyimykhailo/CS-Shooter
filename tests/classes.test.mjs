import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from '../server.mjs';
import { CLASSES, classAppearance, classLoadout, getClass } from '../public/core.js';
import { drawOperators } from '../public/operators.js';

const waitFor=async fn=>{for(let i=0;i<250;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Timed out waiting for server state');};

test('all classes have distinct skins that reach the actual combat renderer',()=>{
  assert.equal(CLASSES.length,10);assert.equal(new Set(CLASSES.map(c=>c.id)).size,10);
  const colors=new Set();
  for(const c of CLASSES)for(let skin=0;skin<3;skin++){
    const look=classAppearance(c.id,skin);colors.add(look.color);
    const styles=new Set(),ctx={fillRect(){styles.add(this.fillStyle);}};
    const map={size:10,grid:Array.from({length:10},()=>Array(10).fill(0))};
    const actor={...classLoadout(c.id),x:3,y:4,z:0,angle:0,team:0,skin};
    drawOperators(ctx,map,[actor],{x:1,y:4,z:0,angle:0},{w:100,h:100,projection:70,horizon:50,eye:.5,depths:new Float32Array(10000).fill(Infinity)});
    assert.ok(styles.size>5);
    const other=new Set(),otherCtx={fillRect(){other.add(this.fillStyle);}};
    drawOperators(otherCtx,map,[{...actor,skin:(skin+1)%3}],{x:1,y:4,z:0,angle:0},{w:100,h:100,projection:70,horizon:50,eye:.5,depths:new Float32Array(10000).fill(Infinity)});
    assert.notDeepEqual(styles,other,'combat palette must change with the selected skin');
  }
  assert.equal(colors.size,30);assert.equal(getClass('invalid').id,'assault');
});

test('WebSocket server owns class health and restores the selected kit on respawn',async()=>{
  const {server,rooms,close}=startServer(0);const sockets=[];
  await new Promise(r=>server.once('listening',r));
  async function connect(nick){
    const ws=new WebSocket(`ws://localhost:${server.address().port}/mp`);sockets.push(ws);const messages=[];
    ws.on('message',raw=>messages.push(JSON.parse(String(raw))));
    await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
    const send=msg=>ws.send(JSON.stringify(msg));send({t:'hello',nick});
    await waitFor(()=>messages.some(m=>m.t==='welcome'));
    return {send,messages,id:messages.find(m=>m.t==='welcome').id};
  }
  try{
    const a=await connect('Танк'),b=await connect('Розвідник');
    a.send({t:'create',name:'Classes',isPublic:true});await waitFor(()=>rooms.size===1);
    const room=[...rooms.values()][0];b.send({t:'join',id:room.id});await waitFor(()=>Object.keys(room.players).length===2);
    a.send({t:'loadout',classId:'tank',skin:2,glove:1,hp:999});b.send({t:'loadout',classId:'scout',skin:1});
    a.send({t:'ready',ready:true});b.send({t:'ready',ready:true});await waitFor(()=>Object.values(room.players).every(p=>p.ready));
    a.send({t:'start'});await waitFor(()=>room.phase==='playing');
    const tank=room.players[a.id],scout=room.players[b.id];
    assert.equal(tank.hp,160);assert.equal(tank.weapon,'deagle');assert.equal(tank.ammo,7);assert.equal(tank.skin,2);
    assert.equal(scout.hp,80);assert.equal(scout.weapon,'p250');
    a.send({t:'loadout',classId:'scout',skin:0});
    await waitFor(()=>a.messages.some(m=>m.t==='snapshot'));
    assert.equal(tank.classId,'tank');assert.equal(tank.skin,2);
    tank.hp=0;tank.alive=false;tank.respawnIn=.01;tank.weapon='rifle';
    await waitFor(()=>tank.alive);assert.equal(tank.hp,160);assert.equal(tank.weapon,'deagle');assert.equal(tank.ammo,7);
    await waitFor(()=>b.messages.some(m=>m.t==='snapshot'&&m.snap.players.some(p=>p.id===a.id&&p.classId==='tank'&&p.skin===2&&p.hp===160)));
  }finally{for(const ws of sockets)ws.terminate();await close();}
});
