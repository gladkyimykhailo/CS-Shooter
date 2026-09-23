import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignaling } from '../signaling.mjs';
import { createPeerCodeClient } from '../public/peer-code.js';
import { normalizeRoomCode, validRoomCode } from '../public/room-code.js';
import { C2S } from '../public/net.js';
import { rtcFixture } from './helpers/rtc.mjs';

function fixture(){
  const rtc=rtcFixture(),frames=[],sockets=[];
  const broker=createSignaling((ws,msg)=>queueMicrotask(()=>{if(ws.readyState===1)ws.onmessage?.({data:JSON.stringify(msg)});}),{generateCode:()=> '938A'});
  class WS{
    readyState=0;
    constructor(){sockets.push(this);queueMicrotask(()=>{if(this.readyState===0){this.readyState=1;this.onopen?.();}});}
    send(text){const msg=JSON.parse(text);frames.push(msg);queueMicrotask(()=>{if(this.readyState===1)broker.receive(this,msg);});}
    close(){if(this.readyState===3)return;this.readyState=3;broker.disconnect(this);this.onclose?.();}
  }
  const clients=[];
  function client(){
    const log=[],handlers={};
    for(const name of ['onCode','onJoined','onRoom','onMatchStart','onSnapshot','onClose','onError'])handlers[name]=value=>log.push({name,value});
    const instance=createPeerCodeClient('ws://test/mp',handlers,{WS,RTC:rtc.RTC});clients.push(instance);
    return {instance,log};
  }
  async function until(check){for(let i=0;i<50;i++){if(check())return;await rtc.flush();}assert.ok(check(),'expected signaling operation to complete');}
  return {client,frames,sockets,until,close:()=>clients.forEach(c=>c.close())};
}

test('four-character codes accept lowercase and Ukrainian lookalikes',()=>{
  assert.equal(normalizeRoomCode(' 938а '),'938A');assert.equal(validRoomCode('938а'),true);
  for(const value of ['', 'abc', 'abcde','ab$c'])assert.equal(validRoomCode(value),false);
});

test('friends join automatically using only a short code, then play over WebRTC',async t=>{
  const f=fixture();t.after(f.close);
  const host=f.client(),guest=f.client();host.instance.host({maxPlayers:2},'Host');
  await f.until(()=>host.instance.shortCode==='938A');
  guest.instance.join('938а','Friend');
  await f.until(()=>guest.log.some(e=>e.name==='onJoined'));
  assert.equal(guest.log.find(e=>e.name==='onJoined').value.players.length,2);
  host.instance.send({t:C2S.READY,ready:true});guest.instance.send({t:C2S.READY,ready:true});
  await f.until(()=>host.log.some(e=>e.name==='onRoom'&&e.value.players.every(p=>p.ready)));
  host.instance.send({t:C2S.START});await f.until(()=>guest.log.some(e=>e.name==='onMatchStart'));
  assert.ok(f.frames.some(m=>m.t==='peer:offer'));assert.ok(f.frames.some(m=>m.t==='peer:answer'));
  assert.ok(f.frames.every(m=>m.t.startsWith('peer:')),'gameplay never goes through the code service');
  host.instance.close();await f.until(()=>guest.log.some(e=>e.name==='onClose'));
  const late=f.client();late.instance.join('938A','Late');await f.until(()=>late.log.some(e=>e.name==='onClose'));
  assert.match(late.log.at(-1).value,/не знайдено/);
});

test('simultaneous guests get independent offers; full rooms reject additional joins',async t=>{
  const f=fixture();t.after(f.close);const host=f.client(),a=f.client(),b=f.client(),extra=f.client();
  host.instance.host({maxPlayers:3},'Host');await f.until(()=>host.instance.shortCode);
  a.instance.join('938A','A');b.instance.join('938A','B');
  await f.until(()=>a.instance.connected&&b.instance.connected);
  await f.until(()=>host.log.some(e=>e.name==='onRoom'&&e.value.players.length===3));
  extra.instance.join('938A','Extra');await f.until(()=>extra.log.some(e=>e.name==='onClose'));
  assert.match(extra.log.at(-1).value,/заповнена/);
  a.instance.close();await f.until(()=>host.log.at(-1).name==='onRoom'&&host.log.at(-1).value.players.length===2);
  const replacement=f.client();replacement.instance.join('938A','Replacement');await f.until(()=>replacement.instance.connected);
});

test('loss of code service invalidates the displayed code without closing existing game channels',async t=>{
  const f=fixture();t.after(f.close);const host=f.client(),guest=f.client();
  host.instance.host({},'Host');await f.until(()=>host.instance.shortCode);guest.instance.join('938A','Guest');
  await f.until(()=>guest.log.some(e=>e.name==='onJoined'));
  f.sockets[0].close();await f.until(()=>host.instance.shortCode==='');
  assert.equal(host.instance.connected,true);assert.equal(guest.instance.connected,true);
});

test('broker prevents cross-room signalling, expires abandoned joins, and bounds code collisions',()=>{
  let time=0;const messages=[],codes=['938A','938A','ABCD'];
  const broker=createSignaling((ws,msg)=>messages.push({ws,...msg}),{now:()=>time,generateCode:()=>codes.shift()||'938A'});
  broker.receive('host',{t:'peer:create'});broker.receive('other',{t:'peer:create'});
  assert.deepEqual(messages.filter(m=>m.t==='peer:created').map(m=>m.code),['938A','ABCD']);
  broker.receive('guest',{t:'peer:join',code:'938A'});
  const id=messages.find(m=>m.t==='peer:request').id;
  const before=messages.length;broker.receive('other',{t:'peer:offer',id,signal:'SECTOR1.fake'});
  assert.equal(messages.length,before,'another room cannot inject an offer');
  broker.receive('host',{t:'peer:phase',phase:'playing'});broker.receive('late',{t:'peer:join',code:'938A'});
  assert.match(messages.at(-1).message,/почався/);
  time=90001;broker.sweep();assert.ok(messages.some(m=>m.ws==='guest'&&/Час/.test(m.message||'')));
  broker.receive('collision',{t:'peer:create'});assert.match(messages.at(-1).message,/вільного коду/);
  broker.disconnect('host');broker.receive('gone',{t:'peer:join',code:'938A'});assert.match(messages.at(-1).message,/не знайдено/);
});
