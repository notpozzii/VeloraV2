const descriptions = {
	1: 'Playback was interrupted',
	2: 'The video download failed',
	3: 'The downloaded video could not be decoded',
	4: 'The video source could not be opened'
};

export function mediaFailureDetails(media, origin) {
	if (!media.error || media.error.code === 1) return null;
	let source = 'No video source';
	try {
		const url = new URL(media.currentSrc);
		if (url.protocol === 'blob:') source = url.origin === origin ? 'Local video blob' : 'Video blob from another origin';
		else source = `${url.protocol.replace(':', '')} video`;
	} catch {}
	// A media decoder can include a signed URL in its message. Keep all URLs and
	// identifiers out of the visible report; only the browser's failure is useful.
	const detail = String(media.error.message || '')
		.replace(/\b(?:blob:|https?:\/\/)[^\s<>"']+/gi, '[video URL]')
		.slice(0, 240);
	return { code: media.error.code, description: descriptions[media.error.code] || 'Video playback failed', source, detail };
}

// Read through the unproxied parent's DOM getters. The website's URL wrappers
// intentionally show virtual URLs, which hide the source used by the decoder.
export function watchMediaFailures(frame, report, host = window) {
	const documentGetter = Object.getOwnPropertyDescriptor(host.HTMLIFrameElement.prototype, 'contentDocument').get;
	const getters = Object.fromEntries(['error', 'currentSrc'].map(key =>
		[key, Object.getOwnPropertyDescriptor(host.HTMLMediaElement.prototype, key).get]));
	const watched = new Map();
	let previous = '';
	function failure(video) {
		const details = mediaFailureDetails(Object.fromEntries(Object.entries(getters).map(([key, get]) => [key, get.call(video)])), host.location.origin);
		if (!details) return;
		const key = JSON.stringify(details);
		if (key !== previous) { previous = key; report(details); }
	}
	function scan() {
		const live = new Set();
		function visit(element, depth) {
			if (depth > 6) return;
			let doc;
			try { doc = documentGetter.call(element); } catch { return; }
			if (!doc || live.has(doc)) return;
			live.add(doc);
			if (!watched.has(doc)) {
				const listener = event => { if (event.target?.tagName === 'VIDEO' || event.target?.tagName === 'AUDIO') failure(event.target); };
				doc.addEventListener('error', listener, true);
				watched.set(doc, listener);
			}
			for (const video of doc.querySelectorAll('video,audio')) failure(video);
			for (const child of doc.querySelectorAll('iframe')) visit(child, depth + 1);
		}
		visit(frame, 0);
		for (const [doc, listener] of watched) if (!live.has(doc)) { doc.removeEventListener('error', listener, true); watched.delete(doc); }
	}
	const timer = host.setInterval(scan, 500);
	frame.addEventListener('load', scan);
	scan();
	return () => {
		host.clearInterval(timer);
		frame.removeEventListener('load', scan);
		for (const [doc, listener] of watched) doc.removeEventListener('error', listener, true);
	};
}
