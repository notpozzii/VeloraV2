import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { MessageChannel, MessagePort } from 'node:worker_threads';
import { createTransportBridge } from '../src/lib/lethe/transport-bridge.js';

// Use the shipped BareMux client and real transferred ports. In this fixture
// clients.matchAll is empty, reproducing discovery failure under an embed.
function fixture(t, { transportName = '/libby/index.mjs', source = '/api' } = {}) {
	const channels = [];
	const calls = [];
	const listeners = new Map();
	class Channel extends MessageChannel {
		constructor() { super(); channels.push(this); }
	}
	t.after(() => { for (const c of channels) { c.port1.close(); c.port2.close(); } });
	const scope = {
		URL, Response, Request, Headers, ReadableStream, EventTarget, MessagePort, MessageChannel: Channel,
		Promise, AggregateError, setTimeout: (...args) => setTimeout(...args).unref(), clearTimeout,
		navigator: { serviceWorker: {} }, localStorage: {}, WebSocket: class { send() {} },
		BroadcastChannel: class { close() {} }, console: { debug() {}, warn() {}, error() {} },
		location: { origin: 'https://velora.test' },
		clients: { async matchAll() { return []; } },
		addEventListener(type, callback) { listeners.set(type, callback); },
		importScripts() {},
		$scramjetLoadWorker: () => ({ ScramjetServiceWorker: class {} }),
		$scramjetController: { shouldRoute: () => false },
		isPrismProxyRequest: () => false,
		fetch: () => { throw new Error('Must not fall through to S3'); }
	};
	scope.self = scope;
	vm.createContext(scope);
	vm.runInContext(readFileSync(new URL('../static/charon/index.js', import.meta.url), 'utf8'), scope);
	let uv;
	scope.UVServiceWorker = class {
		static Ultraviolet = { BareClient: scope.BareMux.BareClient };
		constructor() { uv = this; this.bareClient = new scope.BareMux.BareClient(); }
		route() { return true; }
		fetch() { return this.bareClient.fetch('https://play.geforcenow.com/mall/'); }
	};
	vm.runInContext(readFileSync(new URL('../static/servy.js', import.meta.url), 'utf8'), scope);
	const workers = {
		controller: { postMessage(message, transfer) {
			calls.push('bind');
			const data = structuredClone(message, { transfer });
			listeners.get('message')({ data, source: { url: `https://velora.test${source}` }, waitUntil(promise) { promise.catch(() => {}); } });
		} },
		addEventListener(type, callback) { this[type] = callback; }
	};
	const host = {
		navigator: { serviceWorker: workers }, MessageChannel: Channel,
		SharedWorker: class {
			constructor(path, name) {
				assert.equal(path, '/charon/worker.js');
				assert.equal(name, 'bare-mux-worker');
				const channel = new Channel();
				this.port = channel.port2;
				channel.port1.onmessage = ({ data: { message, port } }) => {
					calls.push(message.type);
					if (message.type === 'ping') port.postMessage({ type: 'pong' });
					if (message.type === 'get') port.postMessage({ type: 'get', name: transportName });
					if (message.type === 'fetch') port.postMessage({ type: 'fetch', fetch: {
						status: 200, statusText: 'OK', headers: { 'content-type': 'text/html' }, body: 'GeForce document'
					} });
					port.close();
				};
			}
		}
	};
	return { host, workers, calls, get client() { return uv.bareClient; },
		get discovery() { return uv.bareClient.worker.port; },
		request() {
			let result;
			listeners.get('fetch')({ request: new Request('https://velora.test/service/glass/encoded'), respondWith(p) { result = p; } });
			return result;
		}
	};
}

test('an embedded GeForce launch gets a working port even when no window clients are discoverable', async t => {
	const f = fixture(t);
	await assert.rejects(f.discovery, /All clients returned an invalid MessagePort/);
	const connect = createTransportBridge(f.host);
	await connect();
	assert.deepEqual(f.calls, ['bind', 'ping', 'get']);
	assert.equal(await (await f.request()).text(), 'GeForce document');
});

test('a worker replacement is rebound and repeated launches share only in-flight binding', async t => {
	const f = fixture(t);
	const connect = createTransportBridge(f.host);
	await Promise.all([connect(), connect()]);
	assert.equal(f.calls.filter(call => call === 'bind').length, 1);
	await connect();
	assert.equal(f.calls.filter(call => call === 'bind').length, 2);
	f.workers.controller = { postMessage: f.workers.controller.postMessage };
	f.workers.controllerchange();
	await connect();
	assert.equal(f.calls.filter(call => call === 'bind').length, 3);
	assert.equal(await (await f.request()).text(), 'GeForce document');
});

test('an unconfigured transport is rejected before navigating to GeForce and can be retried', async t => {
	const f = fixture(t, { transportName: '' });
	const connect = createTransportBridge(f.host);
	await assert.rejects(connect(), /connection could not start/);
	await assert.rejects(connect(), /connection could not start/);
	assert.equal(f.calls.filter(call => call === 'bind').length, 2);
});

test('a proxied website cannot replace Velora’s transport', async t => {
	const f = fixture(t, { source: '/service/glass/encoded' });
	await assert.rejects(createTransportBridge(f.host)(), /connection could not start/);
	assert.deepEqual(f.calls, ['bind']);
});

test('the S3 api.html alias can bind its transport too', async t => {
	const f = fixture(t, { source: '/api.html' });
	await createTransportBridge(f.host)();
	assert.equal(await (await f.request()).text(), 'GeForce document');
});

test('an unresponsive older worker times out rather than showing an endless blank frame', async t => {
	const f = fixture(t);
	f.workers.controller = { postMessage() {} };
	await assert.rejects(createTransportBridge(f.host, 10)(), /connection timed out/);
});
