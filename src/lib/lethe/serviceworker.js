const blockedMessage = 'The proxy could not start in this browser context.';
const registrations = new WeakMap();

export function registerProxyWorker(serviceWorker = navigator.serviceWorker, timeoutMs = 15000, options = {}) {
	if (!serviceWorker) return Promise.reject(new Error(blockedMessage));
	let entries = registrations.get(serviceWorker);
	if (!entries) registrations.set(serviceWorker, entries = new Map());
	const key = JSON.stringify([options.scriptURL || '/servy.js', options.scope || '']);
	const existing = entries.get(key);
	if (existing) {
		if (!existing.controller) return existing.promise;
		if (serviceWorker.controller?.scriptURL === existing.controller.scriptURL) return Promise.resolve(serviceWorker.controller);
	}
	const entry = {};
	entries.set(key, entry);
	entry.promise = startProxyWorker(serviceWorker, timeoutMs, options).then((controller) => {
		entry.controller = controller;
		return controller;
	}, (error) => {
		if (entries.get(key) === entry) entries.delete(key);
		throw error;
	});
	return entry.promise;
}

/** Wait for this document to be controlled, not just for registration to finish. */
async function startProxyWorker(serviceWorker, timeoutMs, { scriptURL = '/servy.js', scope } = {}) {
	if (!serviceWorker) throw new Error(blockedMessage);
	let timeout;
	let onChange;
	let workerState;
	let onWorkerState;
	let cancelled = false;
	const deadline = new Promise((_, reject) => {
		timeout = setTimeout(() => reject(new Error(blockedMessage)), timeoutMs);
	});
	try {
		const startup = async () => {
			const registration = await serviceWorker.register(scriptURL, {
				type: 'classic', updateViaCache: 'none', ...(scope ? { scope } : {})
			});
			await serviceWorker.ready;
			if (cancelled) throw new Error(blockedMessage);
			// A matching URL can still be the previous worker while an update is
			// installing. Wait for this registration's worker before giving it
			// controller ports or navigating a proxy frame.
			workerState = registration.installing || registration.waiting || registration.active;
			if (workerState && workerState.state !== 'activated') {
				let activationRequested = false;
				await new Promise((resolve, reject) => {
					onWorkerState = () => {
						// Safari can leave an installed replacement waiting even after
						// its install-time skipWaiting(). Ask that worker explicitly.
						if (workerState.state === 'installed' && !activationRequested) {
							activationRequested = true;
							workerState.postMessage({ type: 'velora:activate-worker' });
						}
						if (workerState.state === 'activated') resolve();
						else if (workerState.state === 'redundant') reject(new Error(blockedMessage));
					};
					workerState.addEventListener('statechange', onWorkerState);
					onWorkerState();
				});
			}
			if (cancelled) throw new Error(blockedMessage);
			const controlsPage = () => workerState
				? serviceWorker.controller === workerState
				: serviceWorker.controller?.scriptURL === new URL(scriptURL, registration.scope).href;
			if (!controlsPage()) {
				await new Promise((resolve) => {
					onChange = () => { if (controlsPage()) resolve(); };
					serviceWorker.addEventListener('controllerchange', onChange);
					onChange();
				});
			}
			return serviceWorker.controller;
		};
		return await Promise.race([startup(), deadline]);
	} catch (error) {
		throw new Error(blockedMessage, { cause: error });
	} finally {
		cancelled = true;
		clearTimeout(timeout);
		if (onChange) serviceWorker.removeEventListener('controllerchange', onChange);
		if (onWorkerState) workerState.removeEventListener('statechange', onWorkerState);
	}
}
