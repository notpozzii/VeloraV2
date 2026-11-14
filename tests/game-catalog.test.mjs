import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/routes/books/+page.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) }
});
const { load } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

test('Games opens its full catalog even when network requests fail', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new TypeError('Failed to fetch'); };
  try {
    const data = await load({ fetch: globalThis.fetch });
    assert.equal(requests, 0, 'opening the game list must not need an external server');
    assert.equal(data.catalogUnavailable, false);
    assert.ok(data.games.length > 550);
    for (const name of ['1v1.LoL', 'Basket Random', '10 Minutes Till Dawn', 'Slope', '2048']) {
      assert.ok(data.games.some(game => game.name === name), name);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('the packaged catalog keeps game URLs, tags and stable favorite IDs', async () => {
  const { games } = await load();
  assert.equal(new Set(games.map(game => game.id)).size, games.length);
  const game = games.find(game => game.name === '10 Minutes Till Dawn');
  assert.equal(game.id, '10-minutes-till-dawn');
  assert.equal(game.url, 'https://gtest.5.188.124.68.nip.io/books/gmes/10-minutes-till-dawn/index.html');
  assert.ok(game.tags.includes('shooter'));
  assert.ok(games.every(game => game.name && game.id && Array.isArray(game.tags)));
});
