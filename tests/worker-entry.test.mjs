import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function worker(path, { connected = true } = {}) {
  const listeners = new Map();
  const calls = [];
  const context = {
    URL, Response,
    location: { origin: 'https://velora.example' },
    addEventListener(type, listener) { listeners.set(type, listener); },
    skipWaiting() { calls.push('skip'); return Promise.resolve(); },
    clients: { claim() { calls.push('claim'); return Promise.resolve(); } },
    importScripts() {
      // At first dependency evaluation the entry must already route requests.
      assert.ok(listeners.has('fetch'));
      assert.ok(listeners.has('install'));
      assert.ok(listeners.has('activate'));
    },
    UVServiceWorker: class {
      route(event) { return event.request.url.includes('/service/glass/'); }
      fetch() { calls.push('uv'); return new Response('uv'); }
    },
    $scramjetLoadWorker() { return { ScramjetServiceWorker: class {
      async loadConfig() { calls.push('polygon-config'); }
      route() { return true; }
      fetch() { calls.push('polygon'); return new Response('polygon'); }
    } }; },
    $scramjetController: {
      shouldRoute() { return connected; },
      route(event) { calls.push(['prism', event.request]); return new Response('prism'); }
    },
    isPrismProxyRequest(url) { return new URL(url).pathname.startsWith('/prism/'); },
    recoverPrismProxyRoute(event) { calls.push(['recover', event.request]); return new Response('recovered'); },
    recoverGeForceProxyRoute(event) { calls.push(['recover', event.request]); return new Response('recovered'); },
    fetch(request) { calls.push(['network', request]); return new Response('native'); }
  };
  context.self = context;
  vm.runInNewContext(await readFile(new URL(path, import.meta.url), 'utf8'), context);
  return { calls, listeners, async request(pathname, method = 'GET') {
    let result;
    const request = { url: 'https://velora.example' + pathname, method, body: method === 'POST' ? 'form=value' : null };
    listeners.get('fetch')({ request, respondWith(value) { result = value; } });
    return { request, response: result ? await result : undefined };
  } };
}

test('entry handlers activate and claim before importing any engine', async () => {
  for (const path of ['../static/servy.js', '../static/geforce/servy.js']) {
    const w = await worker(path);
    const waits = [];
    w.listeners.get('install')({ waitUntil(promise) { waits.push(promise); } });
    w.listeners.get('activate')({ waitUntil(promise) { waits.push(promise); } });
    await Promise.all(waits);
    assert.deepEqual(w.calls, ['skip', 'claim']);
  }
});

test('the readiness probe proves interception without contacting S3 or the relay', async () => {
  const w = await worker('../static/servy.js');
  const { response } = await w.request('/__velora_proxy_ready?request=unique-test');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Velora-Proxy-Ready'), '1');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(await response.text(), 'unique-test');
  assert.deepEqual(w.calls, []);
});

test('browser proxy request is handled without reaching the site host', async () => {
  const w = await worker('../static/servy.js');
  const { request, response } = await w.request('/prism/controller/frame/url');
  assert.equal(await response.text(), 'prism');
  assert.equal(w.calls[0][1], request);
  assert.equal(w.calls.length, 1);
});

test('worker restart recovers the original submitted request without network fallthrough', async () => {
  for (const path of ['../static/servy.js', '../static/geforce/servy.js']) {
    const w = await worker(path, { connected: false });
    const { request, response } = await w.request(path.includes('geforce') ? '/geforce/proxy/controller/frame/url' : '/prism/controller/frame/url', 'POST');
    assert.equal(await response.text(), 'recovered');
    assert.equal(w.calls[0][1], request);
    assert.equal(w.calls.length, 1);
  }
});

test('native assets, local games, and older proxy engines retain their routes', async () => {
  const w = await worker('../static/servy.js', { connected: false });
  assert.equal(await (await w.request('/books')).response.text(), 'native');
  assert.equal(await (await w.request('/games/example/index.html')).response.text(), 'native');
  assert.equal(await (await w.request('/service/glass/url')).response.text(), 'uv');
  assert.equal(await (await w.request('/polygon/url')).response.text(), 'polygon');
});
