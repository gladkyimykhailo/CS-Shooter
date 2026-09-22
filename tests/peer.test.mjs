import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeerHost, createPeerClient, encodePeerSignal, decodePeerSignal } from '../public/peer.js';
import { C2S, S2C, MP } from '../public/net.js';
import { defaultMpUrl } from '../public/mp.js';
import { MAPS } from '../public/core.js';

const TEST_MAP_ID=MAPS.findIndex(map=>map.id==='furnace');
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
  f.advance(1.5);assert.equal(a.ammo,12);assert.equal(a.reloadingUntil,0);
  Object.assign(a,{x:2.5,y:3.5,angle:Math.PI/2});Object.assign(b,{x:2.5,y:6.5});
  for(let i=0;i<4;i++){f.host.receive('host',{t:C2S.SHOOT,weapon:'pistol',target:b.id});f.advance(.3);}
  assert.equal(b.alive,false);assert.equal(a.kills,1);assert.equal(b.deaths,1);
  f.advance(MP.RESPAWN_DELAY);assert.equal(b.alive,true);assert.equal(b.hp,100);assert.equal(b.ammo,12);
  Object.assign(a,{x:5.5,y:4.5,angle:0});Object.assign(b,{x:8.5,y:4.5});
  f.host.receive('host',{t:C2S.SHOOT,weapon:'pistol',target:b.id});assert.equal(b.hp,100,'wall blocks damage');
});

test('browser host ignores unknown identities, invalid movement and spoofed weapons; handles departures',()=>{
  const f=hostFixture();startDuel(f);const p=f.host.room.players.host;
  f.host.receive('intruder',{t:C2S.STATE,x:5,y:5});
  f.host.receive('host',{t:C2S.STATE,x:NaN,y:6,angle:0});assert.equal(p.x,2.5);
  f.host.receive('host',{t:C2S.STATE,x:0,y:0,angle:0});assert.equal(p.x,2.5);
  f.host.receive('host',{t:C2S.SHOOT,weapon:'kalash',target:'p123456'});assert.equal(p.ammo,12);
  f.host.receive('host',{t:C2S.STATE,x:2.5,y:3.5,angle:1,weapon:'kalash'});assert.equal(p.ammo,30);
  f.host.leave('p123456');assert.equal(f.host.room.phase,'finished');assert.equal(f.host.room.winner,0);
});

test('signalling validates type, corruption, length and session identity',()=>{
  const signal={id:'p123456',type:'offer',sdp:'v=0\r\nтест'};
  assert.deepEqual(decodePeerSignal(encodePeerSignal(signal),'offer'),signal);
  assert.throws(()=>decodePeerSignal(encodePeerSignal(signal),'answer'),/відповідь/);
  for(const text of ['wrong','SECTOR1.!','SECTOR1.'+'A'.repeat(100001),encodePeerSignal({...signal,id:'__proto__'})])assert.throws(()=>decodePeerSignal(text,'offer'));
});

// In-memory browser transport; production room and protocol handlers are unchanged.
function rtcFixture(){
  const pcs=new Map();let sequence=0;
  class Channel{
    readyState='connecting';bufferedAmount=0;
    send(text){if(this.readyState!=='open')throw new Error('closed');queueMicrotask(()=>this.other.onmessage?.({data:text}));}
  }
  class RTC{
    constructor(){this.id=++sequence;pcs.set(this.id,this);this.iceGatheringState='complete';this.connectionState='new';this.listeners=new Map();}
    createDataChannel(){return this.channel=new Channel();}
    async createOffer(){return {type:'offer',sdp:`v=0\r\npeer=${this.id}`};}
    async createAnswer(){return {type:'answer',sdp:`v=0\r\npeer=${this.id}`};}
    async setLocalDescription(d){this.localDescription=d;}
    async setRemoteDescription(d){
      this.remoteDescription=d;
      if(d.type==='answer'){
        const guest=pcs.get(Number(d.sdp.split('peer=')[1]));
        const channel=new Channel();this.channel.other=channel;channel.other=this.channel;guest.channel=channel;
        guest.ondatachannel({channel});
        this.channel.readyState=channel.readyState='open';
        this.connectionState=guest.connectionState='connected';
        this.channel.onopen?.();channel.onopen?.();
      }
    }
    addEventListener(name,fn){this.listeners.set(name,fn);}
    removeEventListener(name){this.listeners.delete(name);}
    close(){
      if(this.connectionState==='closed')return;this.connectionState='closed';
      if(this.channel){this.channel.readyState='closed';const other=this.channel.other;if(other){other.readyState='closed';queueMicrotask(()=>other.onclose?.());}}
    }
  }
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {RTC,pcs,flush};
}
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

test('server URLs are normalized and static GitHub Pages has no implicit backend',()=>{
  assert.equal(defaultMpUrl('https://example.org/'),'wss://example.org/mp');
  assert.equal(defaultMpUrl('wss://example.org/mp/'),'wss://example.org/mp');
  assert.equal(defaultMpUrl('javascript:alert(1)'),null);
  const old=globalThis.location;
  try{globalThis.location={host:'player.github.io',hostname:'player.github.io',protocol:'https:'};assert.equal(defaultMpUrl(''),null);}
  finally{if(old===undefined)delete globalThis.location;else globalThis.location=old;}
});
