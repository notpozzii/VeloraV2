import { fullscreenElement } from './fullscreen.js';

// Scoped to a GeForce frame. Safari's lock must be requested at the original
// fullscreen call, while the user's click still has activation.
export function installGameFullscreen(frame) {
	let removeDocument = () => {};
	function attach() {
		removeDocument();
		removeDocument = () => {};
		try {
			const win = frame.contentWindow;
			if (typeof win.navigator.keyboard?.lock === 'function') return;
			const doc = win.document;
			const proto = win.Element.prototype;
			const descriptor = Object.getOwnPropertyDescriptor(proto, 'requestFullscreen');
			const native = descriptor?.value;
			if (typeof native !== 'function' || !descriptor.configurable) return;
			let locked = false;
			async function requestFullscreen(options) {
				try {
					const result = await native.call(this, { ...options, keyboardLock: 'browser' });
					locked = Boolean(fullscreenElement(doc));
					return result;
				} catch (error) {
					if (error?.name !== 'NotSupportedError') throw error;
					locked = false;
					const fallback = { ...options };
					delete fallback.keyboardLock;
					return native.call(this, fallback);
				}
			}
			function onKey(event) {
				// Keep the real event available to the game; Safari retains its
				// native long-Esc escape hatch. Do not synthesize or stop input.
				if (locked && fullscreenElement(doc) && event.key === 'Escape') event.preventDefault();
			}
			Object.defineProperty(proto, 'requestFullscreen', { ...descriptor, value: requestFullscreen });
			doc.addEventListener('keydown', onKey, true);
			removeDocument = () => {
				doc.removeEventListener('keydown', onKey, true);
				if (proto.requestFullscreen === requestFullscreen) Object.defineProperty(proto, 'requestFullscreen', descriptor);
			};
		} catch {
			// A redirected cross-origin document is left to the browser.
		}
	}
	frame.addEventListener('load', attach);
	attach();
	return () => {
		frame.removeEventListener('load', attach);
		removeDocument();
	};
}
