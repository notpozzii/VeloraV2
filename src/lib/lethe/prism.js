import { registerProxyWorker } from './serviceworker.js';
import { loadScript } from './loader.js';
import { getWispUrl } from './car.js';
import { codec } from './codec.js';
import { createRecoveringTransport } from './recovering-transport.js';

let controller;
let starting;
let transportKey;
let updates = Promise.resolve();

async function loadTransport(car) {
	await loadScript(car === 'epoxy' ? '/prism/libbyworse.js' : '/prism/libby.js');
}

function makeTransport(car, custom) {
	const wisp = getWispUrl(custom);
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

export async function createPrismController(car = 'libcurl', customWisp) {
	if (controller) return controller;
	if (starting) return starting;
	starting = initialize(car, customWisp);
	try { return await starting; } finally { starting = null; }
}

async function initialize(car, customWisp) {
	const [sw] = await Promise.all([
		registerProxyWorker(),
		loadScript('/prism/stream-transfer.js').then(() => loadScript('/prism/prism.js')).then(() => loadScript('/prism/prism.api.js')),
		loadTransport(car)
	]);
	const transport = createRecoveringTransport(() => makeTransport(car, customWisp));
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
	transportKey = JSON.stringify([car, getWispUrl(customWisp)]);
	return controller;
}
export function setPrismTransport(car, customWisp) {
	const update = async () => {
		if (starting) await starting;
		const key = JSON.stringify([car, getWispUrl(customWisp)]);
		if (!controller || key === transportKey) return;
		await loadTransport(car);
		const transport = createRecoveringTransport(() => makeTransport(car, customWisp));
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
