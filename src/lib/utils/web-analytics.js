// Public Cloudflare Web Analytics site tags, not account API credentials.
// Each deployment uses the tag registered for its hostname.
export const analyticsTags = Object.freeze({
	'mathrightnow.org': '5478e855bb724635ae1efade80babc3c',
	'english.mathrightnow.org': '5478e855bb724635ae1efade80babc3c',
	'schoolcity.cc': '423e3e892025451daa369d3d85fbf133',
	'cloud.schoolcity.cc': '423e3e892025451daa369d3d85fbf133',
	'formative.icu': 'cb9d7040033b43fabb8122ab94b91fc6',
	'velora.notpozzi.chatgpt.site': '33289f8b78f24835bbb2e8322dc4b300',
	'velorastudy.s3.us-east-2.amazonaws.com': 'fcdae9e115824ac8b549db71c9425988',
	'velorav2.pozzi-pozzi.workers.dev': 'd51087f1427b43c9a999996acec67fcc'
});

export function analyticsTagFor(hostname) {
	const key = String(hostname || '').toLowerCase();
	return Object.hasOwn(analyticsTags, key) ? analyticsTags[key] : null;
}

export function startWebAnalytics(host) {
	try {
		// Count the hosted Velora shell once. Embedded apps, local files, and
		// unregistered copies must not create extra visits or report proxy pages.
		if (!host || host.top !== host || host.location.protocol !== 'https:') return false;
		const token = analyticsTagFor(host.location.hostname);
		const doc = host.document;
		if (!token || doc.contentType !== 'text/html' || doc.querySelector('script[data-velora-analytics]')) return false;
		const script = doc.createElement('script');
		script.type = 'module';
		script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
		script.setAttribute('data-cf-beacon', JSON.stringify({ token }));
		script.setAttribute('data-velora-analytics', '');
		script.addEventListener('error', () => script.remove(), { once: true });
		doc.head.appendChild(script);
		return true;
	} catch {
		// Analytics must never prevent the desktop or a game from opening.
		return false;
	}
}
