import { defaultEngine, defaultTransport } from '../lethe/connection-options.js';

export const connectionDefaults = Object.freeze({ lethe: defaultEngine, car: defaultTransport, customWisp: '', backupWisp: '' });
export const connectionResetKey = 'velora:connection-defaults';
export const connectionResetVersion = '2026-11-22.3';
const previousDefaultPairs = new Map([
	['2026-10-30.1', ['sj2', 'libcurl']],
	['2026-11-22.1', ['sj2-original', 'libcurl-original']],
	['2026-11-22.2', ['sj2', 'libcurl-original']]
]);
const sessionResetKey = `${connectionResetKey}:session`;
const autoChoicesKey = 'velora:auto-connections:v1';
export const isConnectionSetting = key => Object.hasOwn(connectionDefaults, key);

export async function restoreConnectionDefaults({ store, legacyStorage, sessionStorage, notify = () => {}, resetting = () => false }) {
	if (!store || resetting()) throw new Error('Connection settings are unavailable');
	await store.runTransaction('readwrite', async transaction => {
		await Promise.all(Object.entries(connectionDefaults).map(([key, value]) => transaction.set(key, value)));
		if (resetting()) throw new Error('Site reset in progress');
	});
	if (resetting()) return;
	try { sessionStorage?.()?.removeItem(autoChoicesKey); } catch {}
	for (const [key, value] of Object.entries(connectionDefaults)) {
		try { legacyStorage?.()?.removeItem(key); } catch {}
		try { notify(key, value); } catch {}
	}
}

// Migrate earlier default pairs once per origin. Commit the settings
// and marker together so concurrent tabs observe the same defaults.
export function createConnectionReset({ store, legacyStorage, sessionStorage, lock, resetting = () => false, notify = () => {} }) {
	let pending;
	function clearAutoChoices() {
		try {
			const session = sessionStorage?.();
			if (session && session.getItem(sessionResetKey) !== connectionResetVersion) {
				session.removeItem(autoChoicesKey);
				session.setItem(sessionResetKey, connectionResetVersion);
			}
		} catch { /* Unavailable session storage also disables remembered Auto choices. */ }
	}
	async function migrate() {
		if (resetting()) return false;
		const changes = await store.runTransaction('readwrite', async transaction => {
			const version = await transaction.get(connectionResetKey);
			if (version === connectionResetVersion) return [];
			if (resetting()) throw new Error('Site reset in progress');

			let entries = Object.entries(connectionDefaults);
			const previousPair = previousDefaultPairs.get(version);
			if (previousPair) {
				const [engine, transport] = await Promise.all([transaction.get('lethe'), transaction.get('car')]);
				entries = [];
				if (engine === previousPair[0] && transport === previousPair[1]) {
					if (engine !== defaultEngine) entries.push(['lethe', defaultEngine]);
					if (transport !== defaultTransport) entries.push(['car', defaultTransport]);
				}
			}
			await Promise.all([
				...entries.map(([key, value]) => transaction.set(key, value)),
				transaction.set(connectionResetKey, connectionResetVersion)
			]);
			return entries;
		});
		if (resetting()) return false;
		for (const [key, value] of changes) {
			try { legacyStorage?.()?.removeItem(key); } catch {}
			try { notify(key, value); } catch {}
		}
		return true;
	}
	return {
		ensure() {
			if (!pending) pending = (async () => {
				if (!store || resetting()) return false;
				clearAutoChoices();
				try {
					// IndexedDB is atomic itself. Web Locks additionally serialize
					// the localStorage driver's fallback across tabs when available.
					return await (lock ? lock(migrate) : migrate());
				} catch {
					// If storage is unavailable, readers use the new defaults for this
					// visit instead of silently restoring an old Epoxy preference.
					return false;
				}
			})();
			return pending;
		}
	};
}
