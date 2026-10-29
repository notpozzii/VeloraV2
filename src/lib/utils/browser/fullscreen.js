export function fullscreenElement(doc) {
	return doc.fullscreenElement || doc.webkitFullscreenElement;
}

export async function requestElementFullscreen(element, { game = false } = {}) {
	if (typeof element?.requestFullscreen === 'function') {
		const options = { navigationUI: 'hide' };
		// Safari 26.4+ uses FullscreenOptions, rather than navigator.keyboard.
		if (game) options.keyboardLock = 'browser';
		try {
			return await element.requestFullscreen(options);
		} catch (error) {
			// Older implementations may reject this option. Never retry permission
			// or activation errors, or attempt to re-enter after the user exits.
			if (!game || error?.name !== 'NotSupportedError') throw error;
			return element.requestFullscreen({ navigationUI: 'hide' });
		}
	}
	if (typeof element?.webkitRequestFullscreen === 'function') {
		return element.webkitRequestFullscreen();
	}
	throw new Error('Full screen is unavailable in this browser context.');
}

export async function toggleElementFullscreen(element, doc = document, options) {
	if (fullscreenElement(doc)) {
		const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
		if (typeof exit === 'function') return exit.call(doc);
		throw new Error('Full screen is unavailable in this browser context.');
	}
	if (
		!element ||
		(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled) === false
	) {
		throw new Error(
			'Full screen is unavailable in this browser context.'
		);
	}
	await requestElementFullscreen(element, options);
}
