import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeerHost, createPeerClient, encodePeerSignal, decodePeerSignal } from '../public/peer.js';
import { C2S, S2C, MP } from '../public/net.js';
import { defaultMpUrl } from '../public/mp.js';
import { MAPS } from '../public/core.js';
import { rtcFixture } from './helpers/rtc.mjs';

const TEST_MAP_ID=MAPS.findIndex(map=>map.id==='dust2');
function hostFixture(options={}){
  let time=100;const messages=[];
  const host=createPeerHost({maxPlayers:6,mapId:TEST_MAP_ID,...options},'Власник',(id,msg)=>messages.push({id,...structuredClone(msg)}),()=>time);
  return {host,messages,advance:dt=>{time+=dt;host.tick(dt);}};
}
function startDuel(f){
  assert.equal(f.host.join('p123456','Друг'),true);
  f.host.receive('host',{t:C2S.READY,ready:true});f.host.receive('p123456',{t:C2S.READY,ready:true});
  f.host.receive('host',{t:C2S.START});assert.equal(f.host.room.phase,'playing');
}

test('Mirage accepts movement in palace and respawns inside the larger map',()=>{
  const mapId=MAPS.findIndex(m=>m.id==='mirage'),map=MAPS[mapId],f=hostFixture({mapId});startDuel(f);
  const p=f.host.room.players.host;
  assert.deepEqual([p.x,p.y],map.blue[0]);
  f.host.receive('host',{t:C2S.STATE,x:32.5,y:32.5,angle:0});
  assert.deepEqual([p.x,p.y],[32.5,32.5]);
  f.host.receive('host',{t:C2S.STATE,x:map.size+1,y:32.5,angle:0});
  assert.deepEqual([p.x,p.y],[32.5,32.5]);
});

test('host simulates and broadcasts jump height, rejects air jumps and ignores supplied altitude',()=>{
  const f=hostFixture();startDuel(f);const p=f.host.room.players.host;
  const state={t:C2S.STATE,x:p.x,y:p.y,angle:p.angle,z:999};
  f.host.receive('host',state);assert.equal(p.z,0);
  f.host.receive('host',{...state,jump:true});f.advance(.35);
  assert.ok(Math.abs(p.z-.735)<1e-6);
  const snap=f.messages.filter(m=>m.t===S2C.SNAPSHOT).at(-1).snap;
  assert.equal(snap.players.find(p=>p.id==='host').z,p.z);
  f.host.receive('host',{...state,jump:true});assert.ok(Math.abs(p.vz)<1e-6);
  f.advance(.4);assert.equal(p.z,0);assert.equal(p.grounded,true);
  f.host.receive('host',{...state,jump:true});f.advance(.2);
  p.hp=0;p.alive=false;p.respawnIn=.1;f.advance(.2);
  assert.equal(p.alive,true);assert.equal(p.z,0);assert.equal(p.vz,0);assert.equal(p.grounded,true);
});

test('browser room: host-only start, balanced teams, ready states, capacity and rematch',()=>{
  const f=hostFixture({maxPlayers:2,matchTime:60});
  assert.equal(f.host.room.players.host.nick,'Власник');assert.equal(f.host.room.isPublic,false);
  f.host.receive('host',{t:C2S.START});assert.equal(f.host.room.phase,'lobby');
  startDuel(f);
  assert.deepEqual(Object.values(f.host.room.players).map(p=>p.team),[0,1]);
  assert.equal(f.host.join('pother1','Third'),false);
  f.advance(60);assert.equal(f.host.room.phase,'finished');
  assert.ok(f.messages.some(m=>m.t===S2C.MATCH_END));
  f.host.receive('p123456',{t:C2S.START});assert.equal(f.host.room.phase,'finished');
  f.host.receive('host',{t:C2S.START});assert.equal(f.host.room.phase,'playing');
  assert.equal(f.host.room.timeLeft,60);
});

test('browser combat: misses consume ammo, reload, hit validation, death and respawn',()=>{
  const f=hostFixture();startDuel(f);
  const a=f.host.room.players.host,b=f.host.room.players.p123456;
  for(let i=0;i<12;i++){f.host.receive('host',{t:C2S.SHOOT,weapon:'pistol',target:null});f.advance(.3);}
  assert.equal(a.ammo,0);assert.ok(a.reloadingUntil>0);
  f.advance(2.3);assert.equal(a.ammo,12);assert.equal(a.reloadingUntil,0);
  Object.assign(a,{x:20.5,y:8.5,angle:Math.PI/2});Object.assign(b,{x:20.5,y:11.5});
  for(let i=0;i<4;i++){f.host.receive('host',{t:C2S.SHOOT,weapon:'pistol',target:b.id});f.advance(.3);}
  assert.equal(b.alive,false);assert.equal(a.kills,1);assert.equal(b.deaths,1);
  f.advance(MP.RESPAWN_DELAY);assert.equal(b.alive,true);assert.equal(b.hp,100);assert.equal(b.ammo,12);
  Object.assign(a,{x:8.5,y:9.5,angle:0});Object.assign(b,{x:10.5,y:9.5});
  f.host.receive('host',{t:C2S.SHOOT,weapon:'pistol',target:b.id});assert.equal(b.hp,100,'wall blocks damage');
});

test('browser host ignores unknown identities, invalid movement and spoofed weapons; handles departures',()=>{
  const f=hostFixture();startDuel(f);const p=f.host.room.players.host;
  f.host.receive('intruder',{t:C2S.STATE,x:5,y:5});
  f.host.receive('host',{t:C2S.STATE,x:NaN,y:6,angle:0});assert.equal(p.x,MAPS[TEST_MAP_ID].blue[0][0]);
  f.host.receive('host',{t:C2S.STATE,x:0,y:0,angle:0});assert.equal(p.x,MAPS[TEST_MAP_ID].blue[0][0]);
  f.host.receive('host',{t:C2S.SHOOT,weapon:'kalash',target:'p123456'});assert.equal(p.ammo,12);
  f.host.receive('host',{t:C2S.STATE,x:20.5,y:8.5,angle:1,weapon:'kalash'});assert.equal(p.ammo,30);
  f.host.leave('p123456');assert.equal(f.host.room.phase,'finished');assert.equal(f.host.room.winner,0);
});

test('signalling validates type, corruption, length and session identity',()=>{
  const signal={id:'p123456',type:'offer',sdp:'v=0\r\nтест'};
  assert.deepEqual(decodePeerSignal(encodePeerSignal(signal),'offer'),signal);
  assert.throws(()=>decodePeerSignal(encodePeerSignal(signal),'answer'),/відповідь/);
  for(const text of ['wrong','SECTOR1.!','SECTOR1.'+'A'.repeat(100001),encodePeerSignal({...signal,id:'__proto__'})])assert.throws(()=>decodePeerSignal(text,'offer'));
});

// In-memory browser transport; production room and protocol handlers are unchanged.
function peerHandlers(){
  const log=[];const handlers={};
  for(const name of ['onWelcome','onJoined','onRoom','onMatchStart','onSnapshot','onEvents','onMatchEnd','onError','onClose'])handlers[name]=value=>log.push({name,value});
  return {log,handlers};
}

test('two browsers exchange invitation and answer, join, chat, start, synchronise, close',async t=>{
  const f=rtcFixture(),a=peerHandlers(),b=peerHandlers();
  const host=createPeerClient(a.handlers,{RTC:f.RTC}),guest=createPeerClient(b.handlers,{RTC:f.RTC});
  t.after(()=>{host.close();guest.close();});
  host.host({name:'Friends',maxPlayers:2},'Alpha');
  assert.equal(host.connected,true);assert.ok(a.log.some(m=>m.name==='onJoined'));
  const offer=await host.invite();const answer=await guest.answer(offer,'Bravo');
  assert.equal(guest.connected,false,'guest waits for host to accept');
  await host.accept(answer);await f.flush();
  assert.equal(guest.connected,true);assert.ok(guest.myId.startsWith('p'));
  assert.equal(b.log.find(m=>m.name==='onJoined').value.players.length,2);
  guest.send({t:C2S.CHAT,text:'Hello'});await f.flush();
  assert.ok(a.log.some(m=>m.name==='onEvents'&&m.value[0].text==='Hello'));
  host.send({t:C2S.READY,ready:true});guest.send({t:C2S.READY,ready:true});await f.flush();
  host.send({t:C2S.START});await f.flush();
  assert.ok(a.log.some(m=>m.name==='onMatchStart'));assert.ok(b.log.some(m=>m.name==='onMatchStart'));
  await new Promise(resolve=>setTimeout(resolve,90));await f.flush();
  assert.ok(b.log.some(m=>m.name==='onSnapshot'));
  host.close();await f.flush();assert.equal(guest.connected,false);assert.ok(b.log.some(m=>m.name==='onClose'));
});

test('each guest gets a separate invitation; old answers and closed sessions cannot join',async t=>{
  const f=rtcFixture(),a=peerHandlers(),b=peerHandlers(),c=peerHandlers();
  const host=createPeerClient(a.handlers,{RTC:f.RTC}),guest=createPeerClient(b.handlers,{RTC:f.RTC}),guest2=createPeerClient(c.handlers,{RTC:f.RTC});
  t.after(()=>{host.close();guest.close();guest2.close();});
  host.host({maxPlayers:4},'A');
  const oldOffer=await host.invite();const oldId=decodePeerSignal(oldOffer,'offer').id;
  const offer=await host.invite();
  await assert.rejects(host.accept(encodePeerSignal({type:'answer',id:oldId,sdp:'v=0'})),/поточному/);
  await host.accept(await guest.answer(offer,'B'));await f.flush();
  await host.accept(await guest2.answer(await host.invite(),'C'));await f.flush();
  assert.equal(a.log.filter(m=>m.name==='onRoom').at(-1).value.players.length,3);
  guest.close();await f.flush();
  assert.equal(a.log.filter(m=>m.name==='onRoom').at(-1).value.players.length,2);
  host.close();await assert.rejects(host.invite(),/лобі/);
});

test('cancelling ICE gathering releases the pending operation without exporting partial SDP',async t=>{
  const f=rtcFixture(),events=peerHandlers();
  class GatheringRTC extends f.RTC{constructor(){super();this.iceGatheringState='gathering';}}
  const host=createPeerClient(events.handlers,{RTC:GatheringRTC});t.after(()=>host.close());
  host.host({},'A');const invite=host.invite();
  const rejected=assert.rejects(invite,/скасовано/);
  await f.flush();host.close();await rejected;
});

test('failed guest setup preserves the original error and allows retry without a disconnect event',async t=>{
  const f=rtcFixture(),events=peerHandlers();let rejectOffer=true;
  class RetryRTC extends f.RTC{
    async setRemoteDescription(description){
      if(rejectOffer)throw new Error('Invalid remote SDP');
      return super.setRemoteDescription(description);
    }
  }
  const guest=createPeerClient(events.handlers,{RTC:RetryRTC});t.after(()=>guest.close());
  const offer=encodePeerSignal({type:'offer',id:'pretry123',sdp:'v=0\r\npeer=1'});
  await assert.rejects(guest.answer(offer,'Друг'),/Invalid remote SDP/);
  assert.equal(events.log.some(event=>event.name==='onClose'),false);
  assert.equal([...f.pcs.values()][0].connectionState,'closed');
  rejectOffer=false;
  assert.equal(decodePeerSignal(await guest.answer(offer,'Друг'),'answer').id,'pretry123');
});

test('stalled STUN gathering still exports collected candidates for both browsers',async t=>{
  const f=rtcFixture(),a=peerHandlers(),b=peerHandlers();
  class StalledRTC extends f.RTC{
    constructor(){super();this.iceGatheringState='gathering';}
  }
  const host=createPeerClient(a.handlers,{RTC:StalledRTC,iceGatheringTimeoutMs:5});
  const guest=createPeerClient(b.handlers,{RTC:StalledRTC,iceGatheringTimeoutMs:5});
  t.after(()=>{host.close();guest.close();});host.host({},'A');
  const offer=await host.invite(),answer=await guest.answer(offer,'B');
  for(const [text,type,client] of [[offer,'offer',host],[answer,'answer',guest]]){
    assert.match(decodePeerSignal(text,type).sdp,/a=candidate:/);
    assert.match(client.signalWarning,/лише локальні адреси/);
  }
  for(const pc of f.pcs.values())assert.equal(pc.listeners.size,0,'gathering listeners are removed');
  await host.accept(answer);await f.flush();
  assert.equal(guest.connected,true);
  assert.equal(b.log.find(event=>event.name==='onJoined').value.players.length,2);
});

test('deadline includes late STUN candidates and warns that gathering is incomplete',async t=>{
  const f=rtcFixture();
  class StalledRTC extends f.RTC{
    constructor(){super();this.iceGatheringState='gathering';}
  }
  const host=createPeerClient({}, {RTC:StalledRTC,iceGatheringTimeoutMs:20});
  t.after(()=>host.close());host.host({},'A');const result=host.invite();
  await f.flush();
  const pc=[...f.pcs.values()][0];
  pc.localDescription.sdp+='a=candidate:2 1 udp 1686052607 198.51.100.1 51000 typ srflx raddr 192.0.2.1 rport 50000\r\n';
  const offer=decodePeerSignal(await result,'offer');
  assert.match(offer.sdp,/typ srflx/);
  assert.match(host.signalWarning,/Пошук адрес ще триває/);
  assert.equal(pc.connectionState,'new','usable peer is retained');
});

test('empty candidate sets fail clearly on completion and timeout, and can be retried',async t=>{
  for(const state of ['complete','gathering']){
    const f=rtcFixture();let empty=true;
    class EmptyRTC extends f.RTC{
      constructor(){super();this.iceGatheringState=state;}
      async setLocalDescription(description){if(empty)this.localDescription=description;else await super.setLocalDescription(description);}
    }
    const host=createPeerClient({}, {RTC:EmptyRTC,iceGatheringTimeoutMs:5});
    t.after(()=>host.close());host.host({},'A');
    await assert.rejects(host.invite(),/не знайшов жодної адреси/);
    const pc=[...f.pcs.values()][0];
    assert.equal(pc.connectionState,'closed');assert.equal(pc.listeners.size,0);
    empty=false;assert.match(await host.invite(),/^SECTOR1\./);
  }
});

test('null ICE candidate finishes gathering without waiting for the deadline',async t=>{
  const f=rtcFixture();
  class GatheringRTC extends f.RTC{
    constructor(){super();this.iceGatheringState='gathering';}
  }
  const host=createPeerClient({}, {RTC:GatheringRTC});t.after(()=>host.close());host.host({},'A');
  const result=host.invite();await f.flush();const pc=[...f.pcs.values()][0];
  pc.listeners.get('icecandidate')({candidate:null});
  assert.match(await result,/^SECTOR1\./);assert.equal(pc.listeners.size,0);
});

test('server URLs are normalized and static GitHub Pages has no implicit backend',()=>{
  assert.equal(defaultMpUrl('https://example.org/'),'wss://example.org/mp');
  assert.equal(defaultMpUrl('wss://example.org/mp/'),'wss://example.org/mp');
  assert.equal(defaultMpUrl('javascript:alert(1)'),null);
  const old=globalThis.location;
  try{globalThis.location={host:'player.github.io',hostname:'player.github.io',protocol:'https:'};assert.equal(defaultMpUrl(''),null);}
  finally{if(old===undefined)delete globalThis.location;else globalThis.location=old;}
});

test('host rejects movement through a living player but accepts moving away and past a corpse',()=>{
  const f=hostFixture();startDuel(f);
  const p=f.host.room.players.host,q=f.host.room.players.p123456;
  Object.assign(p,{x:20.5,y:8.5,z:0});Object.assign(q,{x:20.5,y:9.5,z:0});
  f.host.receive('host',{t:C2S.STATE,x:20.5,y:10.5,angle:Math.PI/2});
  assert.equal(p.y,8.5);
  f.host.receive('host',{t:C2S.STATE,x:20.5,y:8,angle:Math.PI/2});assert.equal(p.y,8);
  q.hp=0;q.alive=false;
  f.host.receive('host',{t:C2S.STATE,x:20.5,y:10.5,angle:Math.PI/2});assert.equal(p.y,10.5);
});
