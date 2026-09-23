import { randomInt, randomUUID } from 'node:crypto';
import { normalizeRoomCode, validRoomCode } from './public/room-code.js';

// Only room discovery and SDP exchange live here. Match state stays in WebRTC.
const SHORT_CODE_ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function createSignaling(send,{now=Date.now,generateCode=()=>Array.from({length:4},()=>SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)]).join('')}={}){
  const rooms=new Map(),members=new Map(),links=new Map(),rates=new Map();
  const error=(ws,message)=>send(ws,{t:'peer:error',message});
  function dropLink(link,message){
    if(!links.delete(link.id))return;
    link.room.guests.delete(link.id);members.delete(link.guest);
    send(link.room.host,{t:'peer:cancel',id:link.id});
    if(message)error(link.guest,message);
  }
  function disconnect(ws){
    const member=members.get(ws);members.delete(ws);rates.delete(ws);
    if(member?.host===ws){
      rooms.delete(member.code);
      for(const link of [...member.guests.values()])dropLink(link,'Власник закрив кімнату. Попроси новий код.');
    }else if(member)dropLink(member);
  }
  function sweep(){for(const link of [...links.values()])if(link.stage!=='connected'&&now()>link.expires)dropLink(link,'Час підключення минув. Спробуй увійти за кодом ще раз.');}
  function receive(ws,msg){
    if(!msg.t?.startsWith('peer:'))return false;
    sweep();
    const time=now();let rate=rates.get(ws);
    if(!rate||time-rate.since>10000){rate={since:time,count:0};rates.set(ws,rate);}
    if(++rate.count>40){if(rate.count===41)error(ws,'Забагато запитів. Зачекай 10 секунд.');return true;}
    if(msg.t==='peer:create'){
      if(members.has(ws)){error(ws,'Спершу вийди з кімнати');return true;}
      let code;for(let i=0;i<100;i++){const candidate=generateCode();if(validRoomCode(candidate)&&!rooms.has(normalizeRoomCode(candidate))){code=normalizeRoomCode(candidate);break;}}
      if(!code){error(ws,'Немає вільного коду. Повтори спробу.');return true;}
      const room={host:ws,code,maxPlayers:Math.min(6,Math.max(2,Math.floor(Number(msg.maxPlayers))||6)),phase:'lobby',guests:new Map()};
      rooms.set(code,room);members.set(ws,room);send(ws,{t:'peer:created',code});
    }else if(msg.t==='peer:join'){
      if(members.has(ws)){error(ws,'Спершу вийди з кімнати');return true;}
      const room=rooms.get(normalizeRoomCode(msg.code));
      if(!room){error(ws,'Кімнату не знайдено. Перевір код у друга.');return true;}
      if(room.phase!=='lobby'){error(ws,'Матч уже почався. Дочекайся наступного.');return true;}
      if(room.guests.size+1>=room.maxPlayers){error(ws,'Кімната заповнена');return true;}
      const link={id:randomUUID(),room,guest:ws,stage:'requested',expires:time+90000};
      room.guests.set(link.id,link);links.set(link.id,link);members.set(ws,link);
      send(ws,{t:'peer:waiting',code:room.code});send(room.host,{t:'peer:request',id:link.id});
    }else if(msg.t==='peer:phase'){
      const room=members.get(ws);if(room?.host===ws)room.phase=msg.phase==='lobby'?'lobby':'playing';
    }else{
      const link=links.get(msg.id);
      if(!link)return true;
      const host=link.room.host===ws,guest=link.guest===ws;
      if(!host&&!guest)return true;
      if(msg.t==='peer:reject'){dropLink(link,'Не вдалося з’єднатися напряму. Спробуйте іншу мережу або режим із сервером.');}
      else if(msg.t==='peer:connected'&&guest)link.stage='connected';
      else if(typeof msg.signal==='string'&&msg.signal.startsWith('SECTOR1.')&&msg.signal.length<=100000){
        if(msg.t==='peer:offer'&&host&&link.stage==='requested'){
          link.stage='offered';send(link.guest,{t:'peer:offer',id:link.id,signal:msg.signal});
        }else if(msg.t==='peer:answer'&&guest&&link.stage==='offered'){
          link.stage='answered';send(link.room.host,{t:'peer:answer',id:link.id,signal:msg.signal});
        }
      }
    }
    return true;
  }
  return {receive,disconnect,sweep};
}
