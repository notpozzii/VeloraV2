const LAUNCHER_ORIGINS = new Set([
	'https://mathrightnow.org',
	'https://english.mathrightnow.org',
	'https://cloud.schoolcity.cc',
	'https://schoolcity.cc',
	'https://formative.icu',
	'https://velora.notpozzi.chatgpt.site'
]);

function challenge(win) {
	try {
		if (win.parent === win) return null;
		const url = new URL(win.location.href);
		if (!['/', '/os', '/os/'].includes(url.pathname)) return null;
		const nonce = url.searchParams.get('velora_launch_probe');
		const parent = url.searchParams.get('velora_launch_parent');
		if (!/^[a-f0-9]{32}$/.test(nonce || '') || !LAUNCHER_ORIGINS.has(parent)) return null;
		return { nonce, parent, path: url.pathname };
	} catch {
		return null;
	}
}

export function isLauncherProbe(win) {
	return Boolean(challenge(win));
}

// Called only after the desktop module has loaded and its DOM has mounted.
export function notifyLauncherReady(win) {
	const probe = challenge(win);
	if (!probe || !win.document.querySelector('.velora-desktop')) return false;
	try {
		win.parent.postMessage({
			type: 'velora:launcher-ready', version: 1,
			nonce: probe.nonce, path: probe.path
		}, probe.parent);
		return true;
	} catch {
		return false;
	}
}
