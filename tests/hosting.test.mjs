import test from 'node:test';
import assert from 'node:assert/strict';
import { gameApi, assetUrl } from '../lib/client-hosting.ts';
import { preflight, withGameCors } from '../lib/http-cors.ts';

test('GitHub subpath keeps every card/audio path on Pages while rooms use the multiplayer API', () => {
  globalThis.__SVENGALI_HOSTING__ = { apiOrigin: 'https://game.example', assetBase: '/Svengali-s-Theater' };
  assert.equal(gameApi('?code=ABC123'), 'https://game.example/api/game?code=ABC123');
  assert.equal(assetUrl('/cards/weeper.webp'), '/Svengali-s-Theater/cards/weeper.webp');
  assert.equal(assetUrl('/audio/sword-slice.mp3'), '/Svengali-s-Theater/audio/sword-slice.mp3');
  delete globalThis.__SVENGALI_HOSTING__;
  assert.equal(gameApi(), '/api/game');
  assert.equal(assetUrl('/intro.webp'), '/intro.webp');
});

test('GitHub Pages can preflight private-hand requests; unrelated origins cannot', async () => {
  const request = new Request('https://game.example/api/game', {
    method: 'OPTIONS', headers: { Origin: 'https://awaisshahist110-lab.github.io', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  const response = preflight(request);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://awaisshahist110-lab.github.io');
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  const privateHand = withGameCors(request, Response.json({ hand: ['Angel'] }));
  assert.equal(privateHand.headers.get('Cache-Control'), 'no-store');
  assert.match(privateHand.headers.get('Vary'), /Authorization/);
  assert.deepEqual(await privateHand.json(), { hand: ['Angel'] });
  const denied = preflight(new Request('https://game.example/api/game', { method: 'OPTIONS', headers: { Origin: 'https://unrelated.example' } }));
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});
