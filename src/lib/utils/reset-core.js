export const resetStorageKey = 'velora:reset-in-progress';
export const resetIntentKey = 'velora:reset-intent';
export const resetWaitKey = 'velora:reset-wait';
export const resetChannelName = 'velora-site-reset';
const validId = value => typeof value === 'string' && /^[a-z0-9-]{20,80}$/i.test(value);
export const resetReturnPath = value => value === '/index.html' ? '/index.html' : '/';

export function readResetMarker(host) {
	try {
		const value = JSON.parse(host.localStorage.getItem(resetStorageKey) || 'null');
		return validId(value?.id) ? { id: value.id, returnTo: resetReturnPath(value.returnTo) } : null;
	} catch { return null; }
}

export function resetInProgress(host = globalThis.window) {
	return !!host && (host.__veloraResetting === true || !!readResetMarker(host));
}

export function highestSameOriginWindow(host) {
	let target = host;
	try {
		while (target.parent && target.parent !== target) {
			void target.parent.document;
			target = target.parent;
		}
	} catch { /* Cross-origin embedding stops here. */ }
	return target;
}

export function resetPageUrl(host, id, returnTo, phase = '') {
	const url = new URL('/reset.html', host.location.origin);
	if (id) url.searchParams.set('id', id);
	url.searchParams.set('return', resetReturnPath(returnTo));
	if (phase) url.searchParams.set('phase', phase);
	return url.href;
}

export function beginSiteReset(host, returnTo = '/') {
	const intent = { id: host.crypto.randomUUID(), time: Date.now(), returnTo: resetReturnPath(returnTo) };
	// A direct link to reset.html cannot erase anything without this short-lived
	// intent, or a second explicit confirmation on the standalone reset page.
	host.sessionStorage.setItem(resetIntentKey, JSON.stringify(intent));
	highestSameOriginWindow(host).location.replace(resetPageUrl(host, intent.id, intent.returnTo));
	return intent;
}

export function readResetIntent(host, id, now = Date.now()) {
	try {
		const intent = JSON.parse(host.sessionStorage.getItem(resetIntentKey) || 'null');
		return validId(id) && intent?.id === id && typeof intent.time === 'number' && now >= intent.time && now - intent.time < 300000
			? { ...intent, returnTo: resetReturnPath(intent.returnTo) } : null;
	} catch { return null; }
}

export function installResetCoordinator(host) {
	let channel;
	let holding = false;
	function hold() {
		const marker = readResetMarker(host);
		if (!marker || holding) return;
		holding = true;
		host.__veloraResetting = true;
		try { host.sessionStorage.setItem(resetWaitKey, JSON.stringify({ id: marker.id })); } catch {}
		const target = highestSameOriginWindow(host);
		target.__veloraResetting = true;
		// Stop interactive writes and unload child apps before leaving this page.
		if (target.__galaxyAntiClose) target.removeEventListener('beforeunload', target.__galaxyAntiClose);
		if (target.document?.documentElement) target.document.documentElement.inert = true;
		target.document?.querySelectorAll('iframe').forEach(frame => frame.remove());
		target.stop?.();
		target.location.replace(resetPageUrl(host, marker.id, marker.returnTo, 'wait'));
	}
	const onStorage = event => { if (event.key === resetStorageKey) hold(); };
	try {
		if (host.BroadcastChannel) {
			channel = new host.BroadcastChannel(resetChannelName);
			channel.onmessage = event => { if (event.data?.type === 'start' && event.data.id === readResetMarker(host)?.id) hold(); };
		}
	} catch {}
	host.addEventListener('storage', onStorage);
	hold();
	return { get holding() { return holding; }, dispose() { host.removeEventListener('storage', onStorage); channel?.close(); } };
}

export async function unregisterSiteWorkers(host) {
	const serviceWorker = host.navigator?.serviceWorker;
	if (!serviceWorker) return;
	if (!serviceWorker.getRegistrations) throw new Error('This browser cannot list its background workers. Clear this site’s data in your browser settings.');
	const registrations = await serviceWorker.getRegistrations();
	await Promise.all(registrations.map(registration => registration.unregister()));
	if ((await serviceWorker.getRegistrations()).length) throw new Error('Some background workers are still active. Close other Velora tabs and retry.');
}

function deleteDatabase(indexedDB, name, onprogress) {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);
		// A blocked deletion cannot be cancelled. Keep waiting rather than
		// reporting success or leaving a deletion queued behind a new session.
		request.onblocked = () => onprogress('blocked');
		request.onerror = () => reject(new Error('Some saved data could not be cleared. Close other Velora tabs and retry.'));
		request.onsuccess = () => { onprogress('data'); resolve(); };
	});
}

function clearVisibleCookies(host) {
	if (!host.document) return;
	const names = host.document.cookie.split(';').map(value => value.split('=')[0].trim()).filter(Boolean);
	const paths = ['/', '/settings', '/os', '/slate', '/apps', '/books', '/api', '/prism', '/polygon', '/service', '/service/glass', '/geforce'];
	for (const name of names) for (const path of paths) {
		for (const domain of ['', `; Domain=${host.location.hostname}`]) {
			host.document.cookie = `${name}=; Max-Age=0; Path=${path}${domain}; SameSite=Lax${host.location.protocol === 'https:' ? '; Secure' : ''}`;
		}
	}
}

export async function clearSiteData(host, { onprogress = () => {}, beforeFinish = () => {} } = {}) {
	const indexedDB = host.indexedDB;
	if (indexedDB && !indexedDB.databases) throw new Error('This browser cannot list local databases. Use your browser’s site-data controls for a full reset.');
	const databases = indexedDB ? await indexedDB.databases() : [];
	onprogress('data');
	for (const name of new Set(databases.map(database => database.name).filter(Boolean))) await deleteDatabase(indexedDB, name, onprogress);
	onprogress('cache');
	if (host.caches) await Promise.all((await host.caches.keys()).map(name => host.caches.delete(name)));
	if (host.navigator?.storage?.getDirectory) {
		const root = await host.navigator.storage.getDirectory();
		for await (const [name] of root.entries()) await root.removeEntry(name, { recursive: true });
	}
	if (indexedDB && (await indexedDB.databases()).some(database => database.name)) throw new Error('Saved data is still being used. Close other Velora tabs and retry.');
	if (host.caches && (await host.caches.keys()).length) throw new Error('Some cached data could not be cleared. Retry the reset.');
	onprogress('preferences');
	beforeFinish();
	clearVisibleCookies(host);
	// The reset marker lives in localStorage. Remove it last, only after every
	// other operation succeeds, so waiting pages cannot resume prematurely.
	host.sessionStorage.clear();
	if (host.sessionStorage.length) throw new Error('Session data could not be cleared. Retry the reset.');
	host.localStorage.clear();
	if (host.localStorage.length) throw new Error('Local data could not be cleared. Retry the reset.');
	onprogress('done');
}
