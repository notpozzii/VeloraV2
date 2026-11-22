import test from 'node:test';
import assert from 'node:assert/strict';

test('concurrent tab startup shares one ready controller and unchanged settings keep its relay', async () => {
	let clients = 0;
	let controllers = 0;
	let originalClients = 0;
	let switches = 0;
	let release;
	const waiting = new Promise(resolve => { release = resolve; });
	let releaseTransport;
	const transportWaiting = new Promise(resolve => { releaseTransport = resolve; });
	const scripts = [];
	globalThis.document = {
		querySelector() { return null; },
		createElement() { return { dataset: {}, remove() {} }; },
		head: { appendChild(script) {
			scripts.push(script.src);
			queueMicrotask(() => {
				if (script.src === '/prism/prism.js') window.$scramjet = { kind: 'velora' };
				if (script.src === '/prism/prism.original.js') window.$scramjet = { kind: 'original' };
				script.onload();
			});
		} }
	};
	class Transport {
		constructor() { clients++; }
		async init() { await transportWaiting; this.ready = true; }
	}
	class Controller {
		constructor({ transport, config }) { this.transport = transport; this.config = config; controllers++; }
		async wait() { await waiting; }
		setTransport(transport) { this.transport = transport; switches++; }
	}
	globalThis.window = {
		EpoxyTransport: { default: Transport },
		LibcurlTransport: { LibcurlClient: Transport },
		LibcurlOriginalTransport: { LibcurlClient: class extends Transport {
			constructor() { super(); originalClients++; }
		} },
		$veloraCreatePrismApi(runtime) {
			return { Controller: class extends Controller {
				constructor(options) { super(options); this.runtime = runtime; }
			} };
		}
	};
	const sw = { scriptURL: 'https://velora.example/servy.js' };
	Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
		serviceWorker: { controller: sw, ready: Promise.resolve(), async register() { return { scope: 'https://velora.example/' }; } }
	} });
	const prism = await import('../src/lib/lethe/prism.js');
	let settled = false;
	const first = prism.createPrismController('epoxy').then(value => { settled = true; return value; });
	const second = prism.createPrismController('epoxy');
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(settled, false);
	assert.equal(prism.getPrismController(), undefined);
	assert.equal(controllers, 1);
	assert.equal(clients, 1);
	release();
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(settled, false, 'engine compilation does not wait on the relay, but readiness requires both');
	releaseTransport();
	const controller = await first;
	assert.equal(await second, controller);
	await Promise.all([prism.setPrismTransport('epoxy'), prism.setPrismTransport('epoxy')]);
	assert.equal(clients, 1);
	assert.equal(switches, 0);
	await prism.setPrismTransport('libcurl');
	assert.equal(switches, 1);
	assert.equal(clients, 2);
	await prism.setPrismTransport('libcurl');
	assert.equal(clients, 2);
	const original = await prism.createPrismController('libcurl-original', undefined, undefined, { engine: 'sj2-original' });
	assert.notEqual(original, controller);
	assert.equal(original.runtime.kind, 'original');
	assert.equal(controller.runtime.kind, 'velora');
	assert.equal(original.config.scramjetPath, '/prism/prism.original.js');
	assert.equal(controller.config.scramjetPath, '/prism/prism.js');
	assert.equal(originalClients, 1);
	await prism.setPrismTransport('libcurl-original', undefined, undefined, 'sj2-original');
	assert.equal(switches, 1, 'the original transport is already selected on that controller');
	assert.equal(scripts.filter(path => path === '/prism/prism.api.js').length, 1);
});
