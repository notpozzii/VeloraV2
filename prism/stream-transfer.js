// Safari doesn't support transferring ReadableStreams through MessagePorts.
// Keep the native path where supported; otherwise pull one byte chunk at a
// time through a port, preserving backpressure, cancellation and stream errors.
// https://github.com/MercuryWorkshop/scramjet/issues/192
(() => {
  if (globalThis.$veloraStreamRPC) return;
  let transferable;
  function supportsStreams() {
    if (transferable !== undefined) return transferable;
    const channel = new MessageChannel();
    const stream = new ReadableStream({ start(controller) { controller.close(); } });
    try {
      channel.port1.postMessage(stream, [stream]);
      transferable = true;
    } catch {
      transferable = false;
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
    return transferable;
  }
  const isStream = value => typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
  const isRecord = value => value && Object.prototype.toString.call(value) === '[object Object]';

  function sendStream(stream) {
    const reader = stream.getReader();
    const { port1, port2 } = new MessageChannel();
    let ended = false;
    let reading = false;
    const finish = () => { ended = true; port1.close(); try { reader.releaseLock(); } catch {} };
    const cancel = async reason => {
      if (ended) return;
      ended = true;
      try { await reader.cancel(reason); } catch {} finally { finish(); }
    };
    port1.onmessageerror = () => { void cancel('Stream message could not be decoded'); };
    port1.onmessage = async ({ data }) => {
      if (ended) return;
      if (data?.type === 'cancel') { await cancel(data.reason); return; }
      if (data?.type !== 'pull' || reading) return;
      reading = true;
      try {
        const { value, done } = await reader.read();
        if (ended) return;
        if (done) { port1.postMessage({ type: 'end' }); finish(); return; }
        // Never detach a WASM buffer or another chunk sharing the same buffer.
        const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
        if (!ArrayBuffer.isView(bytes)) throw new TypeError('Expected a byte stream');
        const buffer = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice().buffer;
        port1.postMessage({ type: 'chunk', buffer }, [buffer]);
      } catch (error) {
        if (!ended) {
          port1.postMessage({ type: 'error', message: error?.message || 'Stream failed' });
          finish();
        }
      } finally { reading = false; }
    };
    return { value: { $veloraStreamPort: 1, port: port2 }, port: port2, cancel };
  }

  function receiveStream(port) {
    let pending;
    let ended = false;
    const finish = () => { ended = true; pending?.(); pending = undefined; port.close(); };
    return new ReadableStream({
      start(controller) {
        port.onmessage = ({ data }) => {
          if (ended) return;
          if (data?.type === 'chunk' && data.buffer instanceof ArrayBuffer) {
            controller.enqueue(new Uint8Array(data.buffer));
            pending?.(); pending = undefined;
          } else if (data?.type === 'end') {
            controller.close(); finish();
          } else if (data?.type === 'error') {
            controller.error(new Error(data.message || 'Remote stream failed')); finish();
          }
        };
        port.onmessageerror = () => {
          controller.error(new Error('Stream message could not be decoded'));
          port.postMessage({ type: 'cancel', reason: 'Stream message could not be decoded' });
          finish();
        };
      },
      pull() {
        if (ended) return;
        return new Promise(resolve => { pending = resolve; port.postMessage({ type: 'pull' }); });
      },
      cancel(reason) {
        if (!ended) port.postMessage({ type: 'cancel', reason: String(reason ?? '') });
        finish();
      }
    }, { highWaterMark: 0 });
  }

  function decode(value) {
    if (!value || typeof value !== 'object') return value;
    if (value.$veloraStreamPort === 1 && value.port && typeof value.port.postMessage === 'function') return receiveStream(value.port);
    if (Array.isArray(value)) return value.map(decode);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  }
  function send(raw, value, transfers = []) {
    const native = supportsStreams();
    const transfer = new Set(transfers.filter(item => native || !isStream(item)));
    const bridges = [];
    function encode(item) {
      if (isStream(item)) {
        if (native) { transfer.add(item); return item; }
        const bridge = sendStream(item);
        bridges.push(bridge);
        transfer.add(bridge.port);
        return bridge.value;
      }
      if (Array.isArray(item)) return item.map(encode);
      if (!isRecord(item)) return item;
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, encode(child)]));
    }
    try { return raw(encode(value), [...transfer]); }
    catch (error) { for (const bridge of bridges) { void bridge.cancel('Message transfer failed'); bridge.port.close(); } throw error; }
  }
  globalThis.$veloraStreamRPC = { send, decode, supportsStreams };
})();
