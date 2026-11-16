import { resolveRelays } from '../../lethe/relay-config.js';

export const GEFORCE_URL = 'https://play.geforcenow.com/mall/';

// GeForce ads need UV's cross-frame media blob fix. Use direct Libcurl so
// optional request-filter plugins do not block the ad player or its downloads.

export function getGeForceLauncherUrl(customWisp = '', url = GEFORCE_URL, backupWisp = '') {
	const params = new URLSearchParams({
		url,
		type: 'glass',
		transport: 'libcurlRaw',
		wisp: resolveRelays(customWisp, backupWisp).main,
		backupWisp: resolveRelays(customWisp, backupWisp).backup,
		autoSW: 'true'
	});
	return `/api?${params.toString()}`;
}
