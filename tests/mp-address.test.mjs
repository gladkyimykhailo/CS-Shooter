import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMpUrl, normalizeMpUrl, setSharedServerUrl, inviteLink, serverUrlFromQuery } from '../public/mp.js';

function page(t, address) {
  const previous = globalThis.location;
  globalThis.location = new URL(address);
  t.after(() => {
    setSharedServerUrl('');
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  });
}

test('server address accepts host and port and rejects invalid input without using the page host', t => {
  page(t, 'http://localhost:8080');
  assert.equal(defaultMpUrl('localhost:4173'), 'ws://localhost:4173/mp');
  assert.equal(defaultMpUrl('192.168.1.5:4173'), 'ws://192.168.1.5:4173/mp');
  assert.equal(normalizeMpUrl('HTTPS://game.example/mp/#room'), 'wss://game.example/mp');
  assert.equal(defaultMpUrl('not a server'), null);
  assert.equal(defaultMpUrl('javascript:alert(1)'), null);
  assert.equal(defaultMpUrl(''), 'ws://localhost:8080/mp');
});

test('static hosts do not become imaginary code services; explicit servers still work', t => {
  page(t, 'https://player.github.io/game/');
  for (const host of ['player.github.io', 'game.itch.io', 'html-classic.itch.zone']) {
    globalThis.location = new URL(`https://${host}/game/`);
    assert.equal(defaultMpUrl(''), null);
    assert.equal(defaultMpUrl('game.example'), 'wss://game.example/mp');
  }
});

test('editing the server field replaces stale discovery and invitation addresses', t => {
  page(t, 'https://player.github.io/game/?ws=wss://old.example');
  setSharedServerUrl('wss://stale.example');
  assert.equal(defaultMpUrl('https://new.example'), 'wss://new.example/mp');
  assert.equal(defaultMpUrl(''), 'wss://old.example/mp');
  globalThis.location.search = '';
  assert.equal(defaultMpUrl(''), 'wss://stale.example/mp');
});

test('invitation preserves the complete endpoint behind a reverse proxy', t => {
  page(t, 'https://player.github.io/game/');
  const endpoint = 'wss://game.example/sector/mp?route=friends';
  const invitation = new URL(inviteLink('938a', endpoint));
  assert.equal(invitation.searchParams.get('room'), '938A');
  assert.equal(serverUrlFromQuery(invitation.search), endpoint);
});
