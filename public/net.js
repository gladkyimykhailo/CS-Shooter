// Спільна логіка мультиплеєра: протокол, кімнати, життєвий цикл матчу.
// Чистий модуль без DOM і Node API — використовується браузером, server.mjs і тестами.
export const MP = {
  PATH: '/mp',
  TICK_HZ: 15,
  MAX_PLAYERS: 6,
  KILL_TARGET: 20,
  MATCH_TIME: 300,
  RESPAWN_DELAY: 3,
  CODE_LEN: 6,
};

// Типи повідомлень клієнт -> сервер
export const C2S = {
  HELLO: 'hello', LIST: 'list', CREATE: 'create', JOIN: 'join', JOIN_CODE: 'joinCode',
  LEAVE: 'leave', READY: 'ready', START: 'start', STATE: 'state', SHOOT: 'shoot', CHAT: 'chat',
};
// Типи повідомлень сервер -> клієнт
export const S2C = {
  WELCOME: 'welcome', ROOMS: 'rooms', JOINED: 'joined', ROOM: 'room',
  MATCH_START: 'matchStart', SNAPSHOT: 'snapshot', EVENTS: 'events', MATCH_END: 'matchEnd', ERROR: 'error',
};

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < MP.CODE_LEN; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}

export function sanitizeNick(nick) {
  const clean = String(nick ?? '').trim().replace(/\s+/g, ' ').slice(0, 16);
  return clean || 'БОЄЦЬ';
}

export function sanitizeRoomName(name) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return clean || 'КІМНАТА';
}

export function createRoom({ id, code, name, isPublic, mapId, maxPlayers, killTarget, matchTime, hostId }) {
  return {
    id, code, name: sanitizeRoomName(name), isPublic: !!isPublic,
    mapId: Number.isInteger(mapId) ? mapId : 0,
    maxPlayers: Math.min(MP.MAX_PLAYERS, Math.max(2, Math.floor(maxPlayers) || 6)),
    killTarget: Math.min(50, Math.max(5, Math.floor(killTarget) || MP.KILL_TARGET)),
    matchTime: Math.min(900, Math.max(60, Math.floor(matchTime) || MP.MATCH_TIME)),
    phase: 'lobby', hostId, timeLeft: 0, winner: -1,
    players: {},
  };
}

export function makePlayer(id, nick, team) {
  return {
    id, nick: sanitizeNick(nick), team, ready: false,
    alive: true, hp: 100, armor: 0, x: 0, y: 0, angle: 0, moving: false,
    weapon: 'pistol', ammo: 12, reloadingUntil: 0, kills: 0, deaths: 0, respawnIn: 0,
    lastShotAt: 0, flashAt: 0,
  };
}

// Публічний опис кімнати для списку. Код приватної кімнати НЕ розкриваємо.
export function publicRoomInfo(room) {
  const players = Object.values(room.players);
  return {
    id: room.id, name: room.name, isPublic: room.isPublic,
    mapId: room.mapId, phase: room.phase,
    players: players.length, maxPlayers: room.maxPlayers,
  };
}

export function roomPlayerCount(room) { return Object.keys(room.players).length; }

export function assignTeam(room) {
  const counts = [0, 0];
  for (const p of Object.values(room.players)) counts[p.team]++;
  if (counts[0] <= counts[1]) return 0;
  return 1;
}

export function addPlayer(room, id, nick) {
  if (room.phase !== 'lobby') return { ok: false, message: 'Матч уже триває' };
  if (room.players[id]) return { ok: true };
  if (roomPlayerCount(room) >= room.maxPlayers) return { ok: false, message: 'Кімната заповнена' };
  room.players[id] = makePlayer(id, nick, assignTeam(room));
  if (!room.hostId) room.hostId = id;
  return { ok: true };
}

export function removePlayer(room, id) {
  delete room.players[id];
  if (room.hostId === id) {
    const rest = Object.keys(room.players);
    room.hostId = rest[0] || null;
    // Новий хост має бути готовим за замовчуванням? Ні — готовність скидаємо.
    for (const p of Object.values(room.players)) p.ready = false;
  }
  return { empty: roomPlayerCount(room) === 0, hostId: room.hostId };
}

export function setReady(room, id, ready) {
  const p = room.players[id];
  if (!p || room.phase !== 'lobby') return false;
  p.ready = !!ready;
  return true;
}

export function canStart(room, id) {
  if (room.hostId !== id) return false;
  const players = Object.values(room.players);
  if (players.length < 2) return false;
  // Реванш після завершеного матчу — одразу, без повторної готовності.
  if (room.phase === 'finished') return true;
  if (room.phase !== 'lobby') return false;
  return players.every(p => p.ready);
}

export function teamScores(room) {
  const score = [0, 0];
  for (const p of Object.values(room.players)) score[p.team] += p.kills;
  return score;
}

// Один тік матчу: таймер, відродження, умова завершення. Мутація room, повертає події.
export function matchTick(room, dt) {
  const events = [];
  if (room.phase !== 'playing') return events;
  room.timeLeft -= dt;
  for (const p of Object.values(room.players)) {
    if (!p.alive) {
      p.respawnIn -= dt;
      if (p.respawnIn <= 0) {
        p.alive = true; p.hp = 100; p.respawnIn = 0;
        events.push({ t: 'respawn', id: p.id });
      }
    }
  }
  const score = teamScores(room);
  let winner = -1;
  if (score[0] >= room.killTarget && score[0] !== score[1]) winner = 0;
  else if (score[1] >= room.killTarget && score[1] !== score[0]) winner = 1;
  else if (room.timeLeft <= 0) {
    room.timeLeft = 0;
    if (score[0] !== score[1]) winner = score[0] > score[1] ? 0 : 1;
  }
  if (winner !== -1 || room.timeLeft <= 0) {
    room.phase = 'finished'; room.winner = winner;
    events.push({ t: 'finish', winner, score });
  }
  return events;
}

export function snapshotRoom(room) {
  return {
    id: room.id, code: room.code, name: room.name, isPublic: room.isPublic,
    mapId: room.mapId, maxPlayers: room.maxPlayers, killTarget: room.killTarget,
    matchTime: room.matchTime, phase: room.phase, hostId: room.hostId,
    timeLeft: Math.max(0, Math.ceil(room.timeLeft)), winner: room.winner,
    score: teamScores(room),
    players: Object.values(room.players).map(p => ({ ...p })),
  };
}
