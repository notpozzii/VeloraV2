import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPanicPreferences, normalizePanicPreferences, panicDestination, matchesPanicKey, shortcutFromEvent, shortcutLabel } from '../src/lib/utils/panic-preferences.js';
import { installPanicController } from '../src/lib/utils/panic-key-core.js';

function press(code = 'Quote', extras = {}) {
	return { code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extras };
}
function target() {
	const listeners = new Map();
	return {
		addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
		removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
		emit(name, event = {}) { for (const fn of [...(listeners.get(name) || [])]) fn(event); },
		count(name) { return listeners.get(name)?.size || 0; }
	};
}
function page() {
	const frames = [];
	const doc = { ...target(), querySelectorAll: () => frames };
	const visits = [];
	const observers = [];
	const win = { ...target(), document: doc, location: { replace(url) { visits.push(url); } },
		MutationObserver: class { constructor(fn) { this.fn = fn; this.disconnected = false; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } }
	};
	win.parent = win;
	return { win, doc, frames, visits, observers };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('defaults use apostrophe and Google, and destinations only allow normal web URLs', () => {
	assert.deepEqual(normalizePanicPreferences(null), defaultPanicPreferences);
	assert.equal(defaultPanicPreferences.shortcut.code, 'Quote');
	assert.equal(shortcutLabel(defaultPanicPreferences.shortcut), "'");
	assert.equal(matchesPanicKey(press('Backquote'), defaultPanicPreferences), false);
	assert.equal(panicDestination(' example.com/path?q=test '), 'https://example.com/path?q=test');
	assert.equal(panicDestination('http://localhost:3000/'), 'http://localhost:3000/');
	for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'https://user:pass@example.com/', '']) assert.equal(panicDestination(url), null);
	assert.equal(normalizePanicPreferences({ enabled: false }).enabled, false);
});

test('matching requires the exact combination and never interrupts recording, composition, or repeated keys', () => {
	const settings = normalizePanicPreferences(null);
	assert.equal(matchesPanicKey(press(), settings), true);
	for (const extras of [{ repeat: true }, { isComposing: true }, { defaultPrevented: true }, { shiftKey: true }, { ctrlKey: true }, { target: { ownerDocument: { querySelector: () => ({}) } } }]) assert.equal(matchesPanicKey(press('Quote', extras), settings), false);
	assert.equal(matchesPanicKey(press(), { ...settings, enabled: false }), false);
	const shortcut = shortcutFromEvent(press('KeyP', { ctrlKey: true, shiftKey: true }));
	assert.equal(shortcutLabel(shortcut), 'Ctrl + Shift + P');
	assert.equal(shortcutFromEvent(press('ShiftLeft')), null);
	assert.equal(shortcutFromEvent(press('Escape')), null);
});

test('a bare character is ignored in text fields, while an explicit modified shortcut works there', () => {
	const input = { tagName: 'INPUT' };
	const settings = normalizePanicPreferences(null);
	assert.equal(matchesPanicKey(press('Quote', { target: input }), settings), false);
	assert.equal(matchesPanicKey(press('Quote', { composedPath: () => [{ isContentEditable: true }] }), settings), false);
	const shortcut = shortcutFromEvent(press('KeyP', { ctrlKey: true }));
	assert.equal(matchesPanicKey(press('KeyP', { target: input, ctrlKey: true }), { ...settings, shortcut }), true);
});

test('nested app input changes the owning tab, shares one controller, clears the close guard, and cleans up', async () => {
	const top = page(); const child = page(); child.win.parent = top.win;
	const frame = { ...target(), contentWindow: child.win };
	top.frames.push(frame);
	let subscribed; let stops = 0;
	const args = { host: top.win, read: async () => null, subscribe: (key, fn) => { subscribed = fn; return () => stops++; } };
	const stopTop = installPanicController(args);
	const stopChild = installPanicController({ ...args, host: child.win });
	await flush();
	assert.equal(top.doc.count('keydown'), 1);
	assert.equal(child.doc.count('keydown'), 1);
	assert.equal(frame.count('load'), 1);
	subscribed({ enabled: false });
	child.doc.emit('keydown', press());
	assert.equal(top.visits.length, 0);
	subscribed({ enabled: true, url: 'https://example.com/custom', shortcut: { code: 'KeyP', ctrl: true } });
	top.win.__galaxyAntiClose = () => {};
	top.win.addEventListener('beforeunload', top.win.__galaxyAntiClose);
	const event = press('KeyP', { ctrlKey: true });
	child.doc.emit('keydown', event);
	assert.deepEqual(top.visits, ['https://example.com/custom']);
	assert.deepEqual(child.visits, []);
	assert.equal(event.prevented && event.stopped, true);
	assert.equal(top.win.count('beforeunload'), 0);
	stopTop(); assert.equal(top.doc.count('keydown'), 1);
	stopChild(); stopChild();
	assert.equal(top.doc.count('keydown'), 0);
	assert.equal(child.doc.count('keydown'), 0);
	assert.equal(frame.count('load'), 0);
	assert.equal(stops, 1);
	assert.ok(top.observers.every(observer => observer.disconnected));
});

test('new frames and navigated documents are covered, removed frames are released, and inaccessible frames do not break startup', async () => {
	const top = page();
	const blocked = { ...target(), get contentWindow() { throw Error('Different origin'); } };
	top.frames.push(blocked);
	const stop = installPanicController({ host: top.win, read: async () => null, subscribe: () => () => {} });
	await flush();
	const child = page(); const frame = { ...target(), contentWindow: child.win };
	top.frames.push(frame);
	top.observers[0].fn([{ addedNodes: [{ nodeType: 1, matches: () => true }], removedNodes: [] }]);
	assert.equal(child.doc.count('keydown'), 1);
	const oldDoc = child.doc; const nextDoc = page().doc; child.win.document = nextDoc;
	frame.emit('load');
	assert.equal(oldDoc.count('keydown'), 0);
	assert.equal(nextDoc.count('keydown'), 1);
	top.frames.splice(top.frames.indexOf(frame), 1);
	frame.emit('load');
	assert.equal(nextDoc.count('keydown'), 0);
	assert.equal(frame.count('load'), 0);
	stop(); assert.equal(blocked.count('load'), 0);
});

test('a live preference update wins over a slow initial settings read', async () => {
	const top = page(); let finishRead; let update;
	const stop = installPanicController({ host: top.win, read: () => new Promise(resolve => { finishRead = resolve; }), subscribe: (key, fn) => { update = fn; return () => {}; } });
	update({ enabled: false }); finishRead(null); await flush();
	top.doc.emit('keydown', press()); assert.equal(top.visits.length, 0); stop();
});
