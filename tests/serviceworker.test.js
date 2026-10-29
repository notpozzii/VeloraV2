import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerProxyWorker } from '../src/lib/lethe/serviceworker.js';

function worker({ controlled = false, failure = false } = {}) {
 const listeners = new Set();
 const active = { scriptURL: 'https://velora.example/servy.js' };
 return {
  controller: controlled ? active : null,
  ready: Promise.resolve(),
  async register() { if (failure) throw new Error('Storage blocked'); return { scope: 'https://velora.example/' }; },
  addEventListener(type, handler) { listeners.add(handler); },
  removeEventListener(type, handler) { listeners.delete(handler); },
  claim() { this.controller = active; for (const listener of listeners) listener(); },
  listeners
 };
}

test('registration alone does not permit navigation; control handoff does', async () => {
 const sw = worker();
 let settled = false;
 const startup = registerProxyWorker(sw, 1000).then(result => { settled = true; return result; });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(settled, false);
 sw.claim();
 assert.equal(await startup, sw.controller);
 assert.equal(sw.listeners.size, 0);
});

test('already controlled pages can proceed', async () => {
 const sw = worker({ controlled: true });
 assert.equal(await registerProxyWorker(sw), sw.controller);
});

test('a previous worker with the same URL cannot release navigation before the update controls the page', async () => {
 const sw = worker({ controlled: true });
 const states = new Set();
 const next = {
  scriptURL: sw.controller.scriptURL, state: 'installing',
  addEventListener(type, callback) { states.add(callback); },
  removeEventListener(type, callback) { states.delete(callback); }
 };
 sw.register = async () => ({ scope: 'https://velora.example/', installing: next });
 let settled = false;
 const startup = registerProxyWorker(sw, 1000).then(value => { settled = true; return value; });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(settled, false);
 next.state = 'activated';
 for (const callback of states) callback();
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(settled, false, 'activation alone does not establish control');
 sw.controller = next;
 for (const callback of sw.listeners) callback();
 assert.equal(await startup, next);
 assert.equal(states.size, 0);
 assert.equal(sw.listeners.size, 0);
});

test('timed-out worker updates remove state listeners', async () => {
 const sw = worker({ controlled: true });
 const states = new Set();
 const next = { state: 'installing', addEventListener(type, fn) { states.add(fn); }, removeEventListener(type, fn) { states.delete(fn); } };
 sw.register = async () => ({ scope: 'https://velora.example/', installing: next });
 await assert.rejects(registerProxyWorker(sw, 10), /proxy could not start/);
 assert.equal(states.size, 0);
});

test('an installed Safari worker receives one activation request before navigation can continue', async () => {
 const sw = worker({ controlled: true });
 const states = new Set(), messages = [];
 const next = {
  scriptURL: sw.controller.scriptURL, state: 'installed',
  addEventListener(type, callback) { states.add(callback); },
  removeEventListener(type, callback) { states.delete(callback); },
  postMessage(message) { messages.push(message); }
 };
 sw.register = async () => ({ scope: 'https://velora.example/', waiting: next, async update() {} });
 let settled = false;
 const pending = registerProxyWorker(sw, 1000).then(value => { settled = true; return value; });
 await new Promise(resolve => setImmediate(resolve));
 for (const callback of states) callback();
 assert.deepEqual(messages, [{ type: 'velora:activate-worker' }]);
 assert.equal(settled, false);
 next.state = 'activated';
 for (const callback of states) callback();
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(settled, false);
 sw.controller = next;
 for (const callback of sw.listeners) callback();
 assert.equal(await pending, next);
 assert.equal(states.size, 0);
 assert.equal(sw.listeners.size, 0);
});

test('a legacy waiting worker is updated before the startup helper selects its activation target', async () => {
 const sw = worker({ controlled: true });
 const states = new Set(), messages = [];
 const legacy = { state: 'installed', postMessage() { assert.fail('legacy worker has no activation handler'); } };
 const next = {
  scriptURL: sw.controller.scriptURL, state: 'installed',
  addEventListener(type, fn) { states.add(fn); }, removeEventListener(type, fn) { states.delete(fn); },
  postMessage(message) { messages.push(message); }
 };
 let updates = 0;
 const registration = { scope: 'https://velora.example/', waiting: legacy,
  async update() { updates++; this.waiting = next; }
 };
 sw.register = async () => registration;
 const pending = registerProxyWorker(sw, 1000);
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(updates, 1);
 assert.deepEqual(messages, [{type:'velora:activate-worker'}]);
 next.state = 'activated';
 for (const fn of states) fn();
 await new Promise(resolve => setImmediate(resolve));
 sw.controller = next;
 for (const fn of sw.listeners) fn();
 assert.equal(await pending, next);
});

test('concurrent startup and later tabs share one worker registration', async () => {
 const sw = worker();
 let registrations = 0;
 const register = sw.register;
 sw.register = async (...args) => { registrations++; return register(...args); };
 const first = registerProxyWorker(sw, 1000);
 const second = registerProxyWorker(sw, 1000);
 assert.equal(first, second);
 await new Promise(resolve => setImmediate(resolve));
 sw.claim();
 await first;
 await registerProxyWorker(sw);
 assert.equal(registrations, 1);
 sw.controller = { scriptURL: sw.controller.scriptURL };
 assert.equal(await registerProxyWorker(sw), sw.controller);
 assert.equal(registrations, 1);
});

test('failed registration is cleared so the next launch can retry', async () => {
 const sw = worker({ controlled: true, failure: true });
 await assert.rejects(registerProxyWorker(sw, 100), /proxy could not start/);
 sw.register = async () => ({ scope: 'https://velora.example/' });
 assert.equal(await registerProxyWorker(sw), sw.controller);
});

test('blocked registration returns actionable error', async () => {
 await assert.rejects(registerProxyWorker(worker({ failure: true }), 100), /proxy could not start/);
});

test('a missing control handoff times out and removes the listener', async () => {
 const sw = worker();
 await assert.rejects(registerProxyWorker(sw, 10), /proxy could not start/);
 assert.equal(sw.listeners.size, 0);
});

test('unsupported service workers return actionable error', async () => {
 await assert.rejects(registerProxyWorker(null), /proxy could not start/);
});

test('GeForce waits for its dedicated worker even if the desktop worker already controls the page', async () => {
 const sw = worker({ controlled: true });
 let registration;
 sw.register = async (scriptURL, options) => {
  registration = { scriptURL, options };
  return { scope: 'https://velora.example/geforce/' };
 };
 let settled = false;
 const startup = registerProxyWorker(sw, 1000, {
  scriptURL: '/geforce/servy.js', scope: '/geforce/'
 }).then(result => { settled = true; return result; });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(settled, false);
 assert.deepEqual(registration, { scriptURL: '/geforce/servy.js', options: {
  type: 'classic', updateViaCache: 'none', scope: '/geforce/'
 } });
 sw.controller = { scriptURL: 'https://velora.example/geforce/servy.js' };
 for (const listener of sw.listeners) listener();
 assert.equal(await startup, sw.controller);
 assert.equal(sw.listeners.size, 0);
});

function stuckRegistration({ healthy = false, networkError = false, failFresh = false } = {}) {
 const sw = worker({ controlled: true });
 const installed = new EventTarget();
 Object.assign(installed, { scriptURL: sw.controller.scriptURL, state: 'installed', postMessage() {} });
 let removed = false, registrations = 0, repairs = 0, probes = 0;
 const legacy = { scope: 'https://velora.example/', active: sw.controller, waiting: installed,
  async update() {}, async unregister() { repairs++; removed = true; return true; }
 };
 const fresh = { scriptURL: installed.scriptURL, state: 'activated' };
 sw.register = async () => {
  registrations++;
  if (removed) {
   if (failFresh) throw Error('Fresh registration failed');
   sw.controller = fresh;
   return { scope: legacy.scope, active: fresh };
  }
  return legacy;
 };
 sw.getRegistration = async () => legacy;
 const fetcher = async (url, options) => {
  probes++;
  assert.equal(new URL(url).pathname, '/__velora_proxy_ready');
  assert.equal(options.cache, 'no-store');
  if (networkError) throw Error('Offline');
  return new Response(healthy ? 'repair-check' : 'AccessDenied', { status: healthy ? 200 : 403,
   headers: healthy ? { 'X-Velora-Proxy-Ready': '1' } : {} });
 };
 return { sw, fetcher, fresh, counts: () => ({ registrations, repairs, probes }) };
}

test('a stuck legacy connection is recreated once and concurrent launches share the repair', async () => {
 const f = stuckRegistration();
 const options = { fetcher: f.fetcher };
 const first = registerProxyWorker(f.sw, 5, options);
 const second = registerProxyWorker(f.sw, 5, options);
 assert.equal(first, second);
 assert.equal(await first, f.fresh);
 assert.deepEqual(f.counts(), { registrations: 2, repairs: 1, probes: 1 });
 assert.equal(await registerProxyWorker(f.sw, 5, options), f.fresh);
 assert.deepEqual(f.counts(), { registrations: 2, repairs: 1, probes: 1 });
});

test('healthy interception and network outages never unregister the current connection', async () => {
 for (const settings of [{ healthy: true }, { networkError: true }]) {
  const f = stuckRegistration(settings);
  await assert.rejects(registerProxyWorker(f.sw, 5, { fetcher: f.fetcher }), /proxy could not start/);
  assert.deepEqual(f.counts(), { registrations: 1, repairs: 0, probes: 1 });
 }
});

test('a failed fresh registration is not repaired in a loop', async () => {
 const f = stuckRegistration({ failFresh: true });
 await assert.rejects(registerProxyWorker(f.sw, 5, { fetcher: f.fetcher }), /proxy could not start/);
 assert.deepEqual(f.counts(), { registrations: 2, repairs: 1, probes: 1 });
});
