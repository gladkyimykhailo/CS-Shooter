// Browser-hosted matches. Signalling may be manual or automatic; gameplay uses WebRTC.
import { MP, C2S, S2C, createRoom, addPlayer, removePlayer, setReady, canStart, snapshotRoom, matchTick, teamScores, sanitizeNick, makeCode } from './net.js';
import { MAPS, WEAPONS, clamp, canStand, lineOfSight, applyDamage, actorHeight, resetActorHeight, jumpActor, stepActor, actorPathClear } from './core.js';

export function createPeerHost(options, nick, deliver, now=()=>Date.now()/1000) {
  const room=createRoom({...options,id:'peer-room',code:'',isPublic:false,hostId:'host',mapId:clamp(Math.floor(Number(options.mapId)||0),0,MAPS.length-1)});
  addPlayer(room,'host',nick);
  const send=(id,msg)=>deliver(id,msg);
  const broadcast=msg=>{for(const id of Object.keys(room.players))send(id,msg);};
  const publish=()=>broadcast({t:S2C.ROOM,room:snapshotRoom(room)});
  const error=(id,message)=>send(id,{t:S2C.ERROR,message});
  function spawn(p){
    const positions=p.team?MAPS[room.mapId].red:MAPS[room.mapId].blue;
    const mates=Object.values(room.players).filter(q=>q.team===p.team);
    [p.x,p.y]=positions[mates.indexOf(p)%positions.length];
    resetActorHeight(MAPS[room.mapId],p);
    p.angle=p.team?3.8:.72;p.hp=100;p.alive=true;p.moving=false;
    p.weapon='pistol';p.ammo=12;p.reloadingUntil=0;p.respawnIn=0;p.lastShotAt=-100;p.flashAt=0;
  }
  function finish(events){
    if(events.length)broadcast({t:S2C.EVENTS,events});
    if(room.phase==='finished')broadcast({t:S2C.MATCH_END,room:snapshotRoom(room)});
  }
  return {
    room,
    join(id,name){
      if(id==='host'||Object.hasOwn(room.players,id))return false;
      const result=addPlayer(room,id,name);
      if(!result.ok){error(id,result.message);return false;}
      send(id,{t:S2C.WELCOME,id,rooms:[]});send(id,{t:S2C.JOINED,room:snapshotRoom(room)});publish();return true;
    },
    leave(id){
      if(id==='host'||!Object.hasOwn(room.players,id))return;
      removePlayer(room,id);
      if(room.phase==='playing'&&!Object.values(room.players).some(p=>p.team!==room.players.host.team)){
        room.phase='finished';room.winner=room.players.host.team;
        finish([{t:'finish',winner:room.winner,score:teamScores(room)}]);
      }
      publish();
    },
    receive(id,msg){
      if(!msg||typeof msg.t!=='string'||!Object.hasOwn(room.players,id))return;
      const p=room.players[id];
      switch(msg.t){
        case C2S.READY: if(setReady(room,id,msg.ready))publish();break;
        case C2S.START:
          if(!canStart(room,id)){error(id,'Потрібні щонайменше двоє гравців і готовність усіх');break;}
          for(const actor of Object.values(room.players)){spawn(actor);actor.kills=0;actor.deaths=0;actor.ready=false;}
          room.phase='playing';room.timeLeft=room.matchTime;room.winner=-1;
          broadcast({t:S2C.MATCH_START,room:snapshotRoom(room)});break;
        case C2S.STATE: {
          if(room.phase!=='playing'||!p.alive)break;
          const x=Number(msg.x),y=Number(msg.y),angle=Number(msg.angle);
          if([x,y,angle].every(Number.isFinite)&&canStand(MAPS[room.mapId],x,y)&&actorPathClear(MAPS[room.mapId],p,x,y,Object.values(room.players))){
            p.x=x;p.y=y;p.angle=angle;p.moving=!!msg.moving;
            if(msg.jump===true)jumpActor(MAPS[room.mapId],p);
          }
          if(Object.hasOwn(WEAPONS,msg.weapon)&&msg.weapon!==p.weapon){p.weapon=msg.weapon;p.ammo=WEAPONS[p.weapon].size;p.reloadingUntil=0;}
          break;
        }
        case C2S.SHOOT: {
          if(room.phase!=='playing'||!p.alive||p.reloadingUntil||p.ammo<=0)break;
          const w=WEAPONS[p.weapon],time=now();
          if(msg.weapon!==p.weapon||time-p.lastShotAt<w.rate*.8)break;
          p.lastShotAt=time;p.flashAt=time;p.ammo--;
          const events=[];
          if(!p.ammo){p.reloadingUntil=time+w.reload;events.push({t:'reload',id});}
          const target=Object.hasOwn(room.players,msg.target)?room.players[msg.target]:null;
          if(target&&target.alive&&target.team!==p.team){
            const distance=Math.hypot(target.x-p.x,target.y-p.y),angle=Math.atan2(target.y-p.y,target.x-p.x);
            const diff=Math.abs(Math.atan2(Math.sin(angle-p.angle),Math.cos(angle-p.angle)));
            if(distance<=32&&diff<=.4&&lineOfSight(MAPS[room.mapId],p.x,p.y,target.x,target.y,actorHeight(MAPS[room.mapId],p)+.5,actorHeight(MAPS[room.mapId],target)+.5)){
              const amount=w.damage*(msg.head?(w.headMult||2):1)*(w.pellets>1?w.pellets*clamp(1-distance/14,.15,1):1);
              applyDamage(target,amount,!!msg.head);
              if(target.hp<=0){target.alive=false;target.deaths++;target.respawnIn=MP.RESPAWN_DELAY;p.kills++;events.push({t:'kill',source:id,target:target.id,sourceNick:p.nick,targetNick:target.nick});}
            }
          }
          events.push(...matchTick(room,0));finish(events);break;
        }
        case C2S.CHAT: {
          const text=String(msg.text||'').trim().slice(0,120);
          if(text)broadcast({t:S2C.EVENTS,events:[{t:'chat',id,nick:p.nick,text}]});break;
        }
        case C2S.LEAVE: this.leave(id);break;
      }
    },
    tick(dt){
      if(room.phase!=='playing')return;
      for(const p of Object.values(room.players))if(p.alive)stepActor(MAPS[room.mapId],p,0,0,dt,Object.values(room.players));
      const events=matchTick(room,dt);
      for(const event of events)if(event.t==='respawn')spawn(room.players[event.id]);
      for(const p of Object.values(room.players))if(p.reloadingUntil&&now()>=p.reloadingUntil){p.reloadingUntil=0;p.ammo=WEAPONS[p.weapon].size;}
      finish(events);
      if(room.phase==='playing')broadcast({t:S2C.SNAPSHOT,snap:snapshotRoom(room)});
    }
  };
}

export function encodePeerSignal(signal){return 'SECTOR1.'+btoa(encodeURIComponent(JSON.stringify(signal)));}
export function decodePeerSignal(text,type){
  const value=String(text||'').replace(/\s/g,'');
  if(value.length>100000||!value.startsWith('SECTOR1.'))throw new Error('Встав повне запрошення або відповідь із гри');
  let signal;
  try{signal=JSON.parse(decodeURIComponent(atob(value.slice(8))));}catch{throw new Error('Код пошкоджено — скопіюй його повністю');}
  if(!signal||signal.type!==type||typeof signal.id!=='string'||!/^p[a-zA-Z0-9-]{6,80}$/.test(signal.id)||typeof signal.sdp!=='string'||!signal.sdp.startsWith('v=0'))throw new Error(type==='offer'?'Потрібне запрошення від власника кімнати':'Потрібна відповідь друга на це запрошення');
  return signal;
}

export function createPeerClient(handlers, dependencies={}){
  const RTC=dependencies.RTC||globalThis.RTCPeerConnection;
  const peers=new Map();let host=null,closed=false,timer=null,pending=null,guestNick='',lastError='';
  const dispatch=msg=>{
    if(closed)return;
    const routes={welcome:['onWelcome',msg],joined:['onJoined',msg.room],room:['onRoom',msg.room],matchStart:['onMatchStart',msg.room],snapshot:['onSnapshot',msg.snap],events:['onEvents',msg.events],matchEnd:['onMatchEnd',msg.room],error:['onError',msg.message]};
    if(msg.t===S2C.WELCOME)client.myId=msg.id;
    const route=routes[msg.t];if(route)handlers[route[0]]?.(route[1]);
  };
  const sendChannel=(peer,msg)=>{
    if(peer?.channel?.readyState!=='open')return;
    if(peer.channel.bufferedAmount>=262144&&[C2S.STATE,S2C.SNAPSHOT].includes(msg.t))return;
    try{peer.channel.send(JSON.stringify(msg));}catch{}
  };
  const fail=message=>{lastError=message;handlers.onError?.(message);};
  function removePeer(id,notifyClose=true){
    const peer=peers.get(id);if(!peer)return;
    peers.delete(id);clearTimeout(peer.timeout);clearTimeout(peer.disconnectTimer);
    peer.cancelGather?.();peer.pc.onconnectionstatechange=null;peer.pc.ondatachannel=null;
    if(peer.channel){peer.channel.onclose=null;peer.channel.onmessage=null;peer.channel.onopen=null;peer.channel.onerror=null;}
    peer.pc.close();if(pending===id)pending=null;
    if(host)host.leave(id);
    else if(!closed){client.connected=false;if(notifyClose)handlers.onClose?.(lastError);}
  }
  function newPeer(id){
    if(!RTC)throw new Error('Цей браузер не підтримує гру напряму. Відкрий гру в сучасному Chrome або Firefox');
    const pc=new RTC({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]});
    const peer={pc,channel:null,id};peers.set(id,peer);
    pc.onconnectionstatechange=()=>{
      if(pc.connectionState==='failed'){fail('Не вдалося з’єднатися напряму. Спробуйте іншу мережу або режим із сервером');removePeer(id);}
      else if(pc.connectionState==='disconnected'){
        clearTimeout(peer.disconnectTimer);peer.disconnectTimer=setTimeout(()=>removePeer(id),10000);
      }else if(pc.connectionState==='connected')clearTimeout(peer.disconnectTimer);
    };
    return peer;
  }
  function wire(peer,channel){
    if(closed||!peers.has(peer.id)){channel.close?.();return;}
    peer.channel=channel;
    channel.onopen=()=>{
      if(closed||!peers.has(peer.id))return;
      clearTimeout(peer.timeout);
      if(host){if(pending===peer.id)pending=null;}
      else{client.connected=true;sendChannel(peer,{t:C2S.HELLO,nick:guestNick});}
    };
    channel.onmessage=event=>{
      if(closed||typeof event.data!=='string'||event.data.length>32768)return;
      let msg;try{msg=JSON.parse(event.data);}catch{return;}
      if(!msg||typeof msg.t!=='string')return;
      if(host){
        if(msg.t===C2S.HELLO){if(!host.join(peer.id,msg.nick)&&!host.room.players[peer.id])removePeer(peer.id);}
        else if(msg.t===C2S.LEAVE)removePeer(peer.id);
        else host.receive(peer.id,msg);
      }else dispatch(msg);
    };
    channel.onclose=()=>removePeer(peer.id);
    channel.onerror=()=>{fail('Зв’язок із гравцем перервано');removePeer(peer.id);};
  }
  async function gather(peer,description){
    client.signalWarning='';
    await peer.pc.setLocalDescription(description);
    if(closed||!peers.has(peer.id))throw new Error('Запрошення скасовано');
    if(peer.pc.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{
      let finished=false;
      const finish=error=>{
        if(finished)return;finished=true;
        clearTimeout(timeout);peer.pc.removeEventListener('icegatheringstatechange',check);
        peer.pc.removeEventListener('icecandidate',candidate);peer.cancelGather=null;
        error?reject(error):resolve();
      };
      const check=()=>{if(peer.pc.iceGatheringState==='complete')finish();};
      const candidate=event=>{if(event.candidate===null)finish();};
      // A stalled STUN request must not discard usable candidates. Export a
      // snapshot at the deadline; later candidates are not manually signalled.
      const timeout=setTimeout(()=>finish(),dependencies.iceGatheringTimeoutMs??15000);
      peer.cancelGather=()=>finish(new Error('Запрошення скасовано'));
      peer.pc.addEventListener('icegatheringstatechange',check);
      peer.pc.addEventListener('icecandidate',candidate);check();
    });
    if(closed||!peers.has(peer.id))throw new Error('Запрошення скасовано');
    const sdp=peer.pc.localDescription?.sdp||'';
    const candidates=[...sdp.matchAll(/^a=candidate:[^\r\n]+\btyp (host|srflx|prflx|relay)\b/gm)];
    if(!candidates.length)throw new Error('Браузер не знайшов жодної адреси для прямого зв’язку. Спробуй іншу мережу або режим із ігровим сервером.');
    if(candidates.every(candidate=>candidate[1]==='host'))client.signalWarning='Знайдено лише локальні адреси. Спробуйте спільний Wi-Fi; між різними мережами може знадобитися ігровий сервер.';
    else if(peer.pc.iceGatheringState!=='complete')client.signalWarning='Пошук адрес ще триває. Код містить уже знайдені адреси; якщо з’єднання не вдасться, створи нове запрошення.';
    return sdp;
  }
  const client={
    kind:'peer',connected:false,myId:null,signalWarning:'',
    host(options,nick){
      if(closed||host||peers.size)throw new Error('Кімнату вже створено');
      host=createPeerHost(options,nick,(id,msg)=>id==='host'?dispatch(msg):sendChannel(peers.get(id),msg));
      client.connected=true;client.myId='host';
      dispatch({t:S2C.WELCOME,id:'host',rooms:[]});dispatch({t:S2C.JOINED,room:snapshotRoom(host.room)});
      let last=Date.now();timer=setInterval(()=>{const current=Date.now();host.tick(Math.min(2,(current-last)/1000));last=current;},1000/MP.TICK_HZ);
      return snapshotRoom(host.room);
    },
    async invite({parallel=false}={}){
      if(closed||!host||host.room.phase!=='lobby')throw new Error('Запрошувати друзів можна в лобі кімнати');
      if(Object.keys(host.room.players).length>=host.room.maxPlayers)throw new Error('Кімната заповнена');
      if(pending&&!parallel)removePeer(pending);
      const id='p'+(globalThis.crypto?.randomUUID?.()||makeCode()+Date.now().toString(36));
      const peer=newPeer(id);pending=id;wire(peer,peer.pc.createDataChannel('sector'));
      try{
        const sdp=await gather(peer,await peer.pc.createOffer());
        if(closed||!peers.has(id))throw new Error('Запрошення скасовано');
        return encodePeerSignal({type:'offer',id,sdp});
      }catch(error){removePeer(id);throw error;}
    },
    async answer(text,nick){
      if(closed||host||peers.size)throw new Error('Спершу вийди з поточної кімнати');
      const signal=decodePeerSignal(text,'offer');guestNick=sanitizeNick(nick);
      const peer=newPeer(signal.id);peer.pc.ondatachannel=event=>wire(peer,event.channel);
      try{
        await peer.pc.setRemoteDescription({type:'offer',sdp:signal.sdp});
        const sdp=await gather(peer,await peer.pc.createAnswer());
        if(closed||!peers.has(signal.id))throw new Error('Приєднання скасовано');
        if(peer.channel?.readyState!=='open')peer.timeout=setTimeout(()=>{fail('Відповідь не прийнято або мережа блокує з’єднання. Спробуй нове запрошення');removePeer(signal.id);},180000);
        return encodePeerSignal({type:'answer',id:signal.id,sdp});
      // Setup errors belong to the pending answer operation. A disconnect
      // callback here would tear down the UI before it can display that error.
      }catch(error){removePeer(signal.id,false);throw error;}
    },
    async accept(text){
      const signal=decodePeerSignal(text,'answer');
      const peer=peers.get(signal.id);
      if(closed||!host||!peer)throw new Error('Ця відповідь не відповідає поточному запрошенню');
      if(peer.pc.remoteDescription)throw new Error('Цю відповідь уже прийнято');
      await peer.pc.setRemoteDescription({type:'answer',sdp:signal.sdp});
      if(peer.channel?.readyState!=='open')peer.timeout=setTimeout(()=>{fail('Мережа блокує пряме з’єднання. Спробуйте іншу мережу або режим із сервером');removePeer(signal.id);},30000);
    },
    cancelInvite(id){const peer=peers.get(id);if(host&&peer?.channel?.readyState!=='open')removePeer(id);},
    send(msg){if(closed)return;if(host)host.receive('host',msg);else sendChannel([...peers.values()][0],msg);},
    close(){
      if(closed)return;closed=true;client.connected=false;clearInterval(timer);
      for(const id of [...peers.keys()])removePeer(id);
    }
  };
  return client;
}
