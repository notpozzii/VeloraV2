import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const handler = readFileSync(new URL('../glass/glass.handler.js', import.meta.url), 'utf8');
const helper = handler.slice(handler.indexOf('function veloraSourceRealmCall'), handler.indexOf('\nvar m='));
const context = vm.createContext({});
vm.runInContext(helper, context);

test('cross-frame calls are created in the sender realm and avoid the target apply', () => {
  const sender = vm.createContext({});
  const senderWindow = vm.runInContext('globalThis', sender);
  const receiver = {};
  function target(...args) { return { receiver: this, args }; }
  target.apply = () => assert.fail('A foreign apply loses the postMessage sender');
  const call = context.veloraSourceRealmCall(senderWindow);
  assert.equal(Object.getPrototypeOf(call), senderWindow.Function.prototype);
  const transfer = [];
  const result = call(target, ['message', '*', transfer], receiver);
  assert.equal(result.receiver, receiver);
  assert.deepEqual(result.args, ['message', '*', transfer]);
});

test('source realm calls preserve unbound calls, return values and exceptions', () => {
  const call = context.veloraSourceRealmCall({ Function });
  assert.equal(call(function () { 'use strict'; return this; }, []), undefined);
  assert.equal(call((a, b) => a + b, [2, 3]), 5);
  const failure = new Error('original failure');
  assert.throws(() => call(() => { throw failure; }, []), error => error === failure);
});

test('the deployed handler uses the same source realm bridge', () => {
  assert.match(handler, /e\.call=veloraSourceRealmCall\(o\)/);
  assert.equal(readFileSync(new URL('../static/glass/glass.handler.js', import.meta.url), 'utf8'), handler);
});
