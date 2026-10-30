import test from 'node:test';
import assert from 'node:assert/strict';
import { installGameKeyboard } from '../src/lib/utils/browser/game-keyboard.js';

function fixture(lock = async () => {}, allApps = false) {
  const doc = new EventTarget();
  doc.fullscreenElement = null;
  const desktop = {};
  const calls = [];
  const navigator = { keyboard: {
    lock(keys) { calls.push(['lock', keys]); return lock(); },
    unlock() { calls.push(['unlock']); }
  } };
  const remove = installGameKeyboard({ document: doc, navigator, desktop, allApps });
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

test('one owner handles the app container and a nested frame without duplicate requests', () => {
  const doc = new EventTarget(), app = {}, frame = {}, calls = [];
  const remove = installGameKeyboard({ document: doc, navigator: { keyboard: {
    lock(keys) { calls.push(['lock', keys]); }, unlock() { calls.push(['unlock']); }
  } }, targets: [app, frame] });
  for (const target of [app, frame]) {
    doc.fullscreenElement = target;
    doc.dispatchEvent(new Event('fullscreenchange'));
  }
  assert.deepEqual(calls, [['lock', ['Escape']]]);
  doc.fullscreenElement = {};
  doc.dispatchEvent(new Event('fullscreenchange'));
  assert.deepEqual(calls.at(-1), ['unlock']);
  remove();
});

test('a fullscreen desktop captures Escape only while the GeForce frame has focus', () => {
  const f = fixture();
  f.doc.documentElement = {};
  f.doc.activeElement = {};
  f.fullscreen(f.doc.documentElement);
  assert.deepEqual(f.calls, []);
  f.doc.activeElement = f.desktop;
  f.doc.dispatchEvent(new Event('focusin'));
  assert.deepEqual(f.calls, [['lock', ['Escape']]]);
  f.doc.activeElement = {};
  f.doc.dispatchEvent(new Event('focusin'));
  assert.deepEqual(f.calls.at(-1), ['unlock']);
  f.remove();
});

test('mounting during an existing fullscreen session requests capture immediately', () => {
  const doc = new EventTarget(), frame = {}, calls = [];
  doc.fullscreenElement = frame;
  const remove = installGameKeyboard({ document: doc, navigator: { keyboard: {
    lock(keys) { calls.push(keys); }, unlock() {}
  } }, desktop: frame });
  assert.deepEqual(calls, [['Escape']]);
  remove();
});

test('an old permission rejection cannot clear a newer fullscreen request', async () => {
  const rejects = [];
  const f = fixture(() => new Promise((resolve, reject) => rejects.push(reject)));
  f.fullscreen(f.desktop);
  f.fullscreen(null);
  f.fullscreen(f.desktop);
  rejects[0](new Error('Old request aborted'));
  await new Promise(resolve => setImmediate(resolve));
  f.fullscreen(f.desktop);
  assert.equal(f.calls.filter(c => c[0] === 'lock').length, 2);
  f.remove();
  rejects[1](new Error('Cleanup'));
  await new Promise(resolve => setImmediate(resolve));
});


test('one layout owner captures Escape for every app and releases only when fullscreen ends', async () => {
  const f = fixture(async () => {}, true);
  for (const app of [{ name: 'Browser' }, { name: 'TikTok' }, { name: 'Games' }, { name: 'Settings' }, { name: 'GeForce NOW' }]) {
    f.fullscreen(app);
    await Promise.resolve();
    f.doc.activeElement = {};
    f.doc.dispatchEvent(new Event('focusin'));
  }
  assert.deepEqual(f.calls, [['lock', ['Escape']]]);
  f.fullscreen(null);
  assert.deepEqual(f.calls, [['lock', ['Escape']], ['unlock']]);
  f.fullscreen({ name: 'Apps' });
  assert.deepEqual(f.calls.at(-1), ['lock', ['Escape']]);
  f.remove();
});

test('all-app fullscreen capture leaves key events intact and cleans up on layout disposal', async () => {
  const f = fixture(async () => {}, true);
  f.fullscreen({});
  const event = new Event('keydown', { cancelable: true });
  f.doc.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  f.remove();
  await Promise.resolve();
  f.fullscreen({});
  assert.deepEqual(f.calls, [['lock', ['Escape']], ['unlock']]);
});


test('all-app mode retries a denied lock only in the next fullscreen session, not on focus changes', async () => {
  const f = fixture(() => Promise.reject(new Error('Permission denied')), true);
  f.fullscreen({});
  await new Promise(resolve => setImmediate(resolve));
  f.doc.dispatchEvent(new Event('focusin'));
  f.doc.dispatchEvent(new Event('focusin'));
  assert.equal(f.calls.length, 1);
  f.fullscreen(null);
  f.fullscreen({});
  assert.equal(f.calls.length, 2);
  await new Promise(resolve => setImmediate(resolve));
  f.remove();
});
