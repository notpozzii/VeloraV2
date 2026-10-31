// Embedded downloads can have a different storage partition from top-level
// pages. Give the worker a port explicitly instead of relying on clients.matchAll.
export function createTransportBridge(host, timeoutMs = 5000) {
	const workers = host.navigator.serviceWorker;
	let pending;
	let pendingWorker;
	let enabled = false;
	async function connect() {
		enabled = true;
		const worker = workers.controller;
		if (!worker) throw new Error('The app worker is not connected. Try again.');
		if (pending && pendingWorker === worker) return pending;
		pendingWorker = worker;
		const job = new Promise((resolve, reject) => {
			const shared = new host.SharedWorker('/charon/worker.js', 'bare-mux-worker');
			const reply = new host.MessageChannel();
			const finish = (error) => {
				clearTimeout(timer);
				reply.port1.close();
				error ? reject(error) : resolve();
			};
			const timer = setTimeout(() => finish(new Error('The app connection timed out. Try again.')), timeoutMs);
			reply.port1.onmessage = ({ data }) => finish(data?.type === 'velora:transport-ready'
				? undefined : new Error('The app connection could not start. Try again.'));
			try {
				worker.postMessage({ type: 'velora:bind-transport', transport: shared.port, reply: reply.port2 }, [shared.port, reply.port2]);
			} catch (error) {
				shared.port.close();
				reply.port2.close();
				finish(error);
			}
		});
		pending = job;
		try { await job; }
		catch (error) {
			if (workers.controller !== worker) return connect();
			throw error;
		}
		finally { if (pending === job) pending = undefined; }
	}
	workers.addEventListener('controllerchange', () => {
		if (enabled) void connect().catch(() => {}); // the next launch reports a retryable error
	});
	return connect;
}

let bridge;
export function bindProxyTransport() {
	bridge ??= createTransportBridge(window);
	return bridge();
}
