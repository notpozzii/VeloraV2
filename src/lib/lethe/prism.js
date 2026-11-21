import { registerProxyWorker } from './serviceworker.js';
import { loadScript } from './loader.js';
import { getWispUrl } from './car.js';
import { resolveRelays } from './relay-config.js';
import { codec } from './codec.js';
import { createRelayTransport } from './relay-fallback.js';

let controller;
let starting;
let transportKey;
let updates = Promise.resolve();

async function loadTransport(car) {
	await loadScript(car === 'epoxy' ? '/prism/libbyworse.js' : '/prism/libby.js');
}

function makeTransport(car, custom) {
	const wisp = custom;
	if (car === 'epoxy') {
		const Epoxy = window.EpoxyTransport.default ?? window.EpoxyTransport;
		return new Epoxy({ wisp });
	}

	const Libcurl =
		window.LibcurlTransport.LibcurlClient ??
		window.LibcurlTransport.default ??
		window.LibcurlTransport;
	return new Libcurl({ wisp });
}

export async function createPrismController(car = 'libcurl', customWisp, backupWisp, { recoverPrimary = false } = {}) {
	if (controller) return controller;
	if (starting) return starting;
	starting = initialize(car, customWisp, backupWisp, recoverPrimary);
	try { return await starting; } finally { starting = null; }
}

async function initialize(car, customWisp, backupWisp, recoverPrimary) {
	const [sw] = await Promise.all([
		registerProxyWorker(),
		loadScript('/prism/stream-transfer.js').then(() => loadScript('/prism/prism.js')).then(() => loadScript('/prism/prism.api.js')),
		loadTransport(car)
	]);
	const transport = createRelayTransport(relay => makeTransport(car, relay), customWisp, { backupWisp, recoverPrimary });
	const { Controller, config } = window.$scramjetController;
	config.scramjetPath = '/prism/prism.js';
	config.injectPath = '/prism/prism.inject.js';
	config.wasmPath = '/prism/prism.wasm';
	config.codec.encode = codec.encode;
	config.codec.decode = codec.decode;
	const next = new Controller({ serviceworker: sw, transport });
	// Compile the engine and connect the relay together, rather than serially.
	await Promise.all([next.wait(), transport.init()]);
	controller = next;
	transportKey = JSON.stringify([car, getWispUrl(customWisp, backupWisp), resolveRelays(customWisp, backupWisp).backup]);
	return controller;
}
export function setPrismTransport(car, customWisp, backupWisp) {
	const update = async () => {
		if (starting) await starting;
		const key = JSON.stringify([car, getWispUrl(customWisp, backupWisp), resolveRelays(customWisp, backupWisp).backup]);
		if (!controller || key === transportKey) return;
		await loadTransport(car);
		const transport = createRelayTransport(relay => makeTransport(car, relay), customWisp, { backupWisp });
		await transport.init();
		controller.setTransport(transport);
		transportKey = key;
	};
	updates = updates.catch(() => {}).then(update);
	return updates;
}

export function getPrismController() {
	return controller;
}
