import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../static/roblox/bridge.js', import.meta.url), 'utf8');

test('binary assets avoid a duplicate decoded string while JSON still parses normally', async () => {
  let decodes = 0;
  let bytes = new Uint8Array(4 * 1024 * 1024).buffer;
  class Decoder extends TextDecoder { decode(...args) { decodes++; return super.decode(...args); } }
  class Progress extends Event { constructor(type, values) { super(type); Object.assign(this, values); } }
  const port = { postMessage(message) {
    queueMicrotask(() => port.onmessage({ data: { type: 'response', id: message.id, result: {
      status: 200, statusText: 'OK', url: message.url, headers: [], body: bytes
    } } }));
  } };
  const sandbox = { URL, Headers, Request, Response, Blob, EventTarget, ProgressEvent: Progress,
    TextDecoder: Decoder, XMLHttpRequest: class extends EventTarget {},
    location: { href: 'https://velora.test/roblox/engine-worker.js' },
    fetch() { throw new Error('No network expected'); }, addEventListener() {}, setTimeout, clearTimeout };
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox);
  sandbox.__veloraRobloxBridge.connect(port);
  for (const type of ['arraybuffer', 'blob']) {
    const xhr = new sandbox.XMLHttpRequest();
    xhr.open('GET', 'https://assets.rbxcdn.com/asset');
    xhr.responseType = type;
    await xhr.send();
    assert.equal(xhr.status, 200);
    assert.equal(xhr.responseText, '');
    assert.equal(type === 'blob' ? xhr.response.size : xhr.response.byteLength, bytes.byteLength);
  }
  assert.equal(decodes, 0);
  bytes = new TextEncoder().encode('{"ok":true}').buffer;
  const xhr = new sandbox.XMLHttpRequest();
  xhr.open('GET', 'https://apis.roblox.com/test');
  xhr.responseType = 'json';
  await xhr.send();
  assert.equal(xhr.response.ok, true);
  assert.equal(decodes, 1);
});
