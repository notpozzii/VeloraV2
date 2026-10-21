import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../src/lib/downloads/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function openDownload(complete = true) {
	const timers = [];
	const frames = [];
	const imageEvents = {};
	const opening = { hidden: false };
	const direct = { hidden: true };
	const image = { complete, addEventListener: (name, callback) => imageEvents[name] = callback };
	const elements = { 'opening-image': image, opening, direct };
	runInNewContext(script, {
		document: {
			getElementById: (id) => elements[id],
			createElement: (tag) => {
				assert.equal(tag, 'iframe');
				return { events: {}, addEventListener(name, callback) { this.events[name] = callback; } };
			},
			body: { appendChild: (frame) => frames.push(frame) }
		},
		requestAnimationFrame: (callback) => callback(),
		setTimeout: (callback, delay) => timers.push({ callback, delay })
	});
	return { timers, frames, imageEvents, opening, direct };
}

test('initial HTML contains the inline PNG and no iframe to load eagerly', () => {
	assert.match(html, /src="data:image\/png;base64,/);
	assert.doesNotMatch(html, /<iframe\b/i);
	assert.doesNotMatch(html, /<link[^>]+(?:preconnect|prefetch|preload)/i);
});
test('Velora is created only after the one-second pause, with its original permissions', () => {
	const page = openDownload();
	assert.equal(page.frames.length, 0);
	assert.equal(page.direct.hidden, true);
	assert.equal(page.timers[0].delay, 1000);
	page.timers[0].callback();
	assert.equal(page.frames.length, 1);
	const frame = page.frames[0];
	assert.equal(frame.src, 'https://ixl.pozzi-pozzi.workers.dev/');
	assert.equal(frame.allowFullscreen, true);
	assert.match(frame.allow, /gamepad/);
	assert.equal(page.opening.hidden, false);
	frame.events.load();
	assert.equal(page.opening.hidden, true);
	assert.equal(page.direct.hidden, false);
});
test('the pause waits for the PNG and repeated image events cannot create more frames', () => {
	const page = openDownload(false);
	assert.equal(page.timers.length, 0);
	page.imageEvents.load();
	page.imageEvents.load();
	page.imageEvents.error();
	assert.equal(page.timers.length, 1);
	assert.equal(page.timers[0].delay, 1000);
});
test('a broken image still opens the app and a stalled frame exposes a recovery link', () => {
	const page = openDownload(false);
	page.imageEvents.error();
	page.timers[0].callback();
	assert.equal(page.frames.length, 1);
	assert.equal(page.timers[1].delay, 15000);
	page.timers[1].callback();
	assert.equal(page.direct.hidden, false);
});
