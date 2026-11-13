import test from 'node:test';
import assert from 'node:assert/strict';
import { robloxRuntimeResponse } from '../scripts/roblox-runtime-response.mjs';

test('hosted engine documents and threads retain isolation outside static asset routing', async () => {
  const files = { 'play.html': '<canvas></canvas>', 'engine-worker.js': '/* thread */' };
  for (const file of Object.keys(files)) {
    const result = robloxRuntimeResponse(new Request(`https://velora.test/roblox/${file}?session=example`), files);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(result.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(result.headers.get('cross-origin-resource-policy'), 'same-origin');
		assert.equal(result.headers.get('document-isolation-policy'), 'isolate-and-require-corp');
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(await result.text(), files[file]);
  }
  const head = robloxRuntimeResponse(new Request('https://velora.test/roblox/play.html', { method: 'HEAD' }), files);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(robloxRuntimeResponse(new Request('https://velora.test/apps'), files), null);
  assert.equal(robloxRuntimeResponse(new Request('https://velora.test/roblox/unknown.js'), files), null);
});
