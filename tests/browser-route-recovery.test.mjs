import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const publicDir = new URL('../static/', import.meta.url);

function worker(onRevive) {
  const handlers = new Map();
  const messages = [];
  let connected = false;
  let networkReads = 0;
  let legacyConfigReads = 0;
  let received;
  const scope = {
    location: { origin: 'https://velora.example' },
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(handler);
    },
    clients: { async matchAll() { return [
      { url: 'https://velora.example/slate', postMessage(message) {
        messages.push(message);
        onRevive?.(() => { connected = true; });
      } },
      { url: 'https://velora.example/geforce/', postMessage() { assert.fail('Desktop must not reset GeForce'); } }
    ]; } }
  };
  const context = vm.createContext({
    self: scope, URL, Response, Date, setTimeout,
    UVServiceWorker: class { route() { return false; } },
    $scramjetLoadWorker: () => ({ ScramjetServiceWorker: class {
      async loadConfig() { legacyConfigReads++; } route() { return false; }
    } }),
    $scramjetController: {
      shouldRoute: () => connected,
      async route(event) { received = event; return new Response('Remote page'); }
    },
    async fetch() { networkReads++; return new Response('Host 404', { status: 404 }); },
    importScripts(...paths) {
      for (const path of paths) {
        if (path === '/proxy-route-recovery.js') vm.runInContext(readFileSync(new URL(path.slice(1), publicDir), 'utf8'), context);
      }
    }
  });
  vm.runInContext(readFileSync(new URL('servy.js', publicDir), 'utf8'), context);
  return {
    scope, messages, handlers,
    get received() { return received; },
    get networkReads() { return networkReads; },
    get legacyConfigReads() { return legacyConfigReads; },
    async fetch(request) {
      let response;
      const event = { request, respondWith(value) { response = value; } };
      for (const handler of handlers.get('fetch')) handler(event);
      return await response;
    }
  };
}

test('a restarted browser worker restores a tab before its first remote page request', async () => {
  const runtime = worker(connect => setTimeout(connect, 5));
  const request = new Request('https://velora.example/prism/controller/frame/encoded');
  const response = await runtime.fetch(request);
  assert.equal(await response.text(), 'Remote page');
  assert.equal(runtime.received.request, request);
  assert.equal(runtime.networkReads, 0, 'proxy routes must never reach the site 404');
  assert.equal(runtime.messages.length, 1);
});

test('concurrent recovery shares revival and preserves POST bodies', async () => {
  const runtime = worker(connect => setTimeout(connect, 5));
  const post = new Request('https://velora.example/prism/controller/frame/callback', { method: 'POST', body: 'code=sign-in' });
  const [response] = await Promise.all([
    runtime.fetch(post),
    runtime.fetch(new Request('https://velora.example/prism/controller/frame/script'))
  ]);
  assert.equal(response.status, 200);
  assert.equal(await post.text(), 'code=sign-in');
  assert.equal(runtime.messages.length, 1);
  assert.equal(runtime.networkReads, 0);
});

test('engine assets, local pages, and other origins are not claimed as proxy sessions', async () => {
  const runtime = worker();
  for (const path of ['/prism/prism.js', '/prism/prism.api.js', '/prism/prism.wasm', '/slate', '/']) {
    assert.equal(runtime.scope.isPrismProxyRequest(`https://velora.example${path}`), false);
  }
  assert.equal(runtime.scope.isPrismProxyRequest('https://other.example/prism/controller/frame/page'), false);
});

test('native assets avoid legacy configuration reads; SJ URLs still load their configuration', async () => {
  const runtime = worker();
  for (const path of ['/prism/prism.js', '/prism/prism.wasm', '/slate', '/_app/immutable/app.js']) {
    await runtime.fetch(new Request(`https://velora.example${path}`));
  }
  assert.equal(runtime.legacyConfigReads, 0);
  await runtime.fetch(new Request('https://velora.example/polygon/encoded'));
  assert.equal(runtime.legacyConfigReads, 1);
});

test('expired sessions return a bounded reconnect response without requesting the host route', async () => {
  const runtime = worker();
  const response = await runtime.scope.recoverPrismProxyRoute({}, { shouldRoute: () => false }, 10);
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Refresh Velora/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(runtime.networkReads, 0);
});

test('revival preserves registered controllers while reconnecting missing controllers immediately', async () => {
  const listeners = new Map();
  const sent = [];
  let ports = 0;
  const firstWorker = { postMessage(message) { sent.push({ worker: this, message }); } };
  const serviceWorker = {
    controller: firstWorker,
    addEventListener(type, handler) { listeners.set(type, handler); }
  };
  const context = vm.createContext({
    navigator: { serviceWorker }, Response, Headers, EventTarget, WebSocket: {},
    BroadcastChannel: class { addEventListener() {} },
    MessageChannel: class {
      constructor() {
        ports++;
        this.port1 = { addEventListener() {}, removeEventListener() {}, start() {}, close() {} };
        this.port2 = {};
      }
    },
    $scramjet: { versionInfo: { version: '2.0.67-alpha.2' }, defaultConfig: { flags: {} }, Plugin: class {}, CookieJar: class {} }
  });
  vm.runInContext(readFileSync(new URL('prism/prism.api.js', publicDir), 'utf8'), context);
  const { Controller } = context.$scramjetController;
  Controller.prototype.loadScramjetWasm = async () => {};
  Controller.prototype.loadSavedCookies = async () => {};
  const controller = new Controller({ serviceworker: firstWorker, transport: {} });
  assert.equal(controller.guardServiceWorkerRevive, true, 'startup guard is active');
  listeners.get('message')({ data: { $controller$swrevive: { registered: [controller.id] } } });
  assert.equal(ports, 1, 'live ports remain intact');
  listeners.get('message')({ data: { $controller$swrevive: { registered: [] } } });
  assert.equal(ports, 2, 'missing ports recover even within the first five seconds');
  const secondWorker = { postMessage(message) { sent.push({ worker: this, message }); } };
  serviceWorker.controller = secondWorker;
  listeners.get('controllerchange')();
  assert.equal(ports, 3);
  assert.equal(sent.at(-1).worker, secondWorker, 'updates bind to the replacement worker');
  assert.equal(sent.at(-1).message.$controller$init.id, controller.id);
});
