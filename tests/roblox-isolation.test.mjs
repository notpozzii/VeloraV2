import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/hooks.server.js';

test('Roblox documents opt into per-frame shared memory without changing other desktop apps', async () => {
	const resolve = async () => new Response('content', { headers: { 'content-type': 'text/html' } });
	for (const path of ['/roblox', '/roblox/', '/roblox/engine/WasmPlayer.js']) {
		const response = await handle({ event: { url: new URL(path, 'https://velora.test') }, resolve });
		assert.equal(response.headers.get('document-isolation-policy'), 'isolate-and-require-corp');
		assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
		assert.equal(await response.text(), 'content');
	}
	for (const path of ['/os', '/apps', '/slate', '/api', '/roblox-other']) {
		const response = await handle({ event: { url: new URL(path, 'https://velora.test') }, resolve });
		assert.equal(response.headers.get('document-isolation-policy'), null);
		assert.equal(response.headers.get('cross-origin-embedder-policy'), null);
	}
});
