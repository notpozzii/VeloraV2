import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../static/geforce/route-recovery.js', import.meta.url), 'utf8');
function worker(onRevive) {
  const handlers = new Map();
  const messages = [];
  const scope = {
    location: { origin: 'https://geforce.example' },
    addEventListener(name, handler) { handlers.set(name, handler); },
    clients: { async matchAll() { return [
      { url: 'https://geforce.example/geforce/', postMessage(message) { messages.push(message); onRevive?.(message); } },
      { url: 'https://geforce.example/slate', postMessage() { assert.fail('GeForce must not reset desktop browser sessions'); } }
    ]; } }
  };
  vm.runInNewContext(source, { self: scope, URL, Response, Date, setTimeout });
  return { scope, handlers, messages };
}

test('claims only local session URLs, leaving engine assets and external URLs alone', () => {
  const { scope } = worker();
  assert.equal(scope.isGeForceProxyRequest('https://geforce.example/geforce/proxy/controller/frame/encoded'), true);
  for (const path of ['/prism/prism.js', '/prism/prism.wasm', '/', '/launch.js']) {
    assert.equal(scope.isGeForceProxyRequest(`https://geforce.example${path}`), false);
  }
  assert.equal(scope.isGeForceProxyRequest('https://other.example/geforce/proxy/controller/frame/encoded'), false);
});

test('a restarted worker restores routing before dispatching the original Microsoft POST', async () => {
  let connected = false;
  const { scope, messages } = worker(() => { setTimeout(() => { connected = true; }, 5); });
  const event = { request: new Request('https://geforce.example/geforce/proxy/controller/frame/callback', {
    method: 'POST', body: 'code=test-code&state=test-state'
  }) };
  const controller = {
    shouldRoute: () => connected,
    async route(received) {
      assert.equal(received, event);
      assert.equal(received.request.method, 'POST');
      assert.equal(await received.request.text(), 'code=test-code&state=test-state');
      return new Response('Signed-in response');
    }
  };
  const response = await scope.recoverGeForceProxyRoute(event, controller, 100);
  assert.equal(await response.text(), 'Signed-in response');
  assert.equal(messages.length, 1);
  assert.deepEqual(Array.from(messages[0].$controller$swrevive.registered), []);
});

test('revival lists connected controllers so their existing ports are preserved', async () => {
  const { scope, handlers, messages } = worker();
  handlers.get('message')({ data: { $controller$init: { id: 'active-session' } } });
  const response = await scope.recoverGeForceProxyRoute({}, {
    shouldRoute: () => true,
    route: () => new Response('Ready')
  }, 100);
  assert.equal(response.status, 200);
  assert.deepEqual(Array.from(messages[0].$controller$swrevive.registered), ['active-session']);
});

test('an expired session gives a bounded reconnect error instead of the host 404', async () => {
  const { scope } = worker();
  const response = await scope.recoverGeForceProxyRoute({}, {
    shouldRoute: () => false,
    route() { assert.fail('An unowned session must not be routed'); }
  }, 10);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(await response.text(), /refresh to reconnect/);
});
