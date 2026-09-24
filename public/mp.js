// Клієнт мультиплеєра: з'єднання, лобі, кімнати. Без прямого доступу до DOM гри:
// вся інтеграція — через handlers, які передає game.js.
//
// Адреса сервера — як у balloon-catcher:
//   поле «Адреса сервера» → явно вибрана адреса,
//   ?ws=  → пряме посилання-запрошення від друга,
//   ws.json → файл поруч зі сторінкою, який лишає `share` на комп'ютері господаря,
//   інакше — той самий хост, що віддав сторінку (крім статичних ігрових хостингів).
import { MP, C2S, S2C, sanitizeNick } from './net.js';

export const SHARE_TTL = 12 * 3600 * 1000;

// `var`, а не `let`: тестовий стенд клеїть модулі в один файл (mp.js останнім),
// тож код game.js виконується раніше за цю декларацію — звернення мусить не падати в TDZ.
var shared = '';

export function setSharedServerUrl(url) { shared = String(url || ''); }
export function getSharedServerUrl() { return shared; }

export function normalizeMpUrl(value) {
  const c = String(value || '').trim();
  if (!c) return null;
  try {
    const address = /^(?:https?|wss?):\/\//i.test(c) ? c :
      /^(?:localhost|\[[\da-f:]+\]|[\w-]+(?:\.[\w-]+)+)(?::\d+)?(?:[/?#]|$)/i.test(c)
        ? `${typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws'}://${c}` : c;
    const url = new URL(address);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (!['ws:', 'wss:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    const path = url.pathname.replace(/\/$/, '');
    url.pathname = path.endsWith(MP.PATH) ? path : path + MP.PATH;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

export function serverUrlFromQuery(search) {
  try {
    const q = new URLSearchParams(search ?? (typeof location !== 'undefined' ? location.search : ''));
    return normalizeMpUrl(q.get('ws'));
  } catch { return null; }
}

export function defaultMpUrl(custom) {
  // Неправильне введення не можна мовчки замінювати адресою вебсторінки.
  if (String(custom || '').trim()) return normalizeMpUrl(custom);
  // 1. Запрошення від друга: ?ws=wss://…
  const fromQuery = serverUrlFromQuery();
  if (fromQuery) return fromQuery;
  // 2. Адреса, знайдена у ws.json під час роботи (див. findSharedServer).
  const fromShared = normalizeMpUrl(shared);
  if (fromShared) return fromShared;
  if (typeof location !== 'undefined' && location.host) {
    if (!['http:', 'https:'].includes(location.protocol)) return null;
    const hostname = location.hostname || '';
    if (['github.io', 'itch.io', 'itch.zone'].some(domain => hostname === domain || hostname.endsWith('.' + domain))) return null;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${MP.PATH}`;
  }
  return null;
}

// Посилання-запрошення як у balloon-catcher: везе і код, і адресу з'єднання,
// щоб друг потрапив саме в цю кімнату, навіть якщо ws.json уже змінився.
export function inviteLink(code, wsUrl) {
  if (typeof location === 'undefined') return String(code || '');
  const url = new URL(location.pathname, location.origin);
  if (code) url.searchParams.set('room', String(code).toUpperCase());
  const ws = normalizeMpUrl(wsUrl) || defaultMpUrl();
  if (ws) url.searchParams.set('ws', ws);
  return url.href;
}

export function isTunnelUrl(value) {
  try { return new URL(value).hostname.endsWith('.trycloudflare.com'); } catch { return false; }
}

// Статичний сайт сам сервера не має, але `share` кладе поруч `ws.json`
// з адресою тунелю. Поки запис свіжий (12 год) — кімнати вмикаються.
export async function findSharedServer() {
  try {
    if (typeof fetch === 'undefined' || typeof location === 'undefined') return null;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : 0;
    let res;
    try {
      res = await fetch('./ws.json', { cache: 'no-store', signal: ctrl?.signal });
    } finally { if (timer) clearTimeout(timer); }
    if (!res || !res.ok) return null;
    const data = await res.json();
    if (!data?.url || Date.now() - (data.ts ?? 0) > SHARE_TTL) return null;
    const url = normalizeMpUrl(data.url);
    if (!url) return null;
    if (location.protocol === 'https:' && !url.startsWith('wss:')) return null;
    setSharedServerUrl(url);
    if (typeof document !== 'undefined') document.body?.classList?.remove('no-online');
    return url;
  } catch { return null; }
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
    connected: false, connecting:true, myId: null, url,
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
