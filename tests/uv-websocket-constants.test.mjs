import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../glass/glass.client.js', import.meta.url), 'utf8');
function fixture() {
	const start = source.indexOf('overrideWebSocket(t){');
	const end = source.indexOf('}},$e=', start);
	assert.ok(start >= 0 && end > start, 'Locate the shipped WebSocket override');
	const method = source.slice(start, end + 1);
	const implementation = vm.runInNewContext(`({${method}})`, {
		EventTarget, Event, MessageEvent, Blob, ArrayBuffer, Object, Proxy, Map,
		navigator:{ userAgent:'test' }, __uv:{ meta:{ url:new URL('https://play.geforcenow.com/') } }
	});
	class NativeSocket extends EventTarget {
		send() {}
		close() {}
	}
	for (const [key, value] of Object.entries({ CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3 })) {
		Object.defineProperty(NativeSocket, key, { value, enumerable:true });
		Object.defineProperty(NativeSocket.prototype, key, { value, enumerable:true });
	}
	const window = { WebSocket:NativeSocket }, sends = [];
	const remote = Object.assign(new EventTarget(), { readyState:1, send(data) { sends.push(data); }, close() {} });
	const client = {
		window, WebSocket:NativeSocket, wsProto:NativeSocket.prototype, socketmap:new Map(),
		ctx:{
			nativeMethods:{ defineProperty:Object.defineProperty, getOwnPropertyDescriptor:Object.getOwnPropertyDescriptor },
			override(target, key, hook, constructor = false) {
				const native = target[key];
				const wrapped = function (...args) { return hook(native, this, args); };
				if (constructor) { wrapped.prototype = native.prototype; wrapped.prototype.constructor = wrapped; }
				target[key] = wrapped;
				return wrapped;
			},
			overrideDescriptor(target, key, hooks) {
				Object.defineProperty(target, key, { configurable:true,
					get:hooks.get && function () { return hooks.get(undefined, this); },
					set:hooks.set && function (value) { return hooks.set(undefined, this, [value]); }
				});
			}
		}
	};
	implementation.overrideWebSocket.call(client, { createWebSocket() { return remote; } });
	return { window, NativeSocket, remote, sends };
}

test('the wrapped constructor retains all four native ready-state constants and descriptors', () => {
	const f = fixture();
	for (const key of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) {
		assert.equal(f.window.WebSocket[key], f.NativeSocket[key]);
		assert.deepEqual(Object.getOwnPropertyDescriptor(f.window.WebSocket, key), Object.getOwnPropertyDescriptor(f.NativeSocket, key));
	}
});

test('GeForce-style OPEN guards send the SDP answer and ICE candidates instead of queueing forever', () => {
	const f = fixture();
	const socket = new f.window.WebSocket('wss://signal.example/');
	f.remote.dispatchEvent(new Event('open'));
	const queued = [];
	for (const data of ['sample answer', 'sample candidate']) {
		if (socket.readyState === f.window.WebSocket.OPEN) socket.send(data);
		else queued.push(data);
	}
	assert.deepEqual(queued, []);
	assert.deepEqual(f.sends, ['sample answer', 'sample candidate']);
	assert.equal(socket.OPEN, 1);
	assert.equal(socket instanceof f.window.WebSocket, true);
});

test('CONNECTING and CLOSED comparisons still track the underlying socket', () => {
	const f = fixture();
	const socket = new f.window.WebSocket('wss://signal.example/');
	f.remote.readyState = 0;
	assert.equal(socket.readyState, f.window.WebSocket.CONNECTING);
	f.remote.readyState = 3;
	assert.equal(socket.readyState, f.window.WebSocket.CLOSED);
});

test('the generated deployment asset matches the canonical WebSocket client', () => {
	assert.equal(readFileSync(new URL('../static/glass/glass.client.js', import.meta.url), 'utf8'), source);
});
