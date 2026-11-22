import { registerProxyWorker } from './serviceworker.js';
import { loadScript } from './loader.js';
import { getWispUrl } from './car.js';
import { resolveRelays } from './relay-config.js';
import { codec } from './codec.js';
import { createRelayTransport } from './relay-fallback.js';

const states = new Map();
let assetQueue = Promise.resolve();

function stateFor(engine) {
	if (!states.has(engine)) states.set(engine, { updates: Promise.resolve() });
	return states.get(engine);
}

function loadEngine(state, engine) {
	const path = engine === 'sj2-original' ? '/prism/prism.original.js' : '/prism/prism.js';
	// The classic bundles assign to the same global. Capture each IIFE's
	// exports before the other one can load.
	const job = assetQueue.catch(() => {}).then(async () => {
		await loadScript('/prism/stream-transfer.js');
		if (!state.runtime) {
			await loadScript(path);
			state.runtime = window.$scramjet;
		}
		await loadScript('/prism/prism.api.js');
		return { api: window.$veloraCreatePrismApi(state.runtime), path };
	});
	assetQueue = job;
	return job;
}

async function transportConstructor(car) {
	let bundle;
	switch (car) {
		case 'epoxy':
			await loadScript('/prism/libbyworse.js');
			bundle = window.EpoxyTransport;
			break;
		case 'libcurl-original':
			await loadScript('/prism/libby.original.js');
			bundle = window.LibcurlOriginalTransport;
			break;
		default:
			await loadScript('/prism/libby.js');
			bundle = window.LibcurlTransport;
	}
	return bundle.LibcurlClient ?? bundle.default ?? bundle;
}

function connectionKey(car, relay, backup) {
	return JSON.stringify([car, getWispUrl(relay, backup), resolveRelays(relay, backup).backup]);
}

export async function createPrismController(car = 'libcurl', customWisp, backupWisp, { recoverPrimary = false, engine = 'sj2' } = {}) {
	const state = stateFor(engine);
	if (state.controller) return state.controller;
	if (state.starting) return state.starting;
	state.starting = initialize(state, engine, car, customWisp, backupWisp, recoverPrimary);
	try { return await state.starting; } finally { state.starting = null; }
}

async function initialize(state, engine, car, customWisp, backupWisp, recoverPrimary) {
	const [serviceworker, { api, path }, Transport] = await Promise.all([
		registerProxyWorker(), loadEngine(state, engine), transportConstructor(car)
	]);
	const transport = createRelayTransport(wisp => new Transport({ wisp }), customWisp, { backupWisp, recoverPrimary });
	const controller = new api.Controller({
		serviceworker,
		transport,
		config: { scramjetPath: path, injectPath: '/prism/prism.inject.js', wasmPath: '/prism/prism.wasm', codec }
	});
	await Promise.all([controller.wait(), transport.init()]);
	state.controller = controller;
	state.transportKey = connectionKey(car, customWisp, backupWisp);
	return controller;
}

export function setPrismTransport(car, customWisp, backupWisp, engine = 'sj2') {
	const state = stateFor(engine);
	const update = async () => {
		if (state.starting) await state.starting;
		const key = connectionKey(car, customWisp, backupWisp);
		if (!state.controller || key === state.transportKey) return;
		const Transport = await transportConstructor(car);
		const transport = createRelayTransport(wisp => new Transport({ wisp }), customWisp, { backupWisp });
		await transport.init();
		state.controller.setTransport(transport);
		state.transportKey = key;
	};
	state.updates = state.updates.catch(() => {}).then(update);
	return state.updates;
}

export function getPrismController(engine = 'sj2') {
	return states.get(engine)?.controller;
}

export function getPrismRewriter(engine) {
	return states.get(engine)?.runtime;
}
