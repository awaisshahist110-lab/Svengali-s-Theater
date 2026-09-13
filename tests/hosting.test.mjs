import test from 'node:test';
import assert from 'node:assert/strict';
import { gameApi, assetUrl } from '../lib/client-hosting.ts';
import {
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
  preflight,
  setAllowedOrigins,
  withGameCors,
} from '../lib/http-cors.ts';
import { handleGameRequest } from '../lib/game-api.ts';

const PAGES_ORIGIN = 'https://awaisshahist110-lab.github.io';

test.afterEach(() => {
  setAllowedOrigins(DEFAULT_ALLOWED_ORIGINS);
  delete globalThis.__SVENGALI_HOSTING__;
});

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
    method: 'OPTIONS', headers: { Origin: PAGES_ORIGIN, 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  const response = preflight(request);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), PAGES_ORIGIN);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  const privateHand = withGameCors(request, Response.json({ hand: ['Angel'] }));
  assert.equal(privateHand.headers.get('Cache-Control'), 'no-store');
  assert.match(privateHand.headers.get('Vary'), /Authorization/);
  assert.deepEqual(await privateHand.json(), { hand: ['Angel'] });
  const denied = preflight(new Request('https://game.example/api/game', { method: 'OPTIONS', headers: { Origin: 'https://unrelated.example' } }));
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('a self-hosted deployment sets its own allowed origins from one env var', () => {
  setAllowedOrigins('https://play.example, https://www.play.example/');
  assert.deepEqual(getAllowedOrigins(), ['https://play.example', 'https://www.play.example']);

  const allowed = preflight(new Request('https://api.example/api/game', {
    method: 'OPTIONS', headers: { Origin: 'https://play.example' },
  }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://play.example');

  // A custom domain replaces the default; the old Pages origin is no longer trusted.
  const denied = preflight(new Request('https://api.example/api/game', {
    method: 'OPTIONS', headers: { Origin: PAGES_ORIGIN },
  }));
  assert.equal(denied.status, 403);
});

test('a missing ALLOWED_ORIGINS value falls back to the default rather than trusting everyone', () => {
  for (const empty of [undefined, null, '', '   ', ',,', []]) {
    setAllowedOrigins(empty);
    assert.deepEqual(getAllowedOrigins(), DEFAULT_ALLOWED_ORIGINS, `input ${JSON.stringify(empty)}`);
  }
  const denied = preflight(new Request('https://api.example/api/game', {
    method: 'OPTIONS', headers: { Origin: 'https://evil.example' },
  }));
  assert.equal(denied.status, 403);
});

test('the API keeps serving its own origin so a single-origin deployment still works', () => {
  setAllowedOrigins('https://play.example');
  const sameOrigin = preflight(new Request('https://api.example/api/game', {
    method: 'OPTIONS', headers: { Origin: 'https://api.example' },
  }));
  assert.equal(sameOrigin.status, 204);
});

test('the standalone Worker rejects methods the game never uses, with CORS intact', async () => {
  const response = await handleGameRequest(new Request('https://api.example/api/game', {
    method: 'DELETE', headers: { Origin: PAGES_ORIGIN },
  }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), PAGES_ORIGIN);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
