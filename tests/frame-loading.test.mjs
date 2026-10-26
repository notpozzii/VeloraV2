import test from 'node:test';
import assert from 'node:assert/strict';
import { frameLoading } from '../src/lib/utils/loading/frame-loading.js';

function fixture(initialSrc = null) {
	let mutated;
	let disconnected = false;
	const originalObserver = globalThis.MutationObserver;
	globalThis.MutationObserver = class {
		constructor(callback) { mutated = callback; }
		observe() {}
		disconnect() { disconnected = true; }
	};
	const frame = new EventTarget();
	let src = initialSrc;
	frame.getAttribute = () => src;
	frame.hasAttribute = () => false;
	frame.contentWindow = new EventTarget();
	frame.contentWindow.location = { href: 'about:blank' };
	const states = [];
	const tracker = frameLoading(frame, value => states.push(value));
	globalThis.MutationObserver = originalObserver;
	return {
		frame, states, tracker,
		setSrc(value) { src = value; mutated(); },
		load(href) { frame.contentWindow.location.href = href; frame.dispatchEvent(new Event('load')); },
		get disconnected() { return disconnected; }
	};
}

test('the initial blank load cannot dismiss the rocket while proxy startup is pending', () => {
	const f = fixture();
	f.load('about:blank');
	assert.deepEqual(f.states, []);
	f.setSrc('/proxy/youtube');
	f.load('about:blank');
	assert.deepEqual(f.states, [true]);
	f.load('https://velora.test/proxy/youtube');
	assert.deepEqual(f.states, [true, false]);
	f.tracker.destroy();
});

test('link navigation and repeated src changes restart loading, then reveal the loaded page', () => {
	const f = fixture('/proxy/first');
	f.load('https://velora.test/proxy/first');
	f.frame.contentWindow.dispatchEvent(new Event('pagehide'));
	f.load('https://velora.test/proxy/second');
	f.setSrc('/proxy/third');
	f.load('https://velora.test/proxy/third');
	assert.deepEqual(f.states, [true, false, true, false, true, false]);
	f.tracker.destroy();
});

test('a cross-origin page load releases the overlay without needing document access', () => {
	const f = fixture('https://game.example');
	Object.defineProperty(f.frame.contentWindow, 'location', { get() { throw new Error('Cross origin'); } });
	f.frame.dispatchEvent(new Event('load'));
	assert.deepEqual(f.states, [true, false]);
	f.tracker.destroy();
});

test('errors and cancelled launches release loading and cleanup removes navigation listeners', () => {
	const f = fixture('/proxy/first');
	f.frame.dispatchEvent(new Event('error'));
	f.setSrc('/proxy/second');
	f.setSrc('');
	assert.deepEqual(f.states, [true, false, true, false]);
	f.setSrc('/proxy/third');
	f.load('https://velora.test/proxy/third');
	f.tracker.destroy();
	const count = f.states.length;
	f.frame.contentWindow.dispatchEvent(new Event('pagehide'));
	f.frame.dispatchEvent(new Event('load'));
	assert.equal(f.states.length, count);
	assert.equal(f.disconnected, true);
});
