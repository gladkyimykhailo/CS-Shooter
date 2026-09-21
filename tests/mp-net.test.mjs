import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MP, makeCode, sanitizeNick, createRoom, publicRoomInfo,
  addPlayer, removePlayer, setReady, canStart, teamScores, matchTick, snapshotRoom,
} from '../public/net.js';

test('коди приватних кімнат не розкриваються у списку', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(makeCode());
  assert.ok(seen.size > 190, 'коди мають бути різними');
  assert.ok(/^[A-Z2-9]{6}$/.test(makeCode()));
  const room = createRoom({ id: 'r1', code: 'ABC123', name: 'Тест', isPublic: false, hostId: 'h' });
  const info = publicRoomInfo(room);
  assert.equal(info.isPublic, false);
  assert.ok(!('code' in info), 'код не повинен потрапляти у публічний список');
});

test('команди балансуються, старт лише за готовності всіх', () => {
  const room = createRoom({ id: 'r1', code: 'XXXXXX', name: '', isPublic: true, hostId: null });
  assert.equal(room.name, 'КІМНАТА');
  addPlayer(room, 'a', 'Альфа');
  addPlayer(room, 'b', 'Браво');
  addPlayer(room, 'c', '  ');
  assert.deepEqual([room.players.a.team, room.players.b.team, room.players.c.team], [0, 1, 0]);
  assert.equal(room.players.c.nick, 'БОЄЦЬ');
  assert.equal(room.hostId, 'a');
  assert.equal(canStart(room, 'a'), false);
  setReady(room, 'a', true); setReady(room, 'b', true);
  assert.equal(canStart(room, 'a'), false, 'усі мають бути готові');
  setReady(room, 'c', true);
  assert.equal(canStart(room, 'a'), true);
  assert.equal(canStart(room, 'b'), false, 'стартувати може лише хост');
  const res = removePlayer(room, 'a');
  assert.equal(res.hostId, 'b', 'хост мігрує');
  assert.equal(room.players.b.ready, false, 'готовність скидається після зміни хоста');
});

test('переповнена кімната і матч відхиляють вхід', () => {
  const room = createRoom({ id: 'r1', code: 'C', name: 'T', isPublic: true, maxPlayers: 2, hostId: null });
  addPlayer(room, 'a', 'A'); addPlayer(room, 'b', 'B');
  assert.equal(addPlayer(room, 'c', 'C').ok, false);
  room.phase = 'playing';
  assert.equal(addPlayer(room, 'd', 'D').ok, false);
});

test('тік матчу: відродження, перемога за фрагами і часом', () => {
  const room = createRoom({ id: 'r1', code: 'C', name: 'T', isPublic: true, killTarget: 5, matchTime: 60, hostId: 'a' });
  addPlayer(room, 'a', 'A'); addPlayer(room, 'b', 'B');
  room.phase = 'playing'; room.timeLeft = 60;
  room.players.a.alive = false; room.players.a.respawnIn = 0.1;
  let ev = matchTick(room, 0.2);
  assert.equal(room.players.a.alive, true);
  assert.ok(ev.some(e => e.t === 'respawn'));
  room.players.a.kills = 5;
  ev = matchTick(room, 0.1);
  assert.equal(room.phase, 'finished');
  assert.equal(room.winner, 0);
  assert.deepEqual(teamScores(room), [5, 0]);
  assert.equal(canStart(room, 'a'), true, 'хост може запустити реванш одразу');
  assert.equal(canStart(room, 'b'), false, 'реванш запускає лише хост');
  const snap = snapshotRoom(room);
  assert.equal(snap.players.length, 2);
  assert.deepEqual(snap.score, [5, 0]);
});

test('нічия за часом дає winner -1', () => {
  const room = createRoom({ id: 'r1', code: 'C', name: 'T', isPublic: true, killTarget: 50, matchTime: 60, hostId: 'a' });
  addPlayer(room, 'a', 'A'); addPlayer(room, 'b', 'B');
  room.phase = 'playing'; room.timeLeft = 0.05;
  const ev = matchTick(room, 0.1);
  assert.equal(room.phase, 'finished');
  assert.equal(room.winner, -1);
  assert.ok(ev.some(e => e.t === 'finish'));
});

test('санітизація ніків', () => {
  assert.equal(sanitizeNick('  ТАЙФУН 007  '), 'ТАЙФУН 007');
  assert.equal(sanitizeNick(''), 'БОЄЦЬ');
  assert.ok(sanitizeNick('x'.repeat(40)).length <= 16);
  assert.equal(MP.PATH, '/mp');
});
