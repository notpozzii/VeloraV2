import test from 'node:test';
import assert from 'node:assert/strict';
import { createDockResize } from '../src/lib/utils/os/dock-resize.js';

function fixture() {
	const host = new EventTarget();
	let size = 24;
	let dragging = false;
	let commits = 0;
	const resize = createDockResize({ host, getSize: () => size,
		setSize: value => { size = value; }, onDragging: value => { dragging = value; },
		onCommit: () => { commits++; } });
	const event = (type, clientY, button = 0) => Object.assign(new Event(type, { cancelable: true }), { clientY, button });
	return { resize, get size() { return size; }, get dragging() { return dragging; },
		get commits() { return commits; }, start(y = 650, button) { resize.start(event('mousedown', y, button)); },
		send(type, y) { host.dispatchEvent(event(type, y)); } };
}

test('dock resizing works without pointer lock or movementY and remains bounded', () => {
	const f = fixture();
	f.start();
	f.send('mousemove', 620);
	assert.equal(f.size, 30);
	assert.equal(f.dragging, true);
	f.send('mousemove', -1000);
	assert.equal(f.size, 39);
	f.send('mousemove', 2000);
	assert.equal(f.size, 8);
	f.send('mouseup');
	assert.equal(f.dragging, false);
	assert.equal(f.commits, 1);
	f.send('mousemove', 500);
	assert.equal(f.size, 8, 'ending the drag releases its listeners');
});

test('losing focus and unmounting end the drag once; the next drag uses the latest size', () => {
	const f = fixture();
	f.start();
	f.send('mousemove', 620);
	f.send('blur');
	f.resize.stop();
	assert.equal(f.commits, 1);
	f.start(100);
	f.send('mousemove', 110);
	assert.equal(f.size, 28);
	f.resize.stop();
	assert.equal(f.commits, 2);
	assert.equal(f.dragging, false);
	f.send('mousemove', 0);
	assert.equal(f.size, 28);
});

test('secondary buttons do not start a resize', () => {
	const f = fixture();
	f.start(650, 2);
	f.send('mousemove', 620);
	assert.equal(f.size, 24);
	assert.equal(f.dragging, false);
	assert.equal(f.commits, 0);
});
