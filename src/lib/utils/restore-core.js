import { highestSameOriginWindow, unregisterSiteWorkers, resetInProgress, resetStorageKey, resetIntentKey, resetWaitKey } from './reset-core.js';
import { restoreStorageKey, restoreIntentKey, restoreWaitKey, restoreChannelName, restoreStagingDatabase, restoreReturnPath, readRestoreMarker, validRestoreId } from './restore-state.js';
export * from './restore-state.js';

export function validateRestoreManifest(manifest) {
	if (manifest?.format !== 'origin-snapshot' || manifest.version !== 1 || !manifest.sections || typeof manifest.sections !== 'object') {
		throw new Error('This file is not a supported Velora backup.');
	}
	if (manifest.sections.indexedDB?.some(database => database.name === restoreStagingDatabase)) {
		throw new Error('This backup includes an unfinished restore. Export a new backup and try again.');
	}
	return manifest;
}

export async function exportDatabaseNames(host) {
	if (!host.indexedDB?.databases) return undefined;
	return (await host.indexedDB.databases()).map(database => database.name).filter(name => name && name !== restoreStagingDatabase);
}

async function stagingDatabase(host) {
	if (!host.indexedDB) throw new Error('This browser cannot prepare a restore. Open Velora in a regular browser tab and try again.');
	return new Promise((resolve, reject) => {
		const request = host.indexedDB.open(restoreStagingDatabase, 1);
		request.onupgradeneeded = () => request.result.createObjectStore('snapshots', { keyPath: 'id' });
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const database = request.result;
			database.onversionchange = () => database.close();
			resolve(database);
		};
	});
}

function transactionDone(transaction) {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = resolve;
		transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('The backup could not be prepared.'));
	});
}

export async function stageSnapshot(host, record) {
	const database = await stagingDatabase(host);
	try {
		const transaction = database.transaction('snapshots', 'readwrite');
		const finished = transactionDone(transaction);
		transaction.objectStore('snapshots').clear();
		transaction.objectStore('snapshots').put(record);
		await finished;
	} finally { database.close(); }
}

export async function readStagedSnapshot(host, id) {
	if (!validRestoreId(id)) return null;
	const database = await stagingDatabase(host);
	try {
		const transaction = database.transaction('snapshots', 'readonly');
		const finished = transactionDone(transaction);
		const request = transaction.objectStore('snapshots').get(id);
		const reading = new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
		const [record] = await Promise.all([reading, finished]);
		return record;
	} finally { database.close(); }
}

export async function removeStagedSnapshot(host, id) {
	const database = await stagingDatabase(host);
	try {
		const transaction = database.transaction('snapshots', 'readwrite');
		const finished = transactionDone(transaction);
		transaction.objectStore('snapshots').delete(id);
		await finished;
	} finally { database.close(); }
}

export function restorePageUrl(host, id, returnTo, phase = '') {
	const url = new URL('/restore.html', host.location.origin);
	if (id) url.searchParams.set('id', id);
	url.searchParams.set('return', restoreReturnPath(returnTo));
	if (phase) url.searchParams.set('phase', phase);
	return url.href;
}

export async function beginSiteRestore(host, file, manifest) {
	validateRestoreManifest(manifest);
	if (resetInProgress(host)) throw new Error('Another data operation is already running. Finish it before restoring this backup.');
	const target = highestSameOriginWindow(host);
	const intent = { id: host.crypto.randomUUID(), time: Date.now(), returnTo: restoreReturnPath(target.location.pathname) };
	await stageSnapshot(host, { id: intent.id, file, returnTo: intent.returnTo });
	// Keep the file off localStorage and the URL. The isolated restore page can
	// read it after unloading the desktop and its open database connections.
	host.sessionStorage.setItem(restoreIntentKey, JSON.stringify(intent));
	if (target.__galaxyAntiClose) target.removeEventListener('beforeunload', target.__galaxyAntiClose);
	target.location.replace(restorePageUrl(host, intent.id, intent.returnTo));
	return intent;
}

export function readRestoreIntent(host, id, now = Date.now()) {
	try {
		const intent = JSON.parse(host.sessionStorage.getItem(restoreIntentKey) || 'null');
		const limit = readRestoreMarker(host)?.id === id ? 86400000 : 300000;
		return validRestoreId(id) && intent?.id === id && typeof intent.time === 'number' && now >= intent.time && now - intent.time < limit
			? { ...intent, returnTo: restoreReturnPath(intent.returnTo) } : null;
	} catch { return null; }
}

export function installRestoreCoordinator(host) {
	let channel;
	let holding = false;
	function hold() {
		const marker = readRestoreMarker(host);
		if (!marker || holding) return;
		holding = true;
		host.__veloraRestoring = true;
		try { host.sessionStorage.setItem(restoreWaitKey, JSON.stringify({ id: marker.id })); } catch {}
		const target = highestSameOriginWindow(host);
		target.__veloraRestoring = true;
		if (target.__galaxyAntiClose) target.removeEventListener('beforeunload', target.__galaxyAntiClose);
		if (target.document?.documentElement) target.document.documentElement.inert = true;
		target.document?.querySelectorAll('iframe').forEach(frame => frame.remove());
		target.stop?.();
		target.location.replace(restorePageUrl(host, marker.id, marker.returnTo, 'wait'));
	}
	const onStorage = event => { if (event.key === restoreStorageKey) hold(); };
	try {
		if (host.BroadcastChannel) {
			channel = new host.BroadcastChannel(restoreChannelName);
			channel.onmessage = event => { if (event.data?.type === 'start' && event.data.id === readRestoreMarker(host)?.id) hold(); };
		}
	} catch {}
	host.addEventListener('storage', onStorage);
	hold();
	return { get holding() { return holding; }, dispose() { host.removeEventListener('storage', onStorage); channel?.close(); } };
}

export async function applyStagedRestore(host, record, importSnapshot, onblocked = () => {}) {
	if (readRestoreMarker(host)?.id !== record.id) throw new Error('This restore was interrupted. Please start it again.');
	await unregisterSiteWorkers(host);
	await importSnapshot(record.file, {
		preserveStorageKeys: [restoreStorageKey, restoreIntentKey, restoreWaitKey, resetStorageKey, resetIntentKey, resetWaitKey],
		onblocked
	});
	await removeStagedSnapshot(host, record.id);
	host.sessionStorage.removeItem(restoreIntentKey);
	host.sessionStorage.removeItem(restoreWaitKey);
	// Waiting apps can resume only after the complete snapshot is restored.
	if (readRestoreMarker(host)?.id === record.id) host.localStorage.removeItem(restoreStorageKey);
}
