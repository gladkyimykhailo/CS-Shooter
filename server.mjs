import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { createSignaling } from './signaling.mjs';
import { normalizeRoomCode } from './public/room-code.js';
import {
  MP, C2S, S2C, makeCode, sanitizeNick, sanitizeRoomName,
  createRoom, publicRoomInfo, addPlayer, removePlayer, setReady,
  canStart, teamScores, matchTick, snapshotRoom, assignTeam,
} from './public/net.js';
import { MAPS, WEAPONS, clamp, lineOfSight, applyDamage, canStand, actorHeight, resetActorHeight, jumpActor, stepActor } from './public/core.js';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

let clientSeq = 0;
let roomSeq = 0;

function validMapId(id) {
  const n = Math.floor(Number(id));
  return Number.isInteger(n) && n >= 0 && n < MAPS.length ? n : 0;
}

function spawnFor(map, team, i) {
  const base = team === 0 ? map.blue : map.red;
  const p = base[i % base.length];
  return { x: p[0] + (Math.random() - 0.5) * 0.6, y: p[1] + (Math.random() - 0.5) * 0.6 };
}

export function startServer(port) {
  const rooms = new Map(); // roomId -> room
  const clients = new Map(); // ws -> {id, nick, roomId, stateCount, stateWindow}

  const server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/') pathname = '/index.html';
      const file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });

  const wss = new WebSocketServer({ server, path: MP.PATH, maxPayload: 128 * 1024 });
  const signaling=createSignaling(send);

  function send(ws, msg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function roomSockets(roomId) {
    const out = [];
    for (const [ws, c] of clients) if (c.roomId === roomId) out.push(ws);
    return out;
  }

  function broadcastRoom(room) {
    const snap = snapshotRoom(room);
    for (const ws of roomSockets(room.id)) send(ws, { t: S2C.ROOM, room: snap });
  }

  function broadcastEvents(room, events) {
    if (!events.length) return;
    for (const ws of roomSockets(room.id)) send(ws, { t: S2C.EVENTS, events });
  }

  function publicList() {
    return [...rooms.values()].filter(r => r.isPublic).map(publicRoomInfo);
  }

  function leaveRoom(ws, client) {
    const room = rooms.get(client.roomId);
    client.roomId = null;
    if (!room) return;
    const { empty } = removePlayer(room, client.id);
    if (empty) { rooms.delete(room.id); return; }
    if (room.phase === 'playing') {
      const counts = [0, 0];
      for (const p of Object.values(room.players)) counts[p.team]++;
      if (counts[0] === 0 || counts[1] === 0) {
        room.phase = 'finished';
        room.winner = counts[0] === 0 ? 1 : 0;
        broadcastEvents(room, [{ t: 'finish', winner: room.winner, score: teamScores(room), reason: 'rival-left' }]);
      }
    }
    broadcastRoom(room);
  }

  function startMatch(room) {
    const map = MAPS[validMapId(room.mapId)];
    const byTeam = [[], []];
    for (const p of Object.values(room.players)) byTeam[p.team].push(p);
    byTeam.forEach((list, team) => list.forEach((p, i) => {
      const s = spawnFor(map, team, i);
      p.x = s.x; p.y = s.y;
      resetActorHeight(map, p);
      p.angle = team === 0 ? 0.72 : 3.8;
      p.hp = 100; p.alive = true; p.kills = 0; p.deaths = 0;
      p.weapon = 'pistol'; p.ammo = WEAPONS.pistol.size; p.reloadingUntil = 0;
      p.ready = false; p.respawnIn = 0; p.lastShotAt = 0; p.flashAt = 0;
    }));
    room.phase = 'playing';
    room.timeLeft = room.matchTime;
    room.winner = -1;
    for (const ws of roomSockets(room.id)) send(ws, { t: S2C.MATCH_START, room: snapshotRoom(room) });
  }

  // Головний цикл матчів.
  const timer = setInterval(() => {
    const now = Date.now() / 1000;
    for (const room of rooms.values()) {
      if (room.phase !== 'playing') continue;
      const map = MAPS[validMapId(room.mapId)];
      for (const p of Object.values(room.players)) if (p.alive) stepActor(map, p, 0, 0, 1 / MP.TICK_HZ);
      const events = matchTick(room, 1 / MP.TICK_HZ);
      for (const e of events) {
        if (e.t === 'respawn') {
          const p = room.players[e.id];
          if (p) {
            const mates = Object.values(room.players).filter(q => q.team === p.team);
            const s = spawnFor(map, p.team, mates.indexOf(p));
            p.x = s.x; p.y = s.y;
            resetActorHeight(map, p);
            p.angle = p.team === 0 ? 0.72 : 3.8;
            p.weapon = 'pistol'; p.ammo = WEAPONS.pistol.size; p.reloadingUntil = 0;
          }
        }
      }
      // Перезаряджання завершується за часом.
      for (const p of Object.values(room.players)) {
        if (p.reloadingUntil && now >= p.reloadingUntil) {
          p.reloadingUntil = 0;
          p.ammo = (WEAPONS[p.weapon] || WEAPONS.pistol).size;
        }
      }
      broadcastEvents(room, events);
      if (room.phase === 'finished') {
        for (const ws of roomSockets(room.id)) send(ws, { t: S2C.MATCH_END, room: snapshotRoom(room) });
      } else {
        for (const ws of roomSockets(room.id)) send(ws, { t: S2C.SNAPSHOT, snap: snapshotRoom(room) });
      }
    }
  }, 1000 / MP.TICK_HZ);
  timer.unref?.();

  // Чистка мертвих з'єднань як у balloon-catcher: 8 секунд, а не хвилина —
  // той, у кого обірвалась мережа, повертається в ту саму кімнату
  // і має застати своє місце вже вільним.
  const heartbeat = setInterval(() => {
    signaling.sweep();
    for (const [ws] of clients) {
      if (!ws.isAlive) { try { ws.terminate(); } catch {} continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 8000);
  heartbeat.unref?.();

  wss.on('connection', ws => {
    ws.isAlive = true;
    const client = { id: `c${++clientSeq}_${Math.random().toString(36).slice(2, 7)}`, nick: 'БОЄЦЬ', roomId: null, stateAt: 0, stateN: 0 };
    clients.set(ws, client);
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;
      if(signaling.receive(ws,msg))return;
      const room = client.roomId ? rooms.get(client.roomId) : null;

      switch (msg.t) {
        case C2S.HELLO: {
          client.nick = sanitizeNick(msg.nick);
          send(ws, { t: S2C.WELCOME, id: client.id, rooms: publicList() });
          break;
        }
        case C2S.LIST: {
          send(ws, { t: S2C.ROOMS, rooms: publicList() });
          break;
        }
        case C2S.CREATE: {
          if (client.roomId) leaveRoom(ws, client);
          const id = `r${++roomSeq}_${Math.random().toString(36).slice(2, 7)}`;
          let code = makeCode();
          while ([...rooms.values()].some(r => r.code === code)) code = makeCode();
          const newRoom = createRoom({
            id, code, name: sanitizeRoomName(msg.name), isPublic: msg.isPublic === true,
            mapId: validMapId(msg.mapId), maxPlayers: msg.maxPlayers,
            killTarget: msg.killTarget, matchTime: msg.matchTime, hostId: client.id,
          });
          rooms.set(id, newRoom);
          addPlayer(newRoom, client.id, client.nick);
          client.roomId = id;
          send(ws, { t: S2C.JOINED, room: snapshotRoom(newRoom) });
          break;
        }
        case C2S.JOIN:
        case C2S.JOIN_CODE: {
          if (client.roomId) leaveRoom(ws, client);
          // Код як у balloon-catcher: 4 символи, приймаємо малі літери й схожі українські.
          const target = msg.t === C2S.JOIN_CODE
            ? (() => {
                const code = normalizeRoomCode(msg.code);
                if (!/^[A-Z0-9]{4}$/.test(code)) { send(ws, { t: S2C.ERROR, message: 'Введи код кімнати з 4 літер або цифр' }); return null; }
                const found = [...rooms.values()].find(r => r.code === code);
                if (!found) send(ws, { t: S2C.ERROR, message: 'Кімнату не знайдено. Перевір код.' });
                return found || null;
              })()
            : rooms.get(msg.id);
          if (!target) { if (msg.t === C2S.JOIN) send(ws, { t: S2C.ERROR, message: 'Кімнату не знайдено' }); break; }
          if (!target.isPublic && msg.t === C2S.JOIN) { send(ws, { t: S2C.ERROR, message: 'Кімната приватна — потрібен код' }); break; }
          const res = addPlayer(target, client.id, client.nick);
          if (!res.ok) {
            const full = /заповнена/i.test(res.message || '');
            send(ws, { t: S2C.ERROR, message: full ? `У цій кімнаті вже ${target.maxPlayers} гравці` : (/триває/i.test(res.message || '') ? 'Матч уже триває. Дочекайся наступного.' : res.message) });
            break;
          }
          client.roomId = target.id;
          send(ws, { t: S2C.JOINED, room: snapshotRoom(target) });
          broadcastRoom(target);
          break;
        }
        case C2S.LEAVE: {
          leaveRoom(ws, client);
          send(ws, { t: S2C.ROOMS, rooms: publicList() });
          break;
        }
        case C2S.READY: {
          if (room && setReady(room, client.id, msg.ready)) broadcastRoom(room);
          break;
        }
        case C2S.START: {
          if (room && canStart(room, client.id)) startMatch(room);
          else send(ws, { t: S2C.ERROR, message: 'Не всі готові або замало гравців' });
          break;
        }
        case C2S.STATE: {
          if (!room || room.phase !== 'playing') break;
          const p = room.players[client.id];
          if (!p || !p.alive) break;
          // Простий захист від спаму: не більше ~40 станів за секунду.
          const nowMs = Date.now();
          if (nowMs - client.stateAt > 1000) { client.stateAt = nowMs; client.stateN = 0; }
          if (++client.stateN > 45) break;
          const map = MAPS[validMapId(room.mapId)];
          const x = Number(msg.x), y = Number(msg.y), angle = Number(msg.angle);
          if ([x, y, angle].every(Number.isFinite) && canStand(map, x, y)) {
            p.x = clamp(x, 0.3, map.size - 0.3); p.y = clamp(y, 0.3, map.size - 0.3);
            p.angle = angle;
            p.moving = !!msg.moving;
            if (msg.jump === true) jumpActor(map, p);
          }
          if (msg.weapon && WEAPONS[msg.weapon] && msg.weapon !== p.weapon) {
            p.weapon = msg.weapon;
            p.ammo = WEAPONS[msg.weapon].size;
            p.reloadingUntil = 0;
          }
          break;
        }
        case C2S.SHOOT: {
          if (!room || room.phase !== 'playing') break;
          const now = Date.now() / 1000;
          const shooter = room.players[client.id];
          if (!shooter || !shooter.alive) break;
          const weaponId = WEAPONS[msg.weapon] ? msg.weapon : shooter.weapon;
          const w = WEAPONS[weaponId];
          if (shooter.reloadingUntil) break;
          if (now - shooter.lastShotAt < w.rate * 0.8) break;
          const map = MAPS[validMapId(room.mapId)];
          const target = room.players[msg.target];
          if (!target || target.team === shooter.team || !target.alive) break;
          const dx = target.x - shooter.x, dy = target.y - shooter.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 32 || !lineOfSight(map, shooter.x, shooter.y, target.x, target.y, actorHeight(map, shooter) + .5, actorHeight(map, target) + .5)) break;
          const want = Math.atan2(dy, dx);
          const diff = Math.abs(Math.atan2(Math.sin(want - shooter.angle), Math.cos(want - shooter.angle)));
          if (diff > 0.4) break;
          shooter.lastShotAt = now;
          shooter.flashAt = now;
          shooter.ammo--;
          let dmg = w.damage * (msg.head ? (w.headMult || 2) : 1);
          if (weaponId === 'shotgun') dmg *= w.pellets * clamp(1 - dist / 14, 0.15, 1);
          applyDamage(target, dmg, false);
          const events = [];
          if (shooter.ammo <= 0) {
            shooter.reloadingUntil = now + w.reload;
            events.push({ t: 'reload', id: shooter.id });
          }
          if (target.hp <= 0) {
            target.alive = false;
            target.deaths++;
            target.respawnIn = MP.RESPAWN_DELAY;
            shooter.kills++;
            events.push({ t: 'kill', source: shooter.id, target: target.id, sourceNick: shooter.nick, targetNick: target.nick });
            const score = teamScores(room);
            if (score[0] >= room.killTarget || score[1] >= room.killTarget) {
              room.phase = 'finished';
              room.winner = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
              events.push({ t: 'finish', winner: room.winner, score });
              broadcastEvents(room, events);
              for (const s of roomSockets(room.id)) send(s, { t: S2C.MATCH_END, room: snapshotRoom(room) });
              break;
            }
          }
          broadcastEvents(room, events);
          break;
        }
        case C2S.CHAT: {
          if (!room) break;
          const text = String(msg.text || '').trim().slice(0, 120);
          if (!text) break;
          broadcastEvents(room, [{ t: 'chat', id: client.id, nick: client.nick, text }]);
          break;
        }
      }
    });

    ws.on('close', () => {
      signaling.disconnect(ws);
      if (client.roomId) leaveRoom(ws, client);
      clients.delete(ws);
    });
    ws.on('error', () => {});
  });

  server.listen(port, '0.0.0.0', () => console.log(`СЕКТОР: http://localhost:${port}`));
  return { server, wss, rooms, clients, close: done => { clearInterval(timer); clearInterval(heartbeat); for (const c of wss.clients) try { c.terminate(); } catch {} wss.close(); server.close(done); } };
}

const port = Number(process.env.PORT || 4173);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startServer(port);
