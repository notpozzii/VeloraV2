const blockedMessage = 'The proxy could not start in this browser context. Open Velora directly and try again.';

/** Wait for this document to be controlled, not just for registration to finish. */
export async function registerProxyWorker(serviceWorker = navigator.serviceWorker, timeoutMs = 15000) {
	if (!serviceWorker) throw new Error(blockedMessage);
	let timeout;
	let onChange;
	let cancelled = false;
	const deadline = new Promise((_, reject) => {
		timeout = setTimeout(() => reject(new Error(blockedMessage)), timeoutMs);
	});
	try {
		const startup = async () => {
			const registration = await serviceWorker.register('/servy.js', {
				type: 'classic', updateViaCache: import.meta.env?.VITE_VELORA_S3 === '1' ? 'imports' : 'none'
			});
			await serviceWorker.ready;
			if (cancelled) throw new Error(blockedMessage);
			const controlsPage = () => serviceWorker.controller?.scriptURL === new URL('servy.js', registration.scope).href;
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
	}
}
