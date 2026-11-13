import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('same-origin engine optimization cannot bypass the pthread connection prelude', async () => {
  const channels = [];
  class Channel extends MessageChannel { constructor() { super(); channels.push(this); } }
  class Worker {
    constructor(url, options) { this.url = url; this.options = options; this.messages = []; }
    postMessage(message, ports) { this.messages.push({ message, ports }); }
  }
  const sandbox = { URL, Headers, Request, Response, Blob, EventTarget, XMLHttpRequest: class {},
    Worker, MessageChannel: Channel, document: {}, location: { href: 'https://velora.test/roblox/play.html', origin: 'https://velora.test' },
    fetch: () => { throw new Error('This test must not use the network.'); }, setTimeout, clearTimeout };
  sandbox.self = sandbox;
  try {
    vm.runInNewContext(await readFile(new URL('../static/roblox/bridge.js', import.meta.url), 'utf8'), sandbox);
    for (const path of ['/roblox/engine-worker.js?src=ignored', '/roblox/engine/WebClient.js']) {
      const worker = new sandbox.Worker(path, { name: 'em-pthread' });
      assert.equal(worker.url, 'https://velora.test/roblox/engine-worker.js');
      assert.equal(worker.options.name, 'em-pthread');
      assert.equal(worker.messages[0].message.type, 'velora:roblox-worker-connect');
      assert.equal(worker.messages[0].ports.length, 1);
    }
    const unrelated = new sandbox.Worker('/another-worker.js');
    assert.equal(unrelated.url, '/another-worker.js');
    assert.equal(unrelated.messages.length, 0);
  } finally { for (const channel of channels) { channel.port1.close(); channel.port2.close(); } }
});
