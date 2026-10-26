export const GEFORCE_URL = 'https://play.geforcenow.com/mall/';

// Match the working Hydra setup for GeForce, while honoring a custom relay.
const GEFORCE_WISP = 'wss://system.pilotrights.com/jsonn/';

export function getGeForceLauncherUrl(customWisp = '', url = GEFORCE_URL) {
	const params = new URLSearchParams({
		url,
		type: 'prism',
		transport: 'libcurlRaw',
		wisp: customWisp || GEFORCE_WISP,
		autoSW: 'true'
	});
	return `/api?${params.toString()}`;
}
