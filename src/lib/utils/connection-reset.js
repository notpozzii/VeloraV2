export const connectionDefaults = Object.freeze({ lethe: 'sj2', car: 'libcurl', customWisp: '' });
export const connectionResetKey = 'velora:connection-defaults';
export const connectionResetVersion = '2026-10-29.1';
const sessionResetKey = `${connectionResetKey}:session`;
const autoChoicesKey = 'velora:auto-connections:v1';
export const isConnectionSetting = key => Object.hasOwn(connectionDefaults, key);

// This release resets connection choices once per origin, not on every visit.
// Use the settings driver's transaction so a second tab cannot observe a reset
// marker before all three defaults have committed.
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
		const changed = await store.runTransaction('readwrite', async transaction => {
			if (await transaction.get(connectionResetKey) === connectionResetVersion) return false;
			if (resetting()) throw new Error('Site reset in progress');
			await Promise.all([
				...Object.entries(connectionDefaults).map(([key, value]) => transaction.set(key, value)),
				transaction.set(connectionResetKey, connectionResetVersion)
			]);
			return true;
		});
		if (resetting()) return false;
		if (changed) {
			for (const [key, value] of Object.entries(connectionDefaults)) {
				try { legacyStorage?.()?.removeItem(key); } catch {}
				try { notify(key, value); } catch {}
			}
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
