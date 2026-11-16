import assert from 'node:assert/strict';
import test from 'node:test';
import { isLauncherProbe, notifyLauncherReady } from '../src/lib/utils/launcher-ready.js';

const nonce = 'a'.repeat(32);
function context({ parent = 'https://mathrightnow.org', token = nonce, mounted = true, path = '/', top = false } = {}) {
  const messages = [];
  const url = new URL(path, 'https://formative.icu');
  url.searchParams.set('velora_launch_probe', token);
  url.searchParams.set('velora_launch_parent', parent);
  const win = { location: { href: url.href }, document: { querySelector: () => mounted ? {} : null }, parent: { postMessage: (...args) => messages.push(args) } };
  if (top) win.parent = win;
  return { win, messages };
}

test('only a mounted desktop responds to a valid launcher challenge', () => {
  const { win, messages } = context();
  assert.equal(isLauncherProbe(win), true);
  assert.equal(notifyLauncherReady(win), true);
  assert.deepEqual(messages, [[{ type: 'velora:launcher-ready', version: 1, nonce, path: '/' }, 'https://mathrightnow.org']]);
});

test('failed startup never sends a confirmation', () => {
  const { win, messages } = context({ mounted: false });
  assert.equal(notifyLauncherReady(win), false);
  assert.deepEqual(messages, []);
});

test('top-level pages, untrusted parents, malformed challenges, and other routes do not respond', () => {
  for (const options of [{ top: true }, { parent: 'https://example.com' }, { parent: 'https://mathrightnow.org.attacker.example' }, { token: 'short' }, { token: '<script>' }, { path: '/roblox/' }]) {
    const { win, messages } = context(options);
    assert.equal(isLauncherProbe(win), false);
    assert.equal(notifyLauncherReady(win), false);
    assert.deepEqual(messages, []);
  }
});

test('an ordinary page visit is unchanged', () => {
  const { win, messages } = context();
  win.location.href = 'https://formative.icu/';
  assert.equal(isLauncherProbe(win), false);
  assert.equal(notifyLauncherReady(win), false);
  assert.deepEqual(messages, []);
});
