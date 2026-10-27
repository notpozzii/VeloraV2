export const GEFORCE_URL = 'https://play.geforcenow.com/mall/';

// Keep GeForce on the engine that completes IMA ad playback, with raw libcurl
// so ad requests are not passed through optional Reflux plugins.
const GEFORCE_WISP = 'wss://system.pilotrights.com/jsonn/';

export function getGeForceLauncherUrl(customWisp = '', url = GEFORCE_URL) {
	const params = new URLSearchParams({
		url,
		type: 'glass',
		transport: 'libcurlRaw',
		wisp: customWisp || GEFORCE_WISP,
		autoSW: 'true'
	});
	return `/api?${params.toString()}`;
}
