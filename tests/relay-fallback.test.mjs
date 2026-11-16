import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIMARY_WISP, BACKUP_WISP, createRelayTransport, getRelayUrl, rememberRelayFailure } from '../src/lib/lethe/relay-fallback.js';
import { playbackHost, retryablePlaybackText, watchPlaybackRelayFallback } from '../src/lib/utils/browser/relay-playback-fallback.js';

const remote = new URL('https://example.test/video');
let sequence = 0;
const relay = () => `wss://relay-${++sequence}.test/wisp/`;

test('dead custom relay switches concurrent reads to a single backup connection', async () => {
	const custom = relay(), clients = [], requests = [];
	const transport = createRelayTransport(wisp => {
		clients.push(wisp);
		return { async init() { await new Promise(resolve => setImmediate(resolve)); this.ready = true; },
			async request() { requests.push(wisp); if (wisp === custom) throw new Error('WebSocket connection failed'); return { status: 206, body: 'video bytes' }; }
		};
	}, custom);
	const values = await Promise.all(Array.from({ length: 5 }, () => transport.request(remote, 'GET', null, [['range', 'bytes=0-100']])));
	assert.ok(values.every(x => x.status === 206 && x.body === 'video bytes'));
	assert.equal(clients.filter(x => x === BACKUP_WISP).length, 1);
	assert.equal(getRelayUrl(custom), BACKUP_WISP);
	assert.equal(transport.relay, BACKUP_WISP);
});

test('failed initialization and hung response headers use the backup', async () => {
	for (const kind of ['init', 'timeout']) {
		const custom = relay();
		const transport = createRelayTransport(wisp => ({
			async init() { if (kind === 'init' && wisp === custom) throw new Error('Wisp connection refused'); },
			async request() { if (kind === 'timeout' && wisp === custom) return new Promise(() => {}); return { status: 200 }; }
		}), custom, { timeoutMs: 15 });
		await transport.init();
		assert.equal((await transport.request(remote, 'GET', null, [])).status, 200);
		assert.equal(transport.relay, BACKUP_WISP);
	}
});

test('forms and uploads are never replayed; subsequent reads use the backup', async () => {
	const custom = relay(), requests = [];
	const transport = createRelayTransport(wisp => ({ async init() {}, async request(...args) {
		requests.push([wisp, ...args]);
		if (wisp === custom) throw new Error('Network connection failed');
		return { status: 200 };
	} }), custom);
	const body = new Uint8Array([1, 2, 3]);
	await assert.rejects(transport.request(remote, 'POST', body, []));
	assert.equal(requests.length, 1);
	assert.equal(requests[0][3], body);
	assert.equal((await transport.request(remote, 'GET', null, [])).status, 200);
	assert.equal(requests[1][0], BACKUP_WISP);
});

test('an abort, unrelated error, and upstream HTTP response do not change relays', async () => {
	for (const kind of ['abort', 'script', 'http']) {
		const custom = relay(), abort = new AbortController();
		let requests = 0;
		const transport = createRelayTransport(() => ({ async init() {}, async request() {
			requests++;
			if (kind === 'abort') { abort.abort(); throw new Error('WebSocket connection failed'); }
			if (kind === 'script') throw new Error('Invalid script syntax');
			return { status: 403 };
		} }), custom);
		if (kind === 'http') assert.equal((await transport.request(remote, 'GET', null, [], abort.signal)).status, 403);
		else await assert.rejects(transport.request(remote, 'GET', null, [], abort.signal));
		assert.equal(transport.relay, custom);
		assert.equal(requests, 1);
	}
});

test('both relays failing does not create a retry loop', async () => {
	const custom = relay();
	let calls = 0;
	const transport = createRelayTransport(() => ({ async init() {}, async request() { calls++; throw new Error('Network connection failed'); } }), custom);
	await assert.rejects(transport.request(remote, 'GET', null, []));
	assert.equal(calls, 2);
});

test('a media-selected backup applies to an already-created transport', async () => {
	const custom = relay(), requests = [];
	const handles = [() => {}, () => {}];
	const transport = createRelayTransport(wisp => ({ async init() {}, async request() { requests.push(wisp); return { status: 200 }; }, connect() { return handles; } }), custom);
	await transport.init();
	assert.equal(transport.connect(remote), handles);
	assert.equal(rememberRelayFailure(custom), true);
	assert.equal(rememberRelayFailure(custom), false);
	await transport.request(remote, 'GET', null, []);
	assert.deepEqual(requests, [BACKUP_WISP]);
});

test('playback fallback recognizes the affected sites and leaves genuine restrictions alone', () => {
	assert.equal(playbackHost('https://www.youtube.com/watch?v=sample'), true);
	assert.equal(playbackHost('https://play.geforcenow.com/mall/'), true);
	assert.equal(playbackHost('https://youtube.com.attacker.test/'), false);
	assert.equal(retryablePlaybackText('Video unavailable. This content isn’t available.'), true);
	assert.equal(retryablePlaybackText('Video unavailable. This is a private video.'), false);
	assert.equal(retryablePlaybackText('Video unavailable. Removed due to copyright.'), false);
});

test('cancelling a streaming download after headers still aborts its transport', async () => {
	let downloadSignal;
	const abort = new AbortController();
	const body = new ReadableStream();
	const transport = createRelayTransport(() => ({ async init() {}, async request(_url, _method, _body, _headers, signal) { downloadSignal = signal; return { status: 200, body }; } }), relay());
	assert.equal((await transport.request(remote, 'GET', null, [], abort.signal)).body, body);
	abort.abort();
	assert.equal(downloadSignal.aborted, true);
});

function mediaFixture({ delegated = false } = {}) {
	const native = new WeakMap();
	class Frame extends EventTarget { get contentDocument() { return this.doc; } }
	class Media { get error() { return native.get(this); } get currentSrc() { return ''; } }
	class Doc extends EventTarget {
		querySelector(selector) { return delegated && selector === 'iframe[data-proxy-content]' ? {} : null; }
		querySelectorAll(selector) { return selector === 'video,audio' ? [video] : []; }
	}
	const video = new Media();
	native.set(video, { code: 4, message: 'Source could not open' });
	const frame = new Frame();
	frame.doc = new Doc();
	let reloads = 0;
	frame.contentWindow = { location: { reload() { reloads++; } } };
	const callbacks = [];
	const host = { HTMLIFrameElement: Frame, HTMLMediaElement: Media, location: { origin: 'https://velora.test' }, setInterval(fn) { callbacks.push(fn); return callbacks.length; }, clearInterval() {}, setTimeout() { return 9; }, clearTimeout() {} };
	return { frame, host, callbacks, reloads: () => reloads };
}

test('a failed media source switches once and reloads the current frame', async () => {
	const f = mediaFixture(), custom = relay(), prepared = [];
	const stop = watchPlaybackRelayFallback(f.frame, { relay: () => custom, backup: () => 'wss://custom-backup.test/wisp/', url: () => 'https://play.geforcenow.com/mall/', prepare: async backup => prepared.push(backup), host: f.host });
	await new Promise(resolve => setImmediate(resolve));
	f.callbacks.forEach(fn => fn());
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(prepared, ['wss://custom-backup.test/wisp/']);
	assert.equal(f.reloads(), 1);
	stop();
});

test('outer launchers leave media recovery to their own inner API page', async () => {
	const f = mediaFixture({ delegated: true }), custom = relay();
	let prepared = false;
	const stop = watchPlaybackRelayFallback(f.frame, { relay: () => custom, url: () => 'https://www.youtube.com/watch?v=current', prepare: async () => { prepared = true; }, host: f.host });
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(prepared, false);
	assert.equal(f.reloads(), 0);
	assert.equal(getRelayUrl(custom), custom);
	stop();
});

test('the default order is galxy first, then our VPS if galxy fails', async () => {
	assert.equal(PRIMARY_WISP, 'wss://galxy.it.com/jsonn/');
	assert.equal(BACKUP_WISP, 'wss://relay.velora.uno/wisp/');
	assert.equal(getRelayUrl(), PRIMARY_WISP);
	const used = [];
	const headers = [['Range', 'bytes=0-200']];
	const transport = createRelayTransport(wisp => ({
		async init() {},
		async request(_remote, method, body, forwarded) {
			used.push(wisp);
			assert.equal(method, 'GET'); assert.equal(body, null); assert.equal(forwarded, headers);
			if (wisp === PRIMARY_WISP) throw new Error('WebSocket connection failed');
			return { status: 206, body: 'partial video' };
		}
	}));
	assert.equal((await transport.request(remote, 'GET', null, headers)).status, 206);
	assert.deepEqual(used, [PRIMARY_WISP, BACKUP_WISP]);
});
