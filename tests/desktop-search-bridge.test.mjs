import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserSearchBridge } from '../src/lib/utils/browser/desktop-search-bridge.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}) {
	const listeners = new Set();
	const acknowledgements = [];
	const searches = [];
	const errors = [];
	const parent = { postMessage(...args) { acknowledgements.push(args); } };
	const host = {
		location: { origin: 'https://velora.test' }, parent,
		addEventListener(type, listener) { assert.equal(type, 'message'); listeners.add(listener); },
		removeEventListener(type, listener) { assert.equal(type, 'message'); listeners.delete(listener); }
	};
	const bridge = createBrowserSearchBridge({
		host,
		async onSearch(request) { searches.push(request); },
		onError(error, request) { errors.push({ error, request }); },
		...overrides
	});
	function send(data, fields = {}) {
		for (const listener of listeners) listener({
			origin: host.location.origin, source: parent, data, ...fields
		});
	}
	function request(query, requestId = query) {
		send({ type: 'velora:browser-search', query, requestId });
	}
	return { bridge, host, parent, send, request, listeners, acknowledgements, searches, errors };
}

test('desktop receives an immediate acknowledgement while searches wait for startup in receipt order', async () => {
	const f = fixture();
	f.bridge.enqueueInitialQuery(' example.com ');
	f.request('cats');
	f.request('dogs');
	assert.equal(f.acknowledgements.length, 2);
	assert.deepEqual(f.acknowledgements[0], [
		{ type: 'velora:browser-search-accepted', requestId: 'cats' }, 'https://velora.test'
	]);
	assert.deepEqual(f.searches, []);
	f.bridge.setReady();
	await settle();
	assert.deepEqual(f.searches, [
		{ query: 'example.com', newTab: false },
		{ query: 'cats', newTab: true },
		{ query: 'dogs', newTab: true }
	]);
	f.bridge.destroy();
});

test('only a nonempty, well-formed request from the same-origin parent is accepted', async () => {
	const f = fixture();
	f.bridge.setReady();
	const valid = { type: 'velora:browser-search', query: 'example.com', requestId: '1' };
	f.send(valid, { origin: 'https://other.test' });
	f.send(valid, { source: {} });
	for (const data of [null, {}, { ...valid, type: 'other' }, { ...valid, query: 12 },
		{ ...valid, query: ' ' }, { ...valid, requestId: '' }, { ...valid, requestId: 12 }]) f.send(data);
	await settle();
	assert.deepEqual(f.searches, []);
	assert.deepEqual(f.acknowledgements, []);
	f.send(valid);
	await settle();
	assert.equal(f.searches.length, 1);
	f.bridge.destroy();
});

test('navigation is serialized and an acknowledged retry never opens a duplicate tab', async () => {
	let release;
	const held = new Promise(resolve => { release = resolve; });
	const searches = [];
	const f = fixture({ async onSearch(request) { searches.push(request.query); if (searches.length === 1) await held; } });
	f.bridge.setReady();
	f.request('first');
	f.request('second');
	f.request('second');
	assert.deepEqual(searches, ['first']);
	assert.equal(f.acknowledgements.length, 3);
	release();
	await settle();
	assert.deepEqual(searches, ['first', 'second']);
	f.bridge.destroy();
});

test('a failed navigation reaches the error UI and does not discard the next request', async () => {
	const error = new Error('Relay unavailable');
	const searches = [];
	const f = fixture({ async onSearch(request) { searches.push(request.query); if (request.query === 'broken') throw error; } });
	f.request('broken');
	f.request('working');
	f.bridge.setReady();
	await settle();
	assert.deepEqual(f.errors, [{ error, request: { query: 'broken', newTab: true } }]);
	assert.deepEqual(searches, ['broken', 'working']);
	f.bridge.destroy();
});

test('unmount removes the listener, cancels in-flight work, and drops queued requests', async () => {
	let release;
	const held = new Promise(resolve => { release = resolve; });
	let started = 0;
	let signal;
	const f = fixture({ async onSearch(request, lifetime) { started++; signal = lifetime; await held; throw new Error('late'); } });
	f.bridge.setReady();
	f.request('first');
	f.request('queued');
	f.bridge.destroy();
	assert.equal(f.listeners.size, 0);
	assert.equal(signal.aborted, true);
	release();
	await settle();
	assert.equal(started, 1);
	assert.deepEqual(f.errors, []);
	f.request('ignored');
	f.bridge.setReady();
	await settle();
	assert.equal(started, 1);
});
