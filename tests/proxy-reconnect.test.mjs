import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { proxyRecoveryResponse } from '../scripts/proxy-recovery-response.mjs';

test('only browser proxy navigations get a reconnect document instead of the host 404', async () => {
  for (const path of ['/prism/controller/frame/page', '/geforce/proxy/controller/frame/page']) {
    const response = proxyRecoveryResponse(new Request('https://velora.example'+path, {headers:{accept:'text/html'}}));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /proxy-reconnect\.js/);
  }
  for (const path of ['/settings','/slate','/not-an-app','/prism/prism.js','/prism/stream-transfer.js','/prism/prism.sw.js','/prism/prism.wasm']) {
    assert.equal(proxyRecoveryResponse(new Request('https://velora.example'+path)), null, path);
  }
});

test('form submissions, uploads, and subresources are never automatically retried', async () => {
  for (const method of ['POST', 'PUT', 'GET']) {
    const response = proxyRecoveryResponse(new Request('https://velora.example/prism/controller/frame/callback', {method}));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /<script|location\.reload/);
  }
});

function recovery({priorAttempt=false, controlled=true}={}) {
  const stored = new Map(priorAttempt ? [['velora:reconnect:/prism/controller/frame/page', '1']] : []);
  const nodes = {'#retry':{hidden:true}, '#status':{textContent:''}};
  const listeners = new Set();
  let reloaded = 0;
  let registered = 0;
  let timeout;
  const sw = {
    controller:controlled ? {} : null, ready:Promise.resolve(),
    async register() { registered++; },
    addEventListener(type, fn) { listeners.add(fn); },
    removeEventListener(type, fn) { listeners.delete(fn); }
  };
  const scope={
    document:{querySelector:key=>nodes[key]},
    location:{pathname:'/prism/controller/frame/page',search:'',reload(){reloaded++;}},
    sessionStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
    navigator:{serviceWorker:sw},
    setTimeout(fn){timeout=fn; return 1;}, clearTimeout(){}
  };
  vm.runInNewContext(readFileSync(new URL('../static/proxy-reconnect.js',import.meta.url),'utf8'),scope);
  return {nodes,sw,listeners,get reloaded(){return reloaded;},get registered(){return registered;},timeout(){timeout();}};
}

test('a missed iframe navigation retries once after the document is controlled', async () => {
  const f=recovery({controlled:false});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.reloaded,0);
  f.sw.controller={};
  for(const fn of f.listeners)fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.reloaded,1);
  assert.equal(f.listeners.size,0);
  const again=recovery({priorAttempt:true});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(again.registered,0);
  assert.equal(again.reloaded,0);
  assert.equal(again.nodes['#retry'].hidden,false);
});

test('a timed-out recovery cannot reload later or leak controller listeners', async () => {
  const f=recovery({controlled:false});
  await new Promise(resolve=>setImmediate(resolve));
  f.timeout();
  f.sw.controller={};
  for(const fn of f.listeners)fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.reloaded,0);
  assert.equal(f.listeners.size,0);
  assert.equal(f.nodes['#retry'].hidden,false);
});
