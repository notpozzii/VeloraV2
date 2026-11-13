import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../src/routes/roblox/engine/[...file]/+server.js', import.meta.url))],
  alias: { $lib: fileURLToPath(new URL('../src/lib', import.meta.url)) },
  bundle: true, write: false, format: 'esm', platform: 'node'
});
const { GET } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'));

test('engine assets use edge-compatible fetch and stream only the pinned official source', async () => {
  const response = await GET({ params: { file: 'WebClient.wasm' }, fetch: async (url, options) => {
    assert.notEqual(options.redirect, 'error', 'Cloudflare rejects redirect:error before making a request');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    assert.match(url, /^https:\/\/setup\.rbxcdn\.com\/webclient\/version-[\w-]+\/WebClient\.wasm$/);
    return new Response(new Uint8Array([0, 97, 115, 109]), { headers: { 'Content-Type': 'application/wasm', 'Content-Length': '4' } });
  } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/wasm');
  assert.equal(response.headers.get('content-length'), null);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0, 97, 115, 109]);
});

test('an engine redirect or invalid asset path cannot fetch another source', async () => {
  let calls = 0;
  const fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://example.com/engine.js' } }); };
  const moved = await GET({ params: { file: 'WebClient.js' }, fetch });
  assert.equal(moved.status, 502);
  assert.equal(moved.headers.get('location'), null);
  for (const file of ['../private', 'folder/./engine', 'https://example.com/a', '%2e%2e/file']) {
    assert.equal((await GET({ params: { file }, fetch })).status, 400);
  }
  assert.equal(calls, 1);
});

test('official high-resolution startup assets containing @ can load', async () => {
  const response = await GET({ params: { file: 'content/textures/ui/ErrorPrompt/PrimaryButton@2x.png' }, fetch: async url => {
    assert.match(url, /\/content\/textures\/ui\/ErrorPrompt\/PrimaryButton@2x\.png$/);
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
});
