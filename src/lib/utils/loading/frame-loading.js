// Observe navigation without changing the frame's URL, history, or network requests.
// Ignore the initial about:blank load: proxy startup may still be preparing its URL.
export function frameLoading(frame, onchange) {
	let disposed = false;
	let childWindow;
	let loading = false;
	const emit = (value) => {
		if (disposed || loading === value) return;
		loading = value;
		onchange(value);
	};
	const hasSource = () => {
		const src = frame.getAttribute('src');
		return Boolean(frame.hasAttribute('srcdoc') || (src && src !== 'about:blank'));
	};
	const begin = () => {
		if (hasSource()) emit(true);
	};
	const detach = () => {
		try {
			childWindow?.removeEventListener('pagehide', begin);
			childWindow?.removeEventListener('pageshow', restored);
		} catch {}
		childWindow = undefined;
	};
	const loaded = () => {
		if (!hasSource()) return;
		// This local document only establishes iframe control; the target app is
		// still loading and must dismiss the rocket with its own load event.
		try {
			if (new URL(frame.getAttribute('src'), 'https://velora.invalid').pathname === '/proxy-frame.html') return;
		} catch {}
		try {
			if (frame.contentWindow.location.href === 'about:blank') return;
		} catch {}
		// A real load may finish before the action's MutationObserver sees the src.
		loading = true;
		emit(false);
		detach();
		try {
			childWindow = frame.contentWindow;
			childWindow.addEventListener('pagehide', begin);
			childWindow.addEventListener('pageshow', restored);
		} catch {}
	};
	const restored = (event) => {
		if (event.persisted) loaded();
	};
	const failed = () => {
		loading = true;
		emit(false);
	};
	const observer = new MutationObserver(() => {
		if (hasSource()) begin();
		else {
			detach();
			emit(false);
		}
	});
	observer.observe(frame, { attributes: true, attributeFilter: ['src', 'srcdoc'] });
	frame.addEventListener('load', loaded);
	frame.addEventListener('error', failed);
	begin();
	return {
		destroy() {
			disposed = true;
			observer.disconnect();
			detach();
			frame.removeEventListener('load', loaded);
			frame.removeEventListener('error', failed);
		}
	};
}
