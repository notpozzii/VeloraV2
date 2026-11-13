import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../static/roblox/player.js', import.meta.url), 'utf8');

function player({ isolated = true, clipboardDenied = false, snapshot = {} } = {}) {
	const classes = () => {
		const values = new Set();
		return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
	};
	const element = () => ({ classList: classes(), style: {}, textContent: '', setAttribute() {}, hidden: false, children: [], contains(node) { return this.children.includes(node); }, appendChild(node) { this.children.push(node); }, focus() { this.focused = true; }, select() { this.selected = true; } });
	class Image extends EventTarget {
		constructor() { super(); this.parentElement = element(); }
		get src() { return this.value || ''; }
		set src(value) { this.value = value; }
	}
	const nodes = new Map(['loading-cancel', 'loading-error-leave', 'loading-overlay', 'loading-error-title', 'loading-error-message', 'loading-error-code', 'status', 'error-panel', 'connection-report-tools', 'connection-report-copy', 'connection-report-status', 'connection-report-text'].map(id => [id, element()]));
	for (const id of ['connection-report-tools', 'connection-report-text']) nodes.get(id).hidden = true;
	for (const id of ['loading-experience-icon', 'loading-background-image']) nodes.set(id, new Image());
	const events = new Map(), messages = [], statuses = [], fetched = [], revoked = [], engineLoads = [], copied = [], observers = new Map();
	class LocalURL extends URL {
		static createObjectURL() { return 'blob:https://velora.test/artwork'; }
		static revokeObjectURL(value) { revoked.push(value); }
	}
	const parent = { postMessage: data => messages.push(data) };
	const context = vm.createContext({ URL: LocalURL, URLSearchParams, HTMLImageElement: Image, Event, parent,
		location: { origin: 'https://velora.test', href: 'https://velora.test/roblox/play.html?nonce=test', search: '?nonce=test' },
		crossOriginIsolated: isolated,
		document: { getElementById: id => nodes.get(id), querySelector: () => nodes.get('error-panel'), createElement: () => ({}), head: { append(script) { engineLoads.push(script.src); queueMicrotask(() => script.onload?.()); } } },
		__veloraRobloxBridge: { connect() {}, status: (...args) => statuses.push(args), connectionSnapshot: () => snapshot },
		navigator: { clipboard: { async writeText(text) { if (clipboardDenied) throw Error('Clipboard unavailable'); copied.push(text); } } },
		fetch: async url => { fetched.push(url); return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } }); },
		addEventListener(type, callback) {
			const previous = events.get(type);
			events.set(type, previous ? event => { previous(event); return callback(event); } : callback);
		}, MutationObserver: class { constructor(callback) { this.callback = callback; } observe(node) { observers.set(node, this.callback); } }
	});
	context.window = context; context.self = context;
	vm.runInContext(source, context);
	return { context, nodes, events, messages, statuses, fetched, revoked, engineLoads, copied, observers, parent };
}

test('the error report identifies the failed connection without account data, destinations or raw errors', async () => {
	const p = player({ isolated: false, snapshot: { game: 'failed', attempts: 1, connected: 0, failed: 1, joinHttp: 200, httpFailure: null, endpoint: 'https://secret-ticket.qdmux.roblox.com', cookie: 'private-cookie' } });
	await p.events.get('message')({ source: p.parent, origin: 'https://velora.test', data: { type: 'velora:roblox-connect', nonce: 'test', build: { version: '0.746.0.7461265' }, connection: { relay: 'default', transport: 'libcurl', signedIn: true, userName: 'private-name' } }, ports: [{}] });
	p.nodes.get('loading-error-code').textContent = '(Error Code: 279)';
	p.nodes.get('loading-error-message').textContent = 'Failure at https://secret-ticket.qdmux.roblox.com';
	assert.equal(p.nodes.get('connection-report-tools').hidden, false);
	await p.nodes.get('connection-report-copy').onclick();
	assert.equal(p.copied.length, 1);
	assert.match(p.copied[0], /Relay: default/);
	assert.match(p.copied[0], /Signed in before launch: yes/);
	assert.match(p.copied[0], /Game connection: failed/);
	assert.match(p.copied[0], /Game join HTTP: 200/);
	assert.match(p.copied[0], /Roblox error code: 279/);
	assert.doesNotMatch(p.copied[0], /private|secret|qdmux|nonce|cookie/i);
});

test('a browser that denies clipboard access gets selectable report text', async () => {
	const p = player({ isolated: false, clipboardDenied: true });
	await p.events.get('message')({ source: p.parent, origin: 'https://velora.test', data: { type: 'velora:roblox-connect', nonce: 'test' }, ports: [{}] });
	await p.nodes.get('connection-report-copy').onclick();
	const text = p.nodes.get('connection-report-text');
	assert.equal(text.hidden, false);
	assert.equal(text.focused, true);
	assert.equal(text.selected, true);
	assert.match(text.value, /Velblox connection report v1/);
});

test('an error rendered by the engine itself reveals the report button too', async () => {
	const p = player();
	await p.events.get('message')({ source: p.parent, origin: 'https://velora.test', data: { type: 'velora:roblox-connect', nonce: 'test' }, ports: [{}] });
	assert.equal(p.nodes.get('connection-report-tools').hidden, true);
	p.nodes.get('loading-error-message').textContent = 'Failed to connect to the experience';
	p.observers.get(p.nodes.get('error-panel'))();
	assert.equal(p.nodes.get('connection-report-tools').hidden, false);
});

test('a validated Play starts the engine without an unrelated network round trip', async () => {
	const p = player();
	await p.events.get('message')({ source: p.parent, origin: 'https://velora.test', data: { type: 'velora:roblox-connect', nonce: 'test' }, ports: [{}] });
	assert.deepEqual(p.engineLoads, ['/roblox/engine/WasmPlayer.js']);
	assert.deepEqual(p.fetched, []);
	assert.equal(p.nodes.get('loading-overlay').classList.contains('loading-failed'), false);
});

test('the X can cancel before the engine connection is ready', () => {
	const p = player();
	p.nodes.get('loading-cancel').onclick();
	assert.deepEqual({ ...p.messages.at(-1) }, { type: 'velora:roblox-cancel', nonce: 'test' });
	assert.equal(p.fetched.length, 0);
});

test('an early engine failure exposes a readable error with a working exit', async () => {
	const p = player({ isolated: false });
	await p.events.get('message')({ source: p.parent, origin: 'https://velora.test', data: { type: 'velora:roblox-connect', nonce: 'test' }, ports: [{}] });
	assert.ok(p.nodes.get('loading-overlay').classList.contains('loading-failed'));
	assert.equal(p.nodes.get('error-panel').hidden, false);
	assert.match(p.nodes.get('loading-error-message').textContent, /shared memory/);
	p.nodes.get('loading-error-leave').onclick();
	assert.equal(p.messages.at(-1).type, 'velora:roblox-cancel');
});

test('an asynchronous engine memory failure replaces the endless loading screen with an exit', async () => {
	const p = player();
	await p.events.get('message')({ source: p.parent, origin: 'https://velora.test', data: { type: 'velora:roblox-connect', nonce: 'test' }, ports: [{}] });
	p.events.get('unhandledrejection')({ reason: new RangeError('WebAssembly.Memory(): could not allocate memory') });
	assert.equal(p.nodes.get('error-panel').hidden, false);
	assert.match(p.nodes.get('loading-error-message').textContent, /memory error/);
	p.nodes.get('loading-error-leave').onclick();
	assert.equal(p.messages.at(-1).type, 'velora:roblox-cancel');
});

test('Roblox artwork uses local blobs and releases them when the game window closes', async () => {
	const p = player();
	const image = p.nodes.get('loading-experience-icon');
	image.src = 'https://tr.rbxcdn.com/game-icon.png';
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(image.src, 'blob:https://velora.test/artwork');
	assert.deepEqual(p.fetched, ['https://tr.rbxcdn.com/game-icon.png']);
	image.dispatchEvent(new Event('load'));
	assert.ok(image.parentElement.classList.contains('loading-image-ready'));
	image.src = 'https://rbxcdn.com.evil.test/icon.png';
	assert.equal(p.fetched.length, 1);
	p.events.get('pagehide')();
	assert.deepEqual(p.revoked, ['blob:https://velora.test/artwork']);
});
