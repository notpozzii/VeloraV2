import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Reproduce the actual production restriction, including module initialization.
Object.defineProperty(globalThis, 'caches', {
	configurable: true,
	get() { throw new Error('This Worker is not permitted to access the default cache.'); }
});
const { default: worker } = await import('../dist/server/index.js');
const ctx = { waitUntil() { throw new Error('Dynamic responses must not use the Worker cache.'); } };
const assetRequests = [];
const env = {
	ASSETS: {
		async fetch(request) {
			const pathname = new URL(request.url || request).pathname;
			assetRequests.push(pathname);
			try {
				return new Response(await readFile(new URL(`../dist/client${pathname}`, import.meta.url)));
			} catch (error) {
				if (error.code !== 'ENOENT') throw error;
				return new Response('Not found', { status: 404 });
			}
		}
	}
};

test('desktop and GeForce routes work without a cache API', async () => {
	for (const path of ['/', '/os', '/geforce/', '/slate', '/download']) {
		const response = await worker.fetch(new Request(`https://velora.example${path}`), env, ctx);
		assert.equal(response.status, 200, path);
		const html = await response.text();
		assert.match(html, /_app\/immutable\//, path);
		assert.doesNotMatch(html, /Internal (?:Server|server) Error/, path);
	}
});

test('static proxy assets are served unchanged without a cache API', async () => {
	for (const path of ['/servy.js', '/proxy-route-recovery.js', '/prism/prism.sw.js', '/prism/prism.api.js', '/geforce/servy.js', '/geforce-runtime/prism.api.js', '/geforce-runtime/prism.wasm']) {
		const response = await worker.fetch(new Request(`https://velora.example${path}`), env, ctx);
		assert.equal(response.status, 200, path);
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(`../dist/client${path}`, import.meta.url)));
		assert.ok(assetRequests.includes(path));
	}
});

test('GeForce redirects and missing routes retain their proper statuses', async () => {
	for (const path of ['/geforce', '/velora-geforce.html']) {
		const response = await worker.fetch(new Request(`https://velora.example${path}`), env, ctx);
		assert.equal(response.status, 308);
		assert.equal(response.headers.get('location'), '/geforce/');
	}
	const missing = await worker.fetch(new Request('https://velora.example/not-an-app'), env, ctx);
	assert.equal(missing.status, 404);
});
