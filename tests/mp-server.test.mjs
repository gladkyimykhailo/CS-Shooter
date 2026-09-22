import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from '../server.mjs';
import { C2S } from '../public/net.js';

function connect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/mp`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

// Черга вхідних повідомлень з очікуванням потрібного типу.
function listener(ws) {
  const queue = [];
  const waiters = [];
  ws.on('message', raw => {
    const msg = JSON.parse(String(raw));
    queue.push(msg);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].t === msg.t) {
        waiters.splice(i, 1)[0].resolve(msg);
        const qi = queue.indexOf(msg);
        if (qi >= 0) queue.splice(qi, 1);
      }
    }
  });
  return {
    next: (t, timeout = 5000) => {
      const idx = queue.findIndex(m => m.t === t);
      if (idx >= 0) return Promise.resolve(queue.splice(idx, 1)[0]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting ${t}`)), timeout);
        waiters.push({ t, resolve: m => { clearTimeout(timer); resolve(m); } });
      });
    },
  };
}

const send = (ws, msg) => ws.send(JSON.stringify(msg));

test('публічна кімната: створення, джойн, готовність, старт, бій і вихід суперника', async () => {
  const { server, rooms, close } = startServer(0);
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  const roomOf = () => [...rooms.values()][0];
  const waitFor = (fn, timeout = 5000) => new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      let v;
      try { v = fn(); } catch { v = null; }
      if (v) return resolve(v);
      if (Date.now() - t0 > timeout) return reject(new Error('timeout waiting server state'));
      setTimeout(tick, 25);
    };
    tick();
  });
  try {
    const a = await connect(port);
    const b = await connect(port);
    const la = listener(a), lb = listener(b);

    send(a, { t: C2S.HELLO, nick: 'Альфа' });
    const welcomeA = await la.next('welcome');
    assert.ok(welcomeA.id);

    send(a, { t: C2S.CREATE, name: 'Тестова', isPublic: true, mapId: 0, maxPlayers: 4 });
    const joinedA = await la.next('joined');
    assert.equal(joinedA.room.phase, 'lobby');
    assert.equal(joinedA.room.players.length, 1);

    send(b, { t: C2S.HELLO, nick: 'Браво' });
    await lb.next('welcome');
    send(b, { t: C2S.LIST });
    const list = await lb.next('rooms');
    assert.ok(list.rooms.some(r => r.id === joinedA.room.id), 'публічна кімната у списку');

    send(b, { t: C2S.JOIN, id: joinedA.room.id });
    const joinedB = await lb.next('joined');
    assert.equal(joinedB.room.players.length, 2);
    const teams = joinedB.room.players.map(p => p.team).sort();
    assert.deepEqual(teams, [0, 1], 'команди різні');

    send(a, { t: C2S.START });
    const err = await la.next('error');
    assert.ok(err.message, 'старт без готовності відхилено');

    send(a, { t: C2S.READY, ready: true });
    send(b, { t: C2S.READY, ready: true });
    await waitFor(() => {
      const r = roomOf();
      const ps = r ? Object.values(r.players) : [];
      return ps.length === 2 && ps.every(p => p.ready) ? true : null;
    });
    send(a, { t: C2S.START });
    const startA = await la.next('matchStart');
    const startB = await lb.next('matchStart');
    assert.equal(startA.room.phase, 'playing');
    assert.equal(startB.room.phase, 'playing');
    const idA = startA.room.players.find(p => p.team === 0).id;
    const idB = startA.room.players.find(p => p.team === 1).id;

    // Відкрита лінія в палаці Mirage; координати >24 також перевіряють
    // відсутність старого обмеження розміру мапи на сервері.
    const wsA = startA.room.players.find(p => p.id === idA).id === welcomeA.id ? a : b;
    const wsB = wsA === a ? b : a;
    const lA = wsA === a ? la : lb;
    send(wsA, { t: C2S.STATE, x: 31.5, y: 32.5, angle: 0, moving: false });
    send(wsB, { t: C2S.STATE, x: 35.5, y: 32.5, angle: Math.PI, moving: false });
    // Чекаємо, поки сервер застосує позиції обох гравців.
    await waitFor(() => {
      const r = roomOf();
      const ps = r ? Object.values(r.players) : [];
      const pa = ps.find(p => p.id === idA), pb = ps.find(p => p.id === idB);
      return pa && pb && Math.abs(pa.x - 31.5) < 0.01 && Math.abs(pb.x - 35.5) < 0.01 && pa.y === 32.5 && pb.y === 32.5 ? true : null;
    });
    for (let i = 0; i < 4; i++) {
      send(wsA, { t: C2S.SHOOT, weapon: 'rifle', target: idB });
      await new Promise(r => setTimeout(r, 200));
    }
    const events = await lA.next('events');
    const kill = events.events.find(e => e.t === 'kill');
    assert.ok(kill, 'сервер підтвердив фраг');
    assert.equal(kill.source, idA);

    // Вихід суперника завершує матч перемогою того, хто лишився.
    send(wsB, { t: C2S.LEAVE });
    const fin = await lA.next('events');
    assert.ok(fin.events.some(e => e.t === 'finish' && e.winner === 0));

    a.close(); b.close();
  } finally {
    await new Promise(r => close(r));
  }
});

test('приватна кімната: вхід лише за кодом', async () => {
  const { server, close } = startServer(0);
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  try {
    const a = await connect(port);
    const c = await connect(port);
    const la = listener(a), lc = listener(c);
    send(a, { t: C2S.HELLO, nick: 'Хост' });
    await la.next('welcome');
    send(c, { t: C2S.HELLO, nick: 'Гість' });
    await lc.next('welcome');

    send(a, { t: C2S.CREATE, name: 'Секрет', isPublic: false, mapId: 1 });
    const joined = await la.next('joined');
    assert.match(joined.room.code, /^[A-Z2-9]{6}$/);

    send(c, { t: C2S.LIST });
    const list = await lc.next('rooms');
    assert.ok(!list.rooms.some(r => r.id === joined.room.id), 'приватної кімнати нема у списку');

    send(c, { t: C2S.JOIN, id: joined.room.id });
    const errDirect = await lc.next('error');
    assert.match(errDirect.message, /приватна/i);

    send(c, { t: C2S.JOIN_CODE, code: 'XXXXXX' });
    const errCode = await lc.next('error');
    assert.ok(errCode.message);

    send(c, { t: C2S.JOIN_CODE, code: joined.room.code.toLowerCase() });
    const joinedC = await lc.next('joined');
    assert.equal(joinedC.room.players.length, 2);

    a.close(); c.close();
  } finally {
    await new Promise(r => close(r));
  }
});
