// Клієнт мультиплеєра: з'єднання, лобі, кімнати. Без прямого доступу до DOM гри:
// вся інтеграція — через handlers, які передає game.js.
import { MP, C2S, S2C, sanitizeNick } from './net.js';

export function defaultMpUrl(custom) {
  const c = String(custom || '').trim();
  if (c) {
    try {
      const url=new URL(c.replace(/^http:/,'ws:').replace(/^https:/,'wss:'));
      if(!['ws:','wss:'].includes(url.protocol))return null;
      const path=url.pathname.replace(/\/$/,'');
      url.pathname=path.endsWith(MP.PATH)?path:path+MP.PATH;
      return url.toString();
    } catch { return null; }
  }
  if (typeof location !== 'undefined' && location.host) {
    if(location.hostname?.endsWith('.github.io'))return null;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${MP.PATH}`;
  }
  return null;
}

export function createMpClient(url, handlers) {
  const WS = typeof WebSocket !== 'undefined' ? WebSocket : null;
  if (!WS || !url) {
    handlers.onError && handlers.onError(!WS ? 'Браузер не підтримує WebSocket' : 'Немає адреси сервера');
    return null;
  }
  let ws;
  try { ws = new WS(url); } catch {
    handlers.onError && handlers.onError('Не вдалося підключитися');
    return null;
  }
  let finished=false;
  const finish=()=>{if(finished)return;finished=true;clearTimeout(timeout);client.connected=false;client.connecting=false;handlers.onClose?.();};
  const timeout=setTimeout(()=>{if(!client.myId){handlers.onError?.('Сервер не відповів. Повтори спробу або перевір адресу');finish();try{ws.close();}catch{}}},10000);
  const client = {
    connected: false, connecting:true, myId: null,
    send(o) { try { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } catch {} },
    close() { finished=true;clearTimeout(timeout);client.connected=false;client.connecting=false;try { ws.close(); } catch {} },
  };
  ws.onopen = () => { if(finished)return;client.connected = true; handlers.onOpen && handlers.onOpen(); };
  ws.onmessage = ev => {
    if(finished)return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    switch (msg.t) {
      case S2C.WELCOME: clearTimeout(timeout);client.connecting=false;client.myId = msg.id; handlers.onWelcome && handlers.onWelcome(msg); break;
      case S2C.ROOMS: handlers.onRooms && handlers.onRooms(msg.rooms || []); break;
      case S2C.JOINED: handlers.onJoined && handlers.onJoined(msg.room); break;
      case S2C.ROOM: handlers.onRoom && handlers.onRoom(msg.room); break;
      case S2C.MATCH_START: handlers.onMatchStart && handlers.onMatchStart(msg.room); break;
      case S2C.SNAPSHOT: handlers.onSnapshot && handlers.onSnapshot(msg.snap); break;
      case S2C.EVENTS: handlers.onEvents && handlers.onEvents(msg.events || []); break;
      case S2C.MATCH_END: handlers.onMatchEnd && handlers.onMatchEnd(msg.room); break;
      case S2C.ERROR: handlers.onError && handlers.onError(msg.message || 'Помилка сервера'); break;
    }
  };
  ws.onclose = finish;
  ws.onerror = () => { if(!finished){handlers.onError?.('Сервер недоступний');finish();try{ws.close();}catch{}} };
  return client;
}

export function mpHelpers() {
  return { MP, C2S, S2C, sanitizeNick };
}
