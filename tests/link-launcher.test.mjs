import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { setImmediate as tick } from 'node:timers/promises';

const html = readFileSync(new URL('../static/launcher/index.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const english = 'https://english.mathrightnow.org/';
const schoolcity = 'https://cloud.schoolcity.cc/';
const formative = 'https://formative.icu/';
const velora = 'https://velora.notpozzi.chatgpt.site/';
const backup = 'https://velorastudy.s3.us-east-2.amazonaws.com/index.html';
const jsdelivr = 'https://cdn.jsdelivr.net/gh/notpozzii/VeloraV2@main/static/velora-direct.svg';
const requestedURLs = [backup, jsdelivr, 'https://d2x6e8044vrwm0.cloudfront.net/index.html', english, 'https://mathrightnow.org/', formative, schoolcity, 'https://clever-learning.pozzi-pozzi.workers.dev/', 'https://ixl.pozzi-pozzi.workers.dev/'];
const storageKey = 'velora.launcher.lastWorking.v1';

function fixture(responses = {}, options = {}) {
  let now = 0, timerID = 0, nonceID = 0;
  const timers = new Map(), requests = [], navigations = [], messages = new Set(), frames = [];
  const storage = new Map(Object.entries(options.storage || {}));
  class Element {
    constructor() { this.children = []; this.dataset = {}; this.events = {}; this.hidden = false; this.disabled = false; this.style = {}; }
    append(...children) { for (const child of children) { this.children = this.children.filter(item => item !== child); this.children.push(child); } }
    setAttribute() {}
    addEventListener(type, fn) { this.events[type] = fn; }
    click() { if (!this.disabled) this.events.click?.(); }
    remove() { this.removed = true; }
  }
  const elements = Object.fromEntries(['status', 'heading', 'primary', 'stop', 'next', 'open', 'links', 'auto-open'].map(id => [id, new Element()]));
  elements['auto-open'].checked = options.autoOpen !== false;
  const schedule = (fn, delay = 0) => { const id = ++timerID; timers.set(id, { at: now + delay, fn }); return id; };
  class Frame extends Element {
    constructor() { super(); this.contentWindow = {}; frames.push(this); }
    set src(value) {
      const url = new URL(value);
      this.url = url;
      requests.push(url.href);
      const response = responses[url.origin] || { kind: 'block-page' };
      if (response.kind === 'timeout') return;
      schedule(() => {
        if (this.removed) return;
        // Browsers can fire load for block/error pages too. This is not proof.
        this.onload?.();
        if (response.kind !== 'ready') return;
        const data = { type: 'velora:launcher-ready', version: 1, nonce: url.searchParams.get('velora_launch_probe'), path: url.pathname, ...response.data };
        const event = { origin: response.origin || url.origin, source: response.wrongSource ? {} : this.contentWindow, data };
        for (const handler of [...messages]) handler(event);
      }, response.delay ?? 1);
    }
  }
  const window = {
    location: { origin: 'https://mathrightnow.org', search: options.manual ? '?manual=1' : '', assign: url => navigations.push(url) },
    events: {},
    addEventListener(type, fn) { if (type === 'message') messages.add(fn); else this.events[type] = fn; },
    removeEventListener(type, fn) { if (type === 'message') messages.delete(fn); }
  };
  const localStorage = {
    getItem(key) { if (options.noStorage) throw Error('Unavailable'); return storage.get(key) ?? null; },
    setItem(key, value) { if (options.noStorage) throw Error('Unavailable'); storage.set(key, value); }
  };
  vm.runInNewContext(source, {
    document: { body: new Element(), getElementById: id => elements[id], createElement: tag => tag === 'iframe' ? new Frame() : new Element() },
    window, localStorage, URL, URLSearchParams,
    crypto: { getRandomValues(bytes) { bytes.fill(++nonceID); return bytes; } },
    Image: class { constructor() { throw Error('Asset probes must never be used'); } },
    fetch() { throw Error('A readable response alone is not application startup'); },
    setTimeout: schedule, clearTimeout: id => timers.delete(id)
  });
  async function advance(ms) {
    const until = now + ms;
    for (;;) {
      await tick();
      const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = until; await tick();
  }
  return { elements, requests, navigations, storage, frames, messages, advance, window, rowFor: url => elements.links.children.find(row => row.children[1].children[1].textContent === new URL(url).hostname) };
}

test('checks actual page URLs and requires a fresh unique startup challenge', async () => {
  const f = fixture({}, { autoOpen: false });
  assert.equal(f.requests.length, 5);
  const challenges = f.requests.map(value => new URL(value));
  assert.equal(new Set(challenges.map(url => url.searchParams.get('velora_launch_probe'))).size, 5);
  for (const url of challenges) {
    assert.equal(url.pathname, '/');
    assert.match(url.searchParams.get('velora_launch_probe'), /^[a-f0-9]{32}$/);
    assert.equal(url.searchParams.get('velora_launch_parent'), 'https://mathrightnow.org');
  }
});

test('a blocked Formative page never passes just because its image or load event succeeds', async () => {
  const f = fixture({ [new URL(formative).origin]: { kind: 'block-page', assetLoads: true }, [new URL(english).origin]: { kind: 'ready', delay: 20 } });
  await f.advance(2);
  assert.deepEqual(f.navigations, []);
  assert.notEqual(f.rowFor(formative).dataset.state, 'ready');
  await f.advance(20);
  assert.deepEqual(f.navigations, [english]);
});

test('a page with no application acknowledgment is unverified, never declared blocked or ready', async () => {
  const f = fixture({}, { autoOpen: false });
  await f.advance(9000);
  assert.equal(f.elements.heading.textContent, 'No link was verified.');
  for (const row of f.elements.links.children) assert.equal(row.children[2].textContent, 'Unverified');
  assert.deepEqual(f.navigations, []);
});

test('forged origin, window, nonce, protocol, and path messages cannot verify a page', async () => {
  for (const override of [
    { origin: 'https://filter.example' }, { wrongSource: true },
    { data: { nonce: 'a'.repeat(32) } }, { data: { version: 2 } },
    { data: { type: 'page-loaded' } }, { data: { path: '/blocked' } }
  ]) {
    const f = fixture({ [new URL(english).origin]: { kind: 'ready', ...override } }, { autoOpen: false });
    await f.advance(9000);
    assert.equal(f.rowFor(english).dataset.state, 'unverified');
    assert.deepEqual(f.navigations, []);
  }
});

test('the first authentic startup confirmation opens immediately and cancels other checks', async () => {
  const f = fixture({ [new URL(english).origin]: { kind: 'ready', delay: 1000 }, [new URL(schoolcity).origin]: { kind: 'ready' } });
  await f.advance(2);
  assert.deepEqual(f.navigations, [schoolcity]);
  assert.equal(f.storage.get(storageKey), schoolcity);
  assert.equal(f.frames.every(frame => frame.removed), true);
  assert.equal(f.messages.size, 0);
  await f.advance(30000);
  assert.deepEqual(f.navigations, [schoolcity]);
});

test('manual mode collects all available confirmations without navigating', async () => {
  const f = fixture({ [new URL(english).origin]: { kind: 'ready' }, [new URL(schoolcity).origin]: { kind: 'ready' } }, { autoOpen: false });
  await f.advance(9000);
  assert.equal(f.elements.heading.textContent, '2 pages verified.');
  assert.equal(f.rowFor(english).dataset.state, 'ready');
  assert.equal(f.rowFor(schoolcity).dataset.state, 'ready');
  assert.deepEqual(f.navigations, []);
});

test('all requested addresses stay manually available, and unsupported copies are not auto-verified', async () => {
  const f = fixture({}, { autoOpen: false });
  await f.advance(9000);
  for (const url of [...requestedURLs, velora]) assert.equal(f.rowFor(url).children[3].href, url);
  for (const url of [backup, jsdelivr]) {
    assert.equal(f.rowFor(url).dataset.state, 'unverified');
    assert.equal(f.requests.some(request => new URL(request).origin === new URL(url).origin), false);
  }
  f.rowFor(backup).children[3].click();
  assert.equal(f.storage.get(storageKey), backup);
});

test('Stop and pagehide prevent late confirmations and clean up all frames and listeners', async () => {
  for (const leave of [false, true]) {
    const f = fixture({ [new URL(english).origin]: { kind: 'ready', delay: 1000 } });
    if (leave) f.window.events.pagehide(); else f.elements.stop.click();
    await f.advance(30000);
    assert.deepEqual(f.navigations, []);
    assert.equal(f.frames.every(frame => frame.removed), true);
    assert.equal(f.messages.size, 0);
  }
});

test('turning on automatic opening uses an already verified page immediately', async () => {
  const f = fixture({ [new URL(english).origin]: { kind: 'ready' } }, { autoOpen: false });
  await f.advance(2);
  f.elements['auto-open'].checked = true;
  f.elements['auto-open'].events.change();
  assert.deepEqual(f.navigations, [english]);
});

test('next selection can open another verified page without another probe', async () => {
  const f = fixture({ [new URL(english).origin]: { kind: 'ready' }, [new URL(schoolcity).origin]: { kind: 'ready' } }, { autoOpen: false });
  await f.advance(9000); f.elements.next.click();
  f.elements['auto-open'].checked = true; f.elements['auto-open'].events.change();
  assert.deepEqual(f.navigations, [schoolcity]);
  assert.equal(f.requests.length, 5);
});

test('remembered addresses cannot override the first genuine confirmation', async () => {
  const f = fixture({ [new URL(english).origin]: { kind: 'ready' }, [new URL(schoolcity).origin]: { kind: 'ready', delay: 1000 } }, { storage: { [storageKey]: schoolcity } });
  await f.advance(2);
  assert.deepEqual(f.navigations, [english]);
});

test('simultaneous confirmations cause only one navigation', async () => {
  const f = fixture({ [new URL(english).origin]: { kind: 'ready' }, [new URL(schoolcity).origin]: { kind: 'ready' } });
  await f.advance(30000);
  assert.deepEqual(f.navigations, [english]);
});

test('manual preview waits for a click and unavailable storage does not prevent verification', async () => {
  const f = fixture({ [new URL(english).origin]: { kind: 'ready' } }, { manual: true, noStorage: true });
  await f.advance(30000); assert.equal(f.requests.length, 0);
  f.elements.primary.click(); await f.advance(2);
  assert.deepEqual(f.navigations, [english]);
});
