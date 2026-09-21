// Клієнт мультиплеєра: з'єднання, лобі, кімнати. Без прямого доступу до DOM гри:
// вся інтеграція — через handlers, які передає game.js.
import { MP, C2S, S2C, sanitizeNick } from './net.js';

export function defaultMpUrl(custom) {
  const c = String(custom || '').trim();
  if (c) return c.replace(/\/$/, '') + (c.endsWith(MP.PATH) ? '' : MP.PATH);
  if (typeof location !== 'undefined' && location.host) {
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
  const client = {
    connected: false, myId: null,
    send(o) { try { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } catch {} },
    close() { try { ws.close(); } catch {} },
  };
  ws.onopen = () => { client.connected = true; handlers.onOpen && handlers.onOpen(); };
  ws.onmessage = ev => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    switch (msg.t) {
      case S2C.WELCOME: client.myId = msg.id; handlers.onWelcome && handlers.onWelcome(msg); break;
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
  ws.onclose = () => { client.connected = false; handlers.onClose && handlers.onClose(); };
  ws.onerror = () => { handlers.onError && handlers.onError('Зʼєднання розірвано'); };
  return client;
}

export function mpHelpers() {
  return { MP, C2S, S2C, sanitizeNick };
}
