import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProxyFrame, resetProxyFrame } from '../src/lib/lethe/prepare-frame.js';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function fixture() {
	const host = new EventTarget();
	host.location = { origin: 'https://velora.test' };
	host.crypto = { randomUUID: () => 'request-123' };
	const frame = { contentWindow: {}, src: '' };
	const reply = (fields = {}, data = {}) => {
		const event = new Event('message');
		Object.assign(event, { origin: host.location.origin, source: frame.contentWindow,
			data: { type: 'velora:frame-ready', request: 'request-123', ...data }, ...fields });
		host.dispatchEvent(event);
	};
	return { host, frame, reply };
}

test('app navigation waits for readiness from its exact same-origin iframe', async () => {
	const f = fixture();
	let ready = false;
	const pending = prepareProxyFrame(f.frame, { host: f.host }).then(() => ready = true);
	assert.match(f.frame.src, /^\/proxy-frame.html\?request=/);
	f.reply({ origin: 'https://other.test' });
	f.reply({ source: {} });
	f.reply({}, { request: 'wrong' });
	await Promise.resolve();
	assert.equal(ready, false);
	f.reply();
	await pending;
	assert.equal(ready, true);
	await prepareProxyFrame(f.frame, { host: f.host });
	resetProxyFrame(f.frame);
	const retry = prepareProxyFrame(f.frame, { host: f.host });
	f.reply();
	await retry;
});

test('failed or closed launches reject and can be retried', async () => {
	const f = fixture();
	const failed = prepareProxyFrame(f.frame, { host: f.host });
	f.reply({}, { error: true });
	await assert.rejects(failed, /could not start/);
	const abort = new AbortController();
	const cancelled = prepareProxyFrame(f.frame, { host: f.host, signal: abort.signal });
	abort.abort();
	await assert.rejects(cancelled, { name: 'AbortError' });
	const retry = prepareProxyFrame(f.frame, { host: f.host });
	f.reply();
	await retry;
});

test('an unresponsive iframe times out rather than loading forever', async () => {
	const f = fixture();
	await assert.rejects(prepareProxyFrame(f.frame, { host: f.host, timeoutMs: 5 }), /timed out/);
});

test('the readiness page waits for control in its own document before replying', async () => {
	const workers = new EventTarget();
	workers.controller = null;
	workers.ready = Promise.resolve();
	let registrations = 0;
	const active = new EventTarget();
	Object.assign(active, { scriptURL: 'https://velora.test/servy.js', state: 'activated' });
	workers.register = async () => { registrations++; return { active }; };
	const messages = [];
	const parent = { postMessage: (...args) => messages.push(args) };
	const context = { URL, navigator: { serviceWorker: workers }, parent, self: {},
		location: { href: 'https://velora.test/proxy-frame.html?request=123', origin: 'https://velora.test' },
		fetch: async () => new Response('123', { headers: { 'X-Velora-Proxy-Ready': '1' } }),
		setTimeout, clearTimeout };
	const result = vm.runInNewContext(readFileSync(new URL('../static/proxy-frame.js', import.meta.url), 'utf8'), context);
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(registrations, 1);
	assert.equal(messages.length, 0);
	workers.controller = active;
	workers.dispatchEvent(new Event('controllerchange'));
	await result;
	assert.equal(messages[0][0].request, '123');
	assert.equal(messages[0][0].error, undefined);
	assert.equal(messages[0][1], 'https://velora.test');
});

async function readinessFixture({ validProbe = true, updating = false, recover = false } = {}) {
	const workers = new EventTarget();
	const old = { scriptURL: 'https://velora.test/servy.js', state: 'activated' };
	const next = Object.assign(new EventTarget(), { scriptURL: old.scriptURL, state: updating ? 'installing' : 'activated' });
	workers.controller = old;
	let updates = 0;
	const registration = updating ? { active: old, installing: next } : { active: next };
	registration.update = async () => { updates++; };
	workers.register = async () => registration;
	const messages = [], probes = [], activations = [];
	next.postMessage = message => activations.push(message);
	const context = { URL, navigator: { serviceWorker: workers }, parent: { postMessage: data => messages.push(data) }, self: {},
		location: { href: 'https://velora.test/proxy-frame.html?request=123', origin: 'https://velora.test' },
		fetch: async (url, options) => { probes.push({ url, options }); return validProbe || (recover && updates > 0)
			? new Response('123', { headers: { 'X-Velora-Proxy-Ready': '1' } })
			: new Response('AccessDenied', { status: 403 }); }, setTimeout, clearTimeout };
	const pending = vm.runInNewContext(readFileSync(new URL('../static/proxy-frame.js', import.meta.url), 'utf8'), context);
	await new Promise(resolve => setImmediate(resolve));
	return { workers, next, messages, probes, activations, pending };
}

test('readiness does not mistake the previous worker at the same URL for an activated update', async () => {
	const f = await readinessFixture({ updating: true });
	assert.equal(f.messages.length, 0);
	assert.equal(f.probes.length, 0);
	f.next.state = 'activated';
	f.next.dispatchEvent(new Event('statechange'));
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(f.messages.length, 0);
	f.workers.controller = f.next;
	f.workers.dispatchEvent(new Event('controllerchange'));
	await f.pending;
	assert.equal(f.messages[0].error, undefined);
	assert.equal(f.probes.length, 1);
	assert.equal(f.probes[0].options.cache, 'no-store');
});

test('readiness reports a routing error instead of allowing an app navigation to S3', async () => {
	const f = await readinessFixture({ validProbe: false });
	f.workers.controller = f.next;
	f.workers.dispatchEvent(new Event('controllerchange'));
	await f.pending;
	assert.equal(f.messages.length, 1);
	assert.equal(f.messages[0].error, true);
	assert.equal(f.probes.length, 2);
});

test('an old active worker gets one update and a safe routing probe before app navigation', async () => {
	const f = await readinessFixture({ validProbe: false, recover: true });
	f.workers.controller = f.next;
	f.workers.dispatchEvent(new Event('controllerchange'));
	await f.pending;
	assert.equal(f.probes.length, 2);
	assert.equal(f.messages.length, 1);
	assert.equal(f.messages[0].error, undefined);
});

test('the readiness frame wakes a Safari replacement that reaches installed but stays waiting', async () => {
	const f = await readinessFixture({ updating: true });
	f.next.state = 'installed';
	f.next.dispatchEvent(new Event('statechange'));
	f.next.dispatchEvent(new Event('statechange'));
	assert.equal(f.activations.length, 1);
	assert.equal(f.activations[0].type, 'velora:activate-worker');
	assert.equal(f.messages.length, 0);
	f.next.state = 'activated';
	f.next.dispatchEvent(new Event('statechange'));
	await new Promise(resolve => setImmediate(resolve));
	f.workers.controller = f.next;
	f.workers.dispatchEvent(new Event('controllerchange'));
	await f.pending;
	assert.equal(f.messages[0].error, undefined);
});
