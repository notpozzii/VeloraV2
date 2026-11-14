// Bookmarks and app shortcuts are addresses, rather than search queries.
export function normalizeWebUrl(raw) {
	if (typeof raw !== 'string') return null;
	const value = raw.trim();
	if (!value || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
	try {
		const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
		const host = url.hostname.replace(/\.$/, '');
		if (!host || !(host === 'localhost' || host.startsWith('[') ||
			(host.includes('.') && host.split('.').every(Boolean)))) return null;
		if (url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}
