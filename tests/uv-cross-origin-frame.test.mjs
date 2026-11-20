import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const handler = readFileSync(new URL('../glass/glass.handler.js', import.meta.url), 'utf8');
const start = handler.indexOf('function veloraInitializeFrame(');
const end = handler.indexOf('\nvar m=', start);
assert.ok(start >= 0 && end > start);
const messages = [];
const initializeFrame = vm.runInNewContext('(' + handler.slice(start, end) + ')', {
	console: { error: value => messages.push(value) }
});

test('an ad SDK can obtain a protected frame WindowProxy without a UV SecurityError', () => {
	const securityError = new DOMException('Blocked cross-origin frame', 'SecurityError');
	const posted = [];
	const child = new Proxy({ postMessage: value => posted.push(value) }, {
		get(target, key) {
			if (key === '__uv' || key === 'document') throw securityError;
			return Reflect.get(target, key);
		}
	});
	const frame = {};
	function getWindow() { assert.equal(this, frame); return child; }
	assert.doesNotThrow(() => initializeFrame(frame, getWindow, () => assert.fail('Cannot initialize an inaccessible realm')));
	child.postMessage('ad bridge ready');
	assert.deepEqual(posted, ['ad bridge ready']);
	assert.throws(() => child.document, error => error === securityError, 'native isolation remains enforced');
});

test('a same-origin frame is initialized once and null frames are ignored', () => {
	const child = {};
	const initialized = [];
	const hook = value => { initialized.push(value); value.__uv = {}; };
	initializeFrame({}, () => child, hook);
	initializeFrame({}, () => child, hook);
	initializeFrame({}, () => null, hook);
	assert.deepEqual(initialized, [child]);
});

test('invalid native getter receivers still throw and initializer failures remain reported', () => {
	const nativeError = new TypeError('Illegal invocation');
	assert.throws(() => initializeFrame({}, () => { throw nativeError; }, () => {}), error => error === nativeError);
	const error = new Error('Initialization failed');
	initializeFrame({}, () => ({}), () => { throw error; });
	assert.equal(messages.at(-1), error);
});

test('both iframe getters use the guard and the deployed handler is synchronized', () => {
	assert.match(handler, /function U\(t\)\{veloraInitializeFrame\(t,C,p\)\}/);
	assert.match(handler, /hookProperty\(n,"contentWindow",\{get:\(t,r\)=>\(U\(r\),t.call\(r\)\)/);
	assert.match(handler, /hookProperty\(n,"contentDocument",\{get:\(t,r\)=>\(U\(r\),t.call\(r\)\)/);
	assert.equal(readFileSync(new URL('../static/glass/glass.handler.js', import.meta.url), 'utf8'), handler);
});
