const pendingScripts = new Map();

export function loadScript(src) {
	if (pendingScripts.has(src)) return pendingScripts.get(src);
	const pending = new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[data-mod="${src}"]`);
		if (existing) {
			resolve();
			return;
		}

		const s = document.createElement('script');
		s.src = src;
		s.dataset.mod = src;
		s.onload = () => resolve();
		s.onerror = () => {
			s.remove();
			reject(new Error(`Failed to load ${src}`));
		};
		document.head.appendChild(s);
	});
	pendingScripts.set(src, pending);
	pending.catch(() => { if (pendingScripts.get(src) === pending) pendingScripts.delete(src); });
	return pending;
}

export async function loadScriptsSequential(srcs) {
	for (const src of srcs) {
		await loadScript(src);
	}
}
