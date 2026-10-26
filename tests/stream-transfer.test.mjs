import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../prism/stream-transfer.js', import.meta.url), 'utf8');
const pause = () => new Promise(resolve => setTimeout(resolve, 5));
function fixture(safari = true) {
  let probes = 0;
  class Channel {
    constructor() {
      const channel = new MessageChannel();
      const post = channel.port1.postMessage.bind(channel.port1);
      channel.port1.postMessage = (value, transfers) => {
        if (value instanceof ReadableStream) {
          probes++;
          if (safari) throw new DOMException('The object cannot be cloned', 'DataCloneError');
        }
        return post(value, transfers);
      };
      return channel;
    }
  }
  const context = vm.createContext({ ReadableStream, ArrayBuffer, Uint8Array, MessageChannel: Channel });
  vm.runInContext(source, context);
  return { rpc: context.$veloraStreamRPC, get probes() { return probes; } };
}

async function transfer(rpc, value, transfers = []) {
  const { port1, port2 } = new MessageChannel();
  try {
    const received = new Promise((resolve, reject) => {
      port2.onmessage = ({ data }) => resolve(rpc.decode(data));
      port2.onmessageerror = reject;
    });
    rpc.send((data, items) => port1.postMessage(data, items), value, transfers);
    return await received;
  } finally { port1.close(); port2.close(); }
}

test('Safari byte streams deliver early chunks with backpressure and keep shared buffers intact', { timeout: 2000 }, async () => {
  const { rpc } = fixture();
  let pulls = 0;
  const backing = Uint8Array.from([0, 1, 2, 3, 4, 5]);
  const stream = new ReadableStream({
    pull(controller) {
      pulls++;
      if (pulls === 1) controller.enqueue(backing.subarray(1, 3));
      else if (pulls === 2) controller.enqueue(backing.subarray(3, 5));
      else controller.close();
    }
  }, { highWaterMark: 0 });
  const response = await transfer(rpc, { status: 200, body: stream }, [stream]);
  assert.equal(pulls, 0, 'no source reads before consumer demand');
  const reader = response.body.getReader();
  assert.deepEqual(Array.from((await reader.read()).value), [1, 2]);
  await pause();
  assert.equal(pulls, 1, 'only one chunk requested');
  assert.equal(backing.byteLength, 6, 'the shared source buffer stays attached');
  assert.deepEqual(Array.from((await reader.read()).value), [3, 4]);
  assert.equal((await reader.read()).done, true);
});

test('Safari cancellation reaches a source blocked in read', { timeout: 2000 }, async () => {
  const { rpc } = fixture();
  let reason;
  const stream = new ReadableStream({ cancel(value) { reason = value; } }, { highWaterMark: 0 });
  const { body } = await transfer(rpc, { body: stream });
  const reader = body.getReader();
  const pending = reader.read();
  await reader.cancel('navigation changed');
  assert.equal((await pending).done, true);
  for (let i=0; reason === undefined && i<20; i++) await pause();
  assert.equal(reason, 'navigation changed');
});

test('Safari stream errors reach the consumer and close the bridge', { timeout: 2000 }, async () => {
  const { rpc } = fixture();
  const stream = new ReadableStream({ pull(controller) { controller.error(new Error('remote disconnected')); } }, { highWaterMark: 0 });
  const { body } = await transfer(rpc, { body: stream }, [stream]);
  await assert.rejects(body.getReader().read(), /remote disconnected/);
});

test('Safari handles request bodies without a supplied transfer list and preserves unrelated ports', { timeout: 2000 }, async () => {
  const f = fixture();
  const { port1, port2 } = new MessageChannel();
  try {
    const request = { channel: { $args: { body: new Response('form=value').body, port: port2 } } };
    const received = await transfer(f.rpc, request, [port2]);
    assert.equal(await new Response(received.channel.$args.body).text(), 'form=value');
    const ping = new Promise(resolve => port1.onmessage = ({data}) => resolve(data));
    received.channel.$args.port.postMessage('alive');
    assert.equal(await ping, 'alive');
    received.channel.$args.port.close();
    assert.equal(f.probes, 1, 'stream capability checked only once');
  } finally { port1.close(); port2.close(); }
});

test('native transferable streams retain their fast path', { timeout: 2000 }, async () => {
  const f = fixture(false);
  const response = await transfer(f.rpc, { body: new Response('native response').body });
  assert.equal(await new Response(response.body).text(), 'native response');
  assert.equal(f.rpc.supportsStreams(), true);
  assert.equal(f.probes, 1);
});

test('a failed message send cancels any stream bridge rather than leaking its source', { timeout: 2000 }, async () => {
  const { rpc } = fixture();
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } }, { highWaterMark: 0 });
  assert.throws(() => rpc.send(() => { throw new Error('port closed'); }, { body }), /port closed/);
  await pause();
  assert.equal(cancelled, true);
});
