import test from 'node:test';
import assert from 'node:assert/strict';
import { activityOwner, activityTarget, activityReason, createActivityHub, getActivityHub, recordActivity, setDeveloperMode, installActivityCollector, developerModeKey } from '../src/lib/utils/developer/diagnostics.js';
import { resetStorageKey } from '../src/lib/utils/reset-core.js';

function fakeHost() {
	const listeners = new Map(), values = new Map(), consoleCalls = [], observers = [];
	const host = {
		location: { origin:'https://velora.test', pathname:'/os' },
		localStorage: { getItem:key => values.get(key) ?? null, setItem:(key, value) => values.set(key, value) },
		document: { querySelector:() => ({}) }, navigator: {},
		addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
		removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
		console: Object.fromEntries(['log', 'info', 'debug', 'warn', 'error'].map(method => [method, function (...args) { consoleCalls.push({ method, args, receiver:this }); return method; }])),
		PerformanceObserver: class {
			constructor(callback) { this.callback = callback; observers.push(this); }
			observe(options) { this.options = options; }
			disconnect() { this.stopped = true; }
		}
	};
	host.parent = host;
	const fire = (type, event = {}) => { for (const listener of [...listeners.get(type) || []]) listener(event); };
	return { host, fire, values, consoleCalls, listeners, observers };
}

test('developer mode starts off, pauses without buffering, and clears history when disabled', () => {
	let time = 1000;
	const hub = createActivityHub({ now:() => time++ });
	hub.record('error');
	assert.equal(hub.snapshot().entries.length, 0);
	hub.setEnabled(true);
	assert.equal(hub.snapshot().open, true);
	hub.record('app-open');
	hub.setPaused(true);
	hub.record('app-close');
	assert.equal(hub.snapshot().entries.length, 2);
	hub.setPaused(false);
	hub.record('app-load');
	assert.equal(hub.snapshot().entries.length, 3);
	hub.setEnabled(false);
	assert.equal(hub.snapshot().entries.length, 0);
	assert.equal(hub.snapshot().open, false);
	hub.setEnabled(true);
	assert.equal(hub.snapshot().entries.length, 1, 'only the new enable event remains');
});

test('busy activity is bounded to 400 entries with stable IDs and immutable snapshots', () => {
	const hub = createActivityHub(); hub.setEnabled(true);
	for (let n = 0; n < 1000; n++) hub.record('resource', { duration:n });
	const state = hub.snapshot();
	assert.equal(state.entries.length, 400);
	assert.equal(state.dropped, 601);
	assert.equal(new Set(state.entries.map(entry => entry.id)).size, 400);
	assert.throws(() => state.entries.push({}));
	assert.throws(() => { state.entries[0].details.duration = -1; });
	hub.clear();
	assert.equal(hub.snapshot().entries.length, 0);
	assert.equal(hub.snapshot().dropped, 0);
});

test('activity never retains URLs with credentials, arbitrary paths, queries, or fragments', () => {
	assert.equal(activityTarget('https://name:password@example.com/private/token?password=secret#access_token=secret'), 'https://example.com');
	assert.equal(activityTarget('/api?url=https://private.test/secret', 'https://velora.test'), 'App frame');
	assert.equal(activityTarget('/prism/encoded-secret?token=secret', 'https://velora.test'), 'https://velora.test');
	assert.equal(activityTarget('data:text/html,private'), undefined);
	assert.equal(activityTarget('blob:https://example.com/secret'), undefined);
	const hub = createActivityHub(); hub.setEnabled(true);
	hub.record('not-an-approved-event', { password:'secret' });
	hub.record('attempt', { engine:'sj2', transport:'epoxy', target:'https://name:secret@example.com/private?code=secret', password:'secret', message:'secret', body:{ secret:true }, duration:-1, bytes:Infinity }, { path:'/private-secret', base:'https://velora.test' });
	const state = hub.snapshot();
	assert.equal(state.entries.length, 2);
	assert.deepEqual(state.entries[1].details, { engine:'sj2', transport:'epoxy', target:'https://example.com' });
	assert.doesNotMatch(JSON.stringify(state), /secret|password|private|Infinity/);
});

test('error details use known classes and categories without retaining private messages', () => {
	assert.equal(activityReason(new DOMException('private', 'AbortError')), 'Cancelled');
	assert.equal(activityReason(new Error('Fetch failed: token=private')), 'Network error');
	assert.equal(activityReason(new Error('Timed out on private URL')), 'Timed out');
	assert.equal(activityReason(new Error('Access denied for private user')), 'Access restricted');
	assert.equal(activityReason(new Error('private text')), 'Unknown error');
	assert.equal(activityReason({ get message() { throw Error('private'); } }), 'Unknown error');
});

test('same-origin app frames share one tab hub and only the preference is saved', () => {
	const { host, values } = fakeHost();
	const child = { ...host, location:{ ...host.location, pathname:'/api' }, parent:host };
	assert.equal(getActivityHub(host), getActivityHub(child));
	setDeveloperMode(true, child);
	recordActivity('attempt', { engine:'uv', transport:'libcurlRaw', target:'https://play.geforcenow.com/mall/?token=secret' }, child);
	const entry = getActivityHub(host).snapshot().entries.at(-1);
	assert.equal(entry.source, 'App frame');
	assert.equal(entry.details.target, 'https://play.geforcenow.com');
	assert.deepEqual([...values], [[developerModeKey, 'true']]);
	setDeveloperMode(false, host);
	assert.equal(getActivityHub(child).snapshot().entries.length, 0);
});

test('collectors remain inactive until enabled and restore original console methods on disable', () => {
	const { host, observers, consoleCalls, listeners } = fakeHost();
	const original = host.console.warn;
	const dispose = installActivityCollector(host);
	assert.equal(observers.length, 0);
	assert.equal(host.console.warn, original);
	setDeveloperMode(true, host);
	assert.equal(observers.length, 1);
	assert.equal(observers[0].options.buffered, false);
	const secret = { password:'private', toString() { throw Error('must not stringify'); } };
	assert.equal(host.console.warn('private', secret), 'warn');
	assert.equal(consoleCalls[0].receiver, host.console);
	assert.equal(consoleCalls[0].args[1], secret);
	const entry = getActivityHub(host).snapshot().entries.at(-1);
	assert.deepEqual(entry.details, { method:'warn', arguments:2 });
	assert.equal(entry.severity, 'warn');
	assert.doesNotMatch(JSON.stringify(getActivityHub(host).snapshot()), /private|password/);
	setDeveloperMode(false, host);
	assert.equal(host.console.warn, original);
	assert.equal(observers[0].stopped, true);
	assert.equal(listeners.get('error').size, 0);
	dispose();
	assert.equal(listeners.get('storage').size, 0);
});

test('resource timings and errors are useful metadata, not sensitive contents', () => {
	const { host, observers, fire } = fakeHost();
	installActivityCollector(host); setDeveloperMode(true, host);
	observers[0].callback({ getEntries:() => [{ name:'https://cdn.test/private?auth=secret', initiatorType:'fetch', duration:12.6, responseStatus:503, transferSize:2500 }] });
	fire('unhandledrejection', { reason:new TypeError('Failed to fetch secret') });
	fire('error', { target:host, error:new ReferenceError('privateVar is not defined'), filename:'https://velora.test/private.js?token=secret', lineno:42, colno:8 });
	const entries = getActivityHub(host).snapshot().entries;
	assert.equal(entries.at(-3).details.duration, 13);
	assert.equal(entries.at(-3).details.status, 503);
	assert.equal(entries.at(-3).severity, 'warn');
	assert.equal(entries.at(-2).details.reason, 'Network error');
	assert.equal(entries.at(-1).details.errorClass, 'ReferenceError');
	assert.equal(entries.at(-1).details.line, 42);
	assert.doesNotMatch(JSON.stringify(entries), /secret|private/);
});

test('another tab can switch mode off and site reset cannot repopulate developer data', () => {
	const { host, values, fire } = fakeHost();
	installActivityCollector(host); setDeveloperMode(true, host);
	values.set(developerModeKey, 'false'); fire('storage', { key:developerModeKey });
	assert.equal(getActivityHub(host).snapshot().enabled, false);
	setDeveloperMode(true, host);
	values.set(resetStorageKey, JSON.stringify({ id:'24b21ac4-d98d-451b-ad11-bb9b100aa000' }));
	const count = getActivityHub(host).snapshot().entries.length;
	recordActivity('app-open', {}, host);
	assert.equal(getActivityHub(host).snapshot().entries.length, count);
	assert.equal(setDeveloperMode(false, host), false);
	values.clear(); fire('storage', { key:null });
	assert.equal(getActivityHub(host).snapshot().enabled, false);
	assert.equal(getActivityHub(host).snapshot().entries.length, 0);
});

test('unsupported timing APIs and disabled storage do not break app activity', () => {
	const { host } = fakeHost(); delete host.PerformanceObserver;
	host.localStorage.setItem = () => { throw Error('denied'); };
	const dispose = installActivityCollector(host);
	assert.equal(setDeveloperMode(true, host), false);
	assert.equal(getActivityHub(host).snapshot().enabled, true);
	recordActivity('app-open', {}, host);
	assert.equal(getActivityHub(host).snapshot().entries.at(-1).message, 'App window opened');
	dispose();
});

test('unloading an app releases collection and a page-cache restore can resume it', () => {
	const { host, fire, observers } = fakeHost();
	const original = host.console.log;
	const dispose = installActivityCollector(host);
	setDeveloperMode(true, host);
	fire('pagehide');
	assert.equal(host.console.log, original);
	assert.equal(observers[0].stopped, true);
	const count = getActivityHub(host).snapshot().entries.length;
	host.console.log('not collected after unloading');
	assert.equal(getActivityHub(host).snapshot().entries.length, count);
	fire('pageshow');
	assert.notEqual(host.console.log, original);
	assert.equal(observers.length, 2);
	dispose();
	fire('pageshow');
	assert.equal(host.console.log, original);
});

test('cloaked wrappers keep the console on the actual Velora desktop', () => {
	const { host } = fakeHost();
	const wrapper = { document:{ querySelector:() => null } }; wrapper.parent = wrapper;
	host.parent = wrapper;
	const child = { ...host, parent:host };
	assert.equal(activityOwner(host), host);
	assert.equal(activityOwner(child), host);
	assert.equal(getActivityHub(child), getActivityHub(host));
	assert.equal(Object.keys(wrapper).some(key => key.includes('DeveloperActivity')), false);
});
