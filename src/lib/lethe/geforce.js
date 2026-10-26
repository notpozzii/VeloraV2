import { loadScript } from './loader.js';
import { registerProxyWorker } from './serviceworker.js';
import { codec } from './codec.js';
import { getWispUrl } from './car.js';
import { GEFORCE_URL } from '$lib/utils/browser/geforce.js';

// The working GeForce engine has its own assets and worker scope. It never
// replaces the desktop browser's active engine or service-worker registration.
export async function startGeForce(frame, customWisp = '', isCurrent = () => true) {
  const assets = '/geforce-runtime';
  for (const script of ['/prism/stream-transfer.js', `${assets}/prism.js`, `${assets}/prism.api.js`, `${assets}/libby.js`]) {
    await loadScript(script);
    if (!isCurrent()) return;
  }
  const worker = await registerProxyWorker(navigator.serviceWorker, 15000, {
    scriptURL: '/geforce/servy.js', scope: '/geforce/'
  });
  if (!isCurrent()) return;
  const Libcurl = window.LibcurlTransport.LibcurlClient ?? window.LibcurlTransport.default ?? window.LibcurlTransport;
  const transport = new Libcurl({ wisp: getWispUrl(customWisp) });
  await transport.init();
  if (!isCurrent()) return;
  const { Controller } = window.$scramjetController;
  const controller = new Controller({
    serviceworker: worker,
    transport,
    config: {
      prefix: '/geforce/proxy/',
      scramjetPath: `${assets}/prism.js`,
      injectPath: `${assets}/prism.inject.js`,
      wasmPath: `${assets}/prism.wasm`,
      codec
    }
  });
  await controller.wait();
  if (!isCurrent()) return;
  controller.createFrame(frame).go(GEFORCE_URL);
}
