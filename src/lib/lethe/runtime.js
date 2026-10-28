import { loadScript } from './loader.js';
import { registerProxyWorker } from './serviceworker.js';
import { createConnection, setCar } from './car.js';
import { createScramjetController } from './poly.js';
import { createPrismController, setPrismTransport } from './prism.js';
import { recordActivity, activityReason } from '../utils/developer/diagnostics.js';

const defaults = {
	loadScript, registerProxyWorker, createConnection, setCar,
	createScramjetController, createPrismController, setPrismTransport,
	async enablePopups() { await (await import('./reflux.js')).enablePopupInterceptor(); }
};

// One selected engine and one relay per page. Share in-flight warmup with clicks.
export function createProxyRuntime({ interceptPopups = false, dependencies = defaults } = {}) {
	const d = dependencies;
	let pending;
	let requestedKey;
	let updates = Promise.resolve();
	let currentKey;
	let current;
	let connection;
	let polygon;
	let legacyTransportKey;
	let popupsReady = false;
	return {
		prepare(engine = 'sj2', car = 'libcurl', wisp) {
			engine = ['uv', 'glass'].includes(engine) ? 'uv' : ['sj', 'polygon'].includes(engine) ? 'sj' : 'sj2';
			const key = JSON.stringify([engine, car, wisp || '']);
			if (requestedKey === key && pending) return pending;
			const prepare = async () => {
				if (key === currentKey) { recordActivity('connection-reused', { engine, transport: car }); return current; }
				recordActivity('connection-start', { engine, transport: car });
				let result;
				if (engine === 'sj2') {
					const controller = await d.createPrismController(car, wisp);
					await d.setPrismTransport(car, wisp);
					result = { engine, controller };
				} else {
					await Promise.all([
						d.registerProxyWorker(),
						d.loadScript('/charon/index.js'),
						engine === 'uv'
							? d.loadScript('/glass/glass.bundle.js').then(() => d.loadScript('/glass/glass.config.js'))
							: d.loadScript('/poly/polygon.all.js')
					]);
					connection ??= d.createConnection();
					const transportKey = JSON.stringify([car, wisp || '']);
					if (legacyTransportKey !== transportKey) {
						await d.setCar(connection, car, wisp);
						legacyTransportKey = transportKey;
					}
					if (engine === 'sj' && !polygon) {
						const next = d.createScramjetController();
						await next.init();
						polygon = next;
					}
					if (interceptPopups && !popupsReady) {
						await d.enablePopups();
						popupsReady = true;
					}
					result = { engine, connection, polygon };
				}
				currentKey = key;
				current = result;
				return result;
			};
			const started = Date.now();
			const job = updates.catch(() => {}).then(prepare).then(result => {
				recordActivity('connection-ready', { engine, transport: car, duration: Date.now() - started });
				return result;
			}, error => {
				recordActivity('connection-failed', { engine, transport: car, duration: Date.now() - started, reason: activityReason(error) });
				throw error;
			});
			updates = job;
			requestedKey = key;
			pending = job;
			const clear = () => { if (pending === job) pending = undefined; };
			job.then(clear, clear);
			return job;
		}
	};
}
