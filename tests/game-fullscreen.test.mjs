import test from 'node:test';
import assert from 'node:assert/strict';
import { installGameFullscreen } from '../src/lib/utils/browser/game-fullscreen.js';

function fixture({ keyboard, reject } = {}) {
	const doc = new EventTarget(), calls = [];
	class Element {
		async requestFullscreen(options) {
			calls.push({ target: this, options });
			if (reject) reject(options);
			doc.fullscreenElement = this;
		}
	}
	const frame = new EventTarget();
	frame.contentWindow = { navigator: { keyboard }, document: doc, Element };
	const original = Element.prototype.requestFullscreen;
	const remove = installGameFullscreen(frame);
	const element = new Element();
	function escape() {
		const event = new Event('keydown', { cancelable: true });
		event.key = 'Escape';
		doc.dispatchEvent(event);
		return event;
	}
	return { doc, calls, Element, frame, original, element, remove, escape };
}

test('Safari in-game fullscreen requests native lock and real Escape events still reach game listeners', async () => {
	const f = fixture();
	assert.equal(f.escape().defaultPrevented, false);
	await f.element.requestFullscreen({ navigationUI: 'hide' });
	assert.deepEqual(f.calls, [{ target: f.element, options: { navigationUI: 'hide', keyboardLock: 'browser' } }]);
	let received;
	f.doc.addEventListener('keydown', event => { received = event; });
	const event = f.escape();
	assert.equal(received, event);
	assert.equal(event.defaultPrevented, true);
	f.doc.fullscreenElement = null;
	assert.equal(f.escape().defaultPrevented, false);
	f.remove();
	assert.equal(f.Element.prototype.requestFullscreen, f.original);
});

test('Chrome retains its existing Keyboard API path without wrapping its fullscreen method', () => {
	const f = fixture({ keyboard: { lock() {} } });
	assert.equal(f.Element.prototype.requestFullscreen, f.original);
	f.remove();
});

test('unsupported lock falls back once, while denied requests remain rejected', async () => {
	const f = fixture({ reject(options) {
		if (options.keyboardLock) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
	} });
	await f.element.requestFullscreen({ navigationUI: 'hide' });
	assert.equal(f.calls.length, 2);
	assert.deepEqual(f.calls[1].options, { navigationUI: 'hide' });
	assert.equal(f.escape().defaultPrevented, false);
	f.remove();
	const denied = fixture({ reject() { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); } });
	await assert.rejects(denied.element.requestFullscreen(), /denied/);
	assert.equal(denied.calls.length, 1);
	denied.remove();
});

test('navigation attaches to the new document and cleanup removes all hooks', async () => {
	const f = fixture();
	const oldDoc = f.doc;
	f.frame.contentWindow.document = new EventTarget();
	f.frame.dispatchEvent(new Event('load'));
	f.remove();
	assert.equal(f.Element.prototype.requestFullscreen, f.original);
	f.frame.dispatchEvent(new Event('load'));
	await f.element.requestFullscreen();
	assert.equal(f.calls[0].options, undefined);
	assert.equal(f.escape().defaultPrevented, false);
	assert.equal(oldDoc.fullscreenElement, f.element);
});

test('cross-origin redirected frames are left alone', () => {
	const frame = new EventTarget();
	Object.defineProperty(frame, 'contentWindow', { get() { throw new Error('cross-origin'); } });
	const remove = installGameFullscreen(frame);
	assert.doesNotThrow(() => frame.dispatchEvent(new Event('load')));
	assert.doesNotThrow(remove);
});
