import { createPeerClient, decodePeerSignal } from './peer.js';
import { normalizeRoomCode, validRoomCode } from './room-code.js';

export function createPeerCodeClient(url,handlers,dependencies={}){
  const WS=dependencies.WS||globalThis.WebSocket;
  let socket=null,closed=false,mode='',options=null,nick='',timer=null,linkId=null,retried=false,acknowledged=false;
  const jobs=new Map();
  const sendSignal=msg=>{if(!closed&&socket?.readyState===1)socket.send(JSON.stringify(msg));};
  const status=message=>{if(!closed)handlers.onStatus?.(message);};
  const finish=message=>{if(closed)return;client.close();handlers.onClose?.(message);};
  const phase=room=>{if(mode==='host')sendSignal({t:'peer:phase',phase:room.phase});};
  const peer=createPeerClient({...handlers,
    onJoined(room){clearTimeout(timer);if(mode==='guest')sendSignal({t:'peer:connected',id:linkId});phase(room);handlers.onJoined?.(room);},
    onRoom(room){phase(room);handlers.onRoom?.(room);},
    onMatchStart(room){phase(room);handlers.onMatchStart?.(room);},
    onMatchEnd(room){phase(room);handlers.onMatchEnd?.(room);},
    onClose:finish
  },dependencies);
  async function receive(msg){
    if(closed)return;
    if(msg.t==='peer:created'&&mode==='host'&&!peer.connected){
      acknowledged=true;
      clearTimeout(timer);client.shortCode=msg.code;handlers.onCode?.(msg.code);peer.host(options,nick);
    }else if(msg.t==='peer:waiting'&&mode==='guest'){
      acknowledged=true;
      clearTimeout(timer);status('КІМНАТУ ЗНАЙДЕНО · З’ЄДНУЄМО З ДРУГОМ…');
      timer=setTimeout(()=>finish('Не вдалося з’єднатися напряму. Спробуйте іншу мережу або режим із сервером.'),90000);
    }else if(msg.t==='peer:request'&&mode==='host'){
      jobs.set(msg.id,null);
      try{
        const signal=await peer.invite({parallel:true}),id=decodePeerSignal(signal,'offer').id;
        if(closed||!jobs.has(msg.id)){peer.cancelInvite(id);return;}
        jobs.set(msg.id,id);sendSignal({t:'peer:offer',id:msg.id,signal});
      }catch(error){if(!closed){jobs.delete(msg.id);handlers.onError?.(error.message);sendSignal({t:'peer:reject',id:msg.id});}}
    }else if(msg.t==='peer:offer'&&mode==='guest'&&!linkId){
      linkId=msg.id;
      try{const signal=await peer.answer(msg.signal,nick);sendSignal({t:'peer:answer',id:msg.id,signal});}
      catch(error){sendSignal({t:'peer:reject',id:msg.id});finish(error.message);}
    }else if(msg.t==='peer:answer'&&mode==='host'&&jobs.has(msg.id)){
      try{
        if(decodePeerSignal(msg.signal,'answer').id!==jobs.get(msg.id))throw new Error('Відповідь не відповідає запрошенню');
        await peer.accept(msg.signal);
      }catch(error){handlers.onError?.(error.message);sendSignal({t:'peer:reject',id:msg.id});}
    }else if(msg.t==='peer:cancel'&&mode==='host'){
      const id=jobs.get(msg.id);jobs.delete(msg.id);if(id)peer.cancelInvite(id);
    }else if(msg.t==='peer:error'){
      if(!peer.connected)finish(msg.message);
      else handlers.onError?.(msg.message);
    }
  }
  function begin(action){
    if(closed||socket)throw new Error('Спершу вийди з поточної кімнати');
    if(!url)throw new Error('Сервіс кодів не налаштований. Відкрий гру за адресою запущеного сервера.');
    if(!WS)throw new Error('Браузер не підтримує підключення за кодом');
    // Сюди можна передати вже відкрите з'єднання (див. mpWarmUp у game.js):
    // тоді діємо одразу, без очікування onopen. З'єднання в стані підключення
    // теж підходить — дію надішлемо, щойно воно відкриється.
    const warm=dependencies.socket;
    connect(action,warm&&(warm.readyState===1||warm.readyState===0)?warm:null);
  }
  function connect(action,warm=null){
    socket=warm||new WS(url);
    const current=socket;
    status('ПІДКЛЮЧЕННЯ ДО СЕРВІСУ КОДІВ…');
    clearTimeout(timer);
    const failure=`Не вдалося підключитися до сервісу кодів (${url}). Запусти npm start і відкрий http://localhost:4173 або вкажи адресу запущеного сервера. Для гри з другом обом потрібна одна доступна адреса.`;
    timer=setTimeout(()=>finish(failure),10000);
    socket.onmessage=event=>{
      if(closed||socket!==current)return;
      if(typeof event.data!=='string'||event.data.length>131072)return;
      let msg;try{msg=JSON.parse(event.data);}catch{return;}
      if(msg&&typeof msg.t==='string')receive(msg).catch(error=>finish(error.message));
    };
    const unavailable=()=>{
      if(closed||socket!==current)return;
      if(!peer.connected){
        // Прогрітий сокет міг померти, поки вкладка була у фоні.
        if(warm&&!retried&&!acknowledged){
          retried=true;current.onclose=null;current.onerror=null;current.onmessage=null;current.onopen=null;
          try{current.close();connect(action);}catch{finish(failure);}
          return;
        }
        finish(failure);return;
      }
      client.shortCode='';handlers.onCode?.('');
      status('Сервіс кодів відключився. Поточний прямий зв’язок залишається; для нових друзів створи кімнату знову.');
    };
    socket.onclose=unavailable;socket.onerror=unavailable;
    // Обробники готові до надсилання навіть через вже відкритий сокет.
    const start=()=>{try{sendSignal(action);}catch{unavailable();}};
    if(socket.readyState===1)start();else socket.onopen=start;
  }
  const client={
    kind:'peer',codeMode:true,shortCode:'',
    get connected(){return peer.connected;},get myId(){return peer.myId;},
    host(roomOptions,hostNick){mode='host';options=roomOptions;nick=hostNick;begin({t:'peer:create',maxPlayers:roomOptions.maxPlayers});},
    join(code,guestNick){if(!validRoomCode(code))throw new Error('Код має 4 літери або цифри, наприклад 938A');mode='guest';nick=guestNick;begin({t:'peer:join',code:normalizeRoomCode(code)});},
    send:msg=>peer.send(msg),
    close(){if(closed)return;closed=true;clearTimeout(timer);jobs.clear();peer.close();if(socket){socket.onclose=null;socket.onerror=null;socket.onmessage=null;socket.onopen=null;socket.close();}}
  };
  return client;
}
