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
	workers.register = async () => { registrations++; };
	const messages = [];
	const parent = { postMessage: (...args) => messages.push(args) };
	const context = { URL, navigator: { serviceWorker: workers }, parent, self: {},
		location: { href: 'https://velora.test/proxy-frame.html?request=123', origin: 'https://velora.test' },
		setTimeout, clearTimeout };
	const result = vm.runInNewContext(readFileSync(new URL('../static/proxy-frame.js', import.meta.url), 'utf8'), context);
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(registrations, 1);
	assert.equal(messages.length, 0);
	workers.controller = { scriptURL: 'https://velora.test/servy.js' };
	workers.dispatchEvent(new Event('controllerchange'));
	await result;
	assert.equal(messages[0][0].request, '123');
	assert.equal(messages[0][0].error, undefined);
	assert.equal(messages[0][1], 'https://velora.test');
});
