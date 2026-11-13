import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../static/roblox/bridge.js', import.meta.url), 'utf8');
function fixture({ worker = false } = {}) {
	const sockets = [], sent = [];
	class Socket {
		constructor(url, options) {
			this.url = url; this.options = options;
			this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
			this.closed = new Promise(resolve => { this.resolveClosed = resolve; });
			sockets.push(this);
		}
	}
	const sandbox = { URL, Request, Response, Headers, Blob, EventTarget, TextDecoder, XMLHttpRequest: class {}, WebTransport: Socket, Worker: class {},
		location: { href: 'https://velora.test/roblox/play.html', origin: 'https://velora.test' },
		fetch() { throw Error('No network expected'); }, addEventListener() {}, setTimeout, clearTimeout };
	if (!worker) sandbox.document = {};
	sandbox.self = sandbox;
	vm.runInNewContext(source, sandbox);
	const port = { postMessage(data) { sent.push(data); } };
	sandbox.__veloraRobloxBridge.connect(port);
	return { sandbox, port, sockets, sent, snapshot: () => ({ ...sandbox.__veloraRobloxBridge.connectionSnapshot() }) };
}

test('game connection observation preserves native arguments and promises, without copying destinations', async () => {
	const f = fixture();
	const options = { allowPooling: false };
	const socket = new f.sandbox.WebTransport('https://private-ticket.qdmux.roblox.com', options);
	assert.equal(socket, f.sockets[0]);
	assert.equal(socket.options, options);
	assert.equal(f.snapshot().game, 'connecting');
	const ready = socket.ready;
	socket.resolveReady(); await ready; await Promise.resolve();
	assert.equal(socket.ready, ready);
	assert.equal(f.snapshot().connected, 1);
	socket.resolveClosed(); await socket.closed; await Promise.resolve();
	assert.equal(f.snapshot().game, 'closed');
	assert.doesNotMatch(JSON.stringify(f.snapshot()), /private|ticket|qdmux/);
});

test('a failed native connection stays rejected for the engine and worker messages omit raw errors', async () => {
	const f = fixture({ worker: true });
	const socket = new f.sandbox.WebTransport('https://private-ticket.qdmux.roblox.com');
	const failure = new Error('Network failure at private-ticket.qdmux.roblox.com');
	socket.rejectReady(failure);
	await assert.rejects(socket.ready, error => error === failure);
	await Promise.resolve();
	assert.equal(f.snapshot().failed, 1);
	assert.equal(f.sent.at(-1).state, 'failed');
	assert.doesNotMatch(JSON.stringify(f.sent), /private|qdmux|Network failure/);
});

test('game-join responses record only the HTTP status, without retaining their body', async () => {
	const f = fixture();
	const pending = f.sandbox.__veloraRobloxBridge.request('https://gamejoin.roblox.com/v1/join-game', { method: 'POST', body: 'private-request-body' });
	await Promise.resolve();
	const request = f.sent.at(-1);
	const result = { status: 200, body: new TextEncoder().encode('{"status":6,"private":"private-response-body"}').buffer };
	f.port.onmessage({ data: { type: 'response', id: request.id, result } });
	assert.equal(await pending, result);
	assert.equal(f.snapshot().joinHttp, 200);
	assert.equal(f.snapshot().joinResult, 6);
	assert.doesNotMatch(JSON.stringify(f.snapshot()), /private|body|gamejoin/);
});
