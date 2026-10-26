import test from 'node:test';
import assert from 'node:assert/strict';
import { installGameKeyboard } from '../src/lib/utils/browser/game-keyboard.js';

function fixture(lock = async () => {}) {
  const doc = new EventTarget();
  doc.fullscreenElement = null;
  const desktop = {};
  const calls = [];
  const navigator = { keyboard: {
    lock(keys) { calls.push(['lock', keys]); return lock(); },
    unlock() { calls.push(['unlock']); }
  } };
  const remove = installGameKeyboard({ document: doc, navigator, desktop });
  function fullscreen(element) {
    doc.fullscreenElement = element;
    doc.dispatchEvent(new Event('fullscreenchange'));
  }
  return { doc, desktop, calls, remove, fullscreen };
}

test('requests only Escape while the desktop iframe is fullscreen; releases on exit', async () => {
  const f = fixture();
  f.fullscreen({});
  assert.deepEqual(f.calls, []);
  f.fullscreen(f.desktop);
  f.fullscreen(f.desktop);
  assert.deepEqual(f.calls, [['lock', ['Escape']]]);
  await Promise.resolve();
  f.fullscreen(null);
  assert.deepEqual(f.calls.at(-1), ['unlock']);
  f.remove();
});

test('permission denial is nonfatal and can be retried next fullscreen session', async () => {
  const f = fixture(() => Promise.reject(new Error('Permission denied')));
  f.fullscreen(f.desktop);
  await new Promise(resolve => setImmediate(resolve));
  f.fullscreen(null);
  f.fullscreen(f.desktop);
  assert.equal(f.calls.filter(c => c[0] === 'lock').length, 2);
  await new Promise(resolve => setImmediate(resolve));
  f.remove();
});

test('unsupported browsers keep their existing fullscreen and keyboard behavior', () => {
  const doc = new EventTarget();
  const remove = installGameKeyboard({ document: doc, navigator: {}, desktop: {} });
  doc.dispatchEvent(new Event('fullscreenchange'));
  assert.doesNotThrow(remove);
});

test('cleanup releases capture and prevents future fullscreen requests', async () => {
  const f = fixture();
  f.fullscreen(f.desktop);
  f.remove();
  await Promise.resolve();
  f.fullscreen(null);
  f.fullscreen(f.desktop);
  assert.deepEqual(f.calls, [['lock', ['Escape']], ['unlock']]);
});

test('no keyboard event is canceled or replaced', () => {
  const f = fixture();
  f.fullscreen(f.desktop);
  const event = new Event('keydown', { cancelable: true });
  f.doc.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  f.remove();
});
