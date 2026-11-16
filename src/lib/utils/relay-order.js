const migrationKey = 'velora:relay-order:galxy-first:v1';

// Older saved launchers explicitly named our VPS when it was the primary.
// Those should follow the new order; unrelated custom servers keep working.
export function normalizeRelayPreference(value) {
	if (!value) return '';
	try {
		const url = new URL(value);
		if (url.protocol === 'wss:' && !url.port && ['relay.velora.uno', '216.128.143.160'].includes(url.hostname) &&
			url.pathname.replace(/\/$/, '') === '/wisp') return '';
	} catch {}
	return value;
}

export function createRelayOrderMigration({ store, legacyStorage, sessionStorage, lock, resetting = () => false, notify = () => {} }) {
	let pending;
	return {
		ensure() {
			return pending ??= (async () => {
				if (!store || resetting()) return false;
				try {
					const work = () => store.runTransaction('readwrite', async transaction => {
						if (await transaction.get(migrationKey) === true) return false;
						let value = await transaction.get('customWisp');
						if (value == null) {
							try { value = legacyStorage?.()?.getItem('customWisp'); } catch {}
						}
						if (resetting()) throw new Error('Site reset in progress');
						const changed = !!value && normalizeRelayPreference(value) !== value;
						if (changed) await transaction.set('customWisp', '');
						await transaction.set(migrationKey, true);
						return changed;
					});
					const changed = await (lock ? lock(work) : work());
					if (resetting()) return false;
					if (changed) {
						try { legacyStorage?.()?.removeItem('customWisp'); } catch {}
						try { sessionStorage?.()?.removeItem('velora:auto-connections:v1'); } catch {}
						try { notify('customWisp', ''); } catch {}
					}
					return true;
				} catch { return false; }
			})();
		}
	};
}
