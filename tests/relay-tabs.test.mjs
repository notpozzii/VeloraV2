import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveringTransport } from '../src/lib/lethe/recovering-transport.js';
import { createTabFrames } from '../src/lib/lethe/tab-frames.js';

const muxError = () => new Error('Hyper client: Wisp(MuxTaskEnded) (Multiplexor task ended)');
const remote = new URL('https://example.com/');

test('later tabs recover a dead relay and concurrent reads share one reconnect', async () => {
	let clients = 0;
	let firstReads = 0;
	let restoredReads = 0;
	const transport = createRecoveringTransport(() => {
		const id = ++clients;
		return {
			async init() { await new Promise(resolve => setImmediate(resolve)); this.ready = true; },
			async request() {
				if (id === 1) {
					if (++firstReads === 1) return { status: 200, body: 'first tab' };
					throw muxError();
				}
				restoredReads++;
				return { status: 200, body: 'later tab' };
			}
		};
	});
	await transport.init();
	assert.equal((await transport.request(remote, 'GET', null, [])).body, 'first tab');
	const results = await Promise.all(Array.from({ length: 6 }, () => transport.request(remote, 'GET', null, [])));
	assert.equal(clients, 2);
	assert.equal(restoredReads, 6);
	assert.ok(results.every(response => response.body === 'later tab'));
	await transport.request(remote, 'GET', null, []);
	assert.equal(clients, 2);
});

test('permanent relay failure is retried only once per page read', async () => {
	let attempts = 0;
	const transport = createRecoveringTransport(() => ({
		async init() {},
		async request() { attempts++; throw muxError(); }
	}));
	await assert.rejects(transport.request(remote, 'HEAD', null, []), /MuxTaskEnded/);
	assert.equal(attempts, 2);
});

test('login forms and uploads are never replayed; the next page can reconnect', async () => {
	let created = 0;
	const calls = [];
	const transport = createRecoveringTransport(() => {
		const id = ++created;
		return {
			async init() {},
			async request(...args) { calls.push(args); if (id === 1) throw muxError(); return { status: 200 }; }
		};
	});
	const body = new Uint8Array([1, 2, 3]);
	await assert.rejects(transport.request(remote, 'POST', body, []), /MuxTaskEnded/);
	assert.equal(calls.length, 1);
	assert.equal(calls[0][2], body);
	assert.equal((await transport.request(remote, 'GET', null, [])).status, 200);
	assert.equal(created, 2);
});

test('aborted reads, unrelated errors, and HTTP errors are not retried', async () => {
	for (const kind of ['abort', 'tls', 'http']) {
		let calls = 0;
		const abort = new AbortController();
		const transport = createRecoveringTransport(() => ({
			async init() {},
			async request() {
				calls++;
				if (kind === 'abort') { abort.abort(); throw muxError(); }
				if (kind === 'tls') throw new Error('TLS failed');
				return { status: 403 };
			}
		}));
		if (kind === 'http') assert.equal((await transport.request(remote, 'GET', null, [], abort.signal)).status, 403);
		else await assert.rejects(transport.request(remote, 'GET', null, [], abort.signal));
		assert.equal(calls, 1, kind);
	}
});

test('WebSocket connections preserve transport callbacks and send/close handles', async () => {
	const args = [remote, [], [], () => {}, () => {}, () => {}, () => {}];
	const handles = [() => {}, () => {}];
	const transport = createRecoveringTransport(() => ({
		async init() {},
		connect(...received) { assert.deepEqual(received, args); return handles; }
	}));
	await transport.init();
	assert.equal(transport.connect(...args), handles);
});

function controllerFixture() {
	let count = 0;
	const controller = {
		frames: [],
		createFrame() {
			const frame = { controller: this, context: { prefix: `/proxy/${++count}/` } };
			this.frames.push(frame);
			return frame;
		}
	};
	return controller;
}

test('each tab gets a distinct frame and revisiting it preserves its context', async () => {
	const controller = controllerFixture();
	const frames = createTabFrames(async () => controller);
	const [first, second, third, firstAgain] = await Promise.all([frames.get(1), frames.get(2), frames.get(3), frames.get(1)]);
	assert.equal(first, firstAgain);
	assert.equal(new Set([first.context.prefix, second.context.prefix, third.context.prefix]).size, 3);
	frames.release(2);
	assert.deepEqual(controller.frames, [first, third]);
	assert.equal(await frames.get(1), first);
	frames.clear();
	assert.equal(controller.frames.length, 0);
});

test('closing a tab during startup does not leak a frame or affect another tab', async () => {
	const controller = controllerFixture();
	let start;
	const startup = new Promise(resolve => { start = resolve; });
	const frames = createTabFrames(() => startup);
	const closed = frames.get(1);
	const kept = frames.get(2);
	frames.release(1);
	start(controller);
	await assert.rejects(closed, { name: 'AbortError' });
	assert.deepEqual(controller.frames, [await kept]);
});
