import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as reset from '../src/lib/utils/reset-core.js';

const id = '24b21ac4-d98d-451b-ad11-bb9b100aa000';
function storage(initial = {}, events = [], label = '') {
	const values = new Map(Object.entries(initial));
	return {
		get length() { return values.size; },
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
		removeItem: key => values.delete(key),
		clear() { events.push(`${label}:clear`); values.clear(); }
	};
}
function fakeHost() {
	const events = [], listeners = new Map(), channels = [];
	const host = {
		localStorage: storage({ notes: 'keep until confirmed' }, events, 'local'),
		sessionStorage: storage({ tabs: 'saved tabs' }, events, 'session'),
		location: { origin: 'https://velora.test', hostname: 'velora.test', protocol: 'https:', search: '', replace: url => events.push(`navigate:${url}`) },
		crypto: { randomUUID: () => id }, navigator: {},
		document: { documentElement: {}, cookie: 'session=abc; __Host-proxy=def', querySelectorAll: () => [{ remove: () => events.push('iframe:remove') }] },
		addEventListener: (type, fn) => listeners.set(type, fn),
		removeEventListener: type => listeners.delete(type),
		stop: () => events.push('stop'),
		BroadcastChannel: class { constructor() { channels.push(this); } close() { events.push('channel:close'); } postMessage() {} }
	};
	host.parent = host;
	return { host, events, listeners, channels };
}
function databaseStore(names, { blocked = false, fail = false, residual = false } = {}) {
	const active = new Set(names), requests = [];
	return {
		requests,
		async databases() { return [...active].map(name => ({ name })); },
		deleteDatabase(name) {
			const request = { release() { if (!residual) active.delete(name); request.onsuccess(); } };
			requests.push(request);
			queueMicrotask(() => fail ? request.onerror() : blocked ? request.onblocked() : request.release());
			return request;
		}
	};
}
function cacheStore(names, refuse = false) {
	const active = new Set(names);
	return { keys: async () => [...active], delete: async name => refuse ? false : active.delete(name) };
}

test('requesting reset records confirmation intent and navigates without deleting saved data', () => {
	const { host, events } = fakeHost();
	const top = { document: {}, location: { replace: url => events.push(`top:${url}`) } }; top.parent = top; host.parent = top;
	const intent = reset.beginSiteReset(host, '/index.html');
	assert.equal(intent.id, id);
	assert.equal(reset.readResetIntent(host, id).returnTo, '/index.html');
	assert.equal(host.localStorage.getItem('notes'), 'keep until confirmed');
	assert.equal(host.sessionStorage.getItem('tabs'), 'saved tabs');
	assert.ok(events[0].startsWith('top:https://velora.test/reset.html?'));
	assert.equal(events.some(event => event.endsWith(':clear')), false);
});

test('reset requires a matching recent intent and cannot redirect off site', () => {
	const { host } = fakeHost();
	assert.equal(reset.readResetIntent(host, id), null);
	host.sessionStorage.setItem(reset.resetIntentKey, JSON.stringify({ id, time: 1000, returnTo: 'https://evil.test' }));
	assert.equal(reset.readResetIntent(host, id, 1001).returnTo, '/');
	assert.equal(reset.readResetIntent(host, 'another-reset-000000000000', 1001), null);
	assert.equal(reset.readResetIntent(host, id, 999), null);
	assert.equal(reset.readResetIntent(host, id, 301000), null);
	assert.equal(new URL(reset.resetPageUrl(host, id, '//evil.test')).origin, host.location.origin);
	assert.equal(new URL(reset.resetPageUrl(host, id, '//evil.test')).searchParams.get('return'), '/');
});

test('coordinator ignores unconfirmed messages, then freezes apps and prevents stale saves', () => {
	const { host, events, channels, listeners } = fakeHost();
	const coordinator = reset.installResetCoordinator(host);
	channels[0].onmessage({ data: { type: 'start', id } });
	assert.equal(coordinator.holding, false);
	assert.equal(events.length, 0);
	host.localStorage.setItem(reset.resetStorageKey, JSON.stringify({ id, returnTo: '/index.html' }));
	listeners.get('storage')({ key: reset.resetStorageKey });
	assert.equal(coordinator.holding, true);
	assert.equal(host.document.documentElement.inert, true);
	assert.ok(events.includes('iframe:remove'));
	assert.equal(JSON.parse(host.sessionStorage.getItem(reset.resetWaitKey)).id, id);
	assert.ok(events.some(event => event.includes('phase=wait')));
	host.localStorage.clear();
	assert.equal(reset.resetInProgress(host), true, 'old page remains paused after the marker is removed');
	coordinator.dispose();
	assert.equal(listeners.has('storage'), false);
});

test('a newly opened app immediately joins an existing reset', () => {
	const { host } = fakeHost();
	host.localStorage.setItem(reset.resetStorageKey, JSON.stringify({ id }));
	assert.equal(reset.installResetCoordinator(host).holding, true);
});

test('all background worker registrations must be removed before clearing data', async () => {
	const { host } = fakeHost();
	let active = [1, 2];
	host.navigator.serviceWorker = { getRegistrations: async () => active.map(key => ({ unregister: async () => { active = active.filter(value => value !== key); } })) };
	await reset.unregisterSiteWorkers(host);
	assert.deepEqual(active, []);
	host.navigator.serviceWorker = { getRegistrations: async () => [{ unregister: async () => false }] };
	await assert.rejects(reset.unregisterSiteWorkers(host), /still active/);
});

test('full cleanup removes all databases, offline files, caches, and preferences in safe order', async () => {
	const { host, events } = fakeHost();
	host.localStorage.setItem(reset.resetStorageKey, JSON.stringify({ id }));
	host.indexedDB = databaseStore(['settings', 'game-save', 'proxy-cookies']);
	host.caches = cacheStore(['shell', 'proxy']);
	const files = new Set(['notes', 'proxy-files']);
	host.navigator.storage = { getDirectory: async () => ({
		async *entries() { for (const name of files) yield [name, {}]; },
		async removeEntry(name, options) { assert.equal(options.recursive, true); files.delete(name); }
	}) };
	const cookies = [];
	Object.defineProperty(host.document, 'cookie', { get: () => 'session=abc; __Host-proxy=def', set: value => cookies.push(value) });
	await reset.clearSiteData(host, { beforeFinish() {
		assert.ok(reset.readResetMarker(host), 'marker remains until cleanup succeeds');
		assert.equal(host.sessionStorage.getItem('tabs'), 'saved tabs');
	} });
	assert.deepEqual(await host.indexedDB.databases(), []);
	assert.deepEqual(await host.caches.keys(), []);
	assert.equal(files.size, 0);
	assert.equal(host.sessionStorage.length, 0);
	assert.equal(host.localStorage.length, 0);
	assert.deepEqual(events, ['session:clear', 'local:clear']);
	assert.ok(cookies.some(value => value.startsWith('__Host-proxy=;') && value.includes('Path=/;') && value.includes('; Secure') && !value.includes('Domain=')));
});

test('blocked database deletion waits for release and never reports false completion', async () => {
	const { host, events } = fakeHost();
	host.indexedDB = databaseStore(['game-save'], { blocked: true });
	const progress = [];
	let finished = false;
	const work = reset.clearSiteData(host, { onprogress: stage => progress.push(stage) }).then(() => { finished = true; });
	await new Promise(resolve => setImmediate(resolve));
	assert.ok(progress.includes('blocked'));
	assert.equal(finished, false);
	assert.equal(events.length, 0);
	host.indexedDB.requests[0].release();
	await work;
	assert.equal(finished, true);
});

test('failed or unsupported database cleanup preserves the reset marker and preferences', async () => {
	for (const database of [{ deleteDatabase() {} }, databaseStore(['settings'], { fail: true }), databaseStore(['settings'], { residual: true })]) {
		const { host, events } = fakeHost();
		host.localStorage.setItem(reset.resetStorageKey, JSON.stringify({ id }));
		host.indexedDB = database;
		await assert.rejects(reset.clearSiteData(host));
		assert.ok(reset.readResetMarker(host));
		assert.equal(host.localStorage.getItem('notes'), 'keep until confirmed');
		assert.deepEqual(events, []);
	}
});

test('cache failures and interrupted reset cannot silently return to a fresh desktop', async () => {
	const { host, events } = fakeHost();
	host.caches = cacheStore(['stuck-cache'], true);
	await assert.rejects(reset.clearSiteData(host), /cached data/);
	assert.deepEqual(events, []);
	host.caches = cacheStore([]);
	await assert.rejects(reset.clearSiteData(host, { beforeFinish() { throw new Error('interrupted'); } }), /interrupted/);
	assert.deepEqual(events, []);
});

function controllerPage(search, setup = () => {}) {
	const fixture = fakeHost();
	fixture.host.location.search = search;
	const nodes = new Map();
	const document = { getElementById(name) { if (!nodes.has(name)) nodes.set(name, { hidden: false, focus() {} }); return nodes.get(name); } };
	setup(fixture);
	const code = readFileSync(new URL('../static/site-reset.js', import.meta.url), 'utf8').replace(/^import .*?;\n/, '');
	vm.runInNewContext(code, { ...reset, window: fixture.host, document, URL, URLSearchParams, BroadcastChannel: fixture.host.BroadcastChannel });
	return { ...fixture, nodes };
}

test('opening a reset URL without confirming does not erase anything', () => {
	for (const query of ['', `?id=${id}&phase=clear`, `?id=${id}&phase=wait`]) {
		const { host, events } = controllerPage(query);
		assert.equal(host.localStorage.getItem('notes'), 'keep until confirmed');
		assert.equal(host.sessionStorage.getItem('tabs'), 'saved tabs');
		assert.equal(events.some(event => event.endsWith(':clear')), false);
	}
});

test('only a participating wait page clears its old session after a completed reset', () => {
	const { host, events } = controllerPage(`?id=${id}&phase=wait`, ({ host }) => {
		host.sessionStorage.setItem(reset.resetWaitKey, JSON.stringify({ id }));
	});
	assert.equal(host.sessionStorage.length, 0);
	assert.ok(events.some(event => event === 'navigate:https://velora.test/'));
});

test('deployed reset core is identical to the app implementation', () => {
	assert.equal(readFileSync(new URL('../static/reset-core.js', import.meta.url), 'utf8'), readFileSync(new URL('../src/lib/utils/reset-core.js', import.meta.url), 'utf8'));
});
