export const GEFORCE_URL = 'https://play.geforcenow.com/mall/';

// Launch GeForce with Scramjet 2 and its direct Libcurl transport.
const GEFORCE_WISP = 'wss://galxy.it.com/jsonn/';

export function getGeForceLauncherUrl(customWisp = '', url = GEFORCE_URL) {
	const params = new URLSearchParams({
		url,
		type: 'prism',
		transport: 'libcurl',
		wisp: customWisp || GEFORCE_WISP,
		autoSW: 'true'
	});
	return `/api?${params.toString()}`;
}
