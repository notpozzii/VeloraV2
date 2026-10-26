import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from '../src/lib/lethe/loader.js';

test('concurrent launches wait for script load; a failed script can be retried', async () => {
	const scripts = [];
	globalThis.document = {
		querySelector() { return null; },
		createElement() { return { dataset: {}, remove() { this.removed = true; } }; },
		head: { appendChild(script) { scripts.push(script); } }
	};
	let loaded = false;
	const first = loadScript('/test-concurrent.js');
	const second = loadScript('/test-concurrent.js');
	second.then(() => { loaded = true; });
	await Promise.resolve();
	assert.equal(loaded, false);
	assert.equal(first, second);
	assert.equal(scripts.length, 1);
	scripts[0].onload();
	await second;
	const failing = loadScript('/test-retry.js');
	scripts[1].onerror();
	await assert.rejects(failing);
	assert.equal(scripts[1].removed, true);
	const retry = loadScript('/test-retry.js');
	assert.equal(scripts.length, 3);
	scripts[2].onload();
	await retry;
});
