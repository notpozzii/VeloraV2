// File downloads have their own settings; browsers may deny file:// storage.
// Keep the desktop usable in memory when persistence isn't available.
const values = new Map();
const listeners = new Map();
const prefix = 'velora:portable:settings:';
export async function loadSetting(key, fallback) {
	if (values.has(key)) return values.get(key);
	try {
		const value = localStorage.getItem(prefix + key);
		if (value !== null) { const parsed = JSON.parse(value); values.set(key, parsed); return parsed ?? fallback; }
	} catch {}
	return fallback;
}
export async function saveSetting(key, value) {
	values.set(key, value);
	try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch {}
	for (const listener of listeners.get(key) || []) listener(value);
}
export function onSettingChange(key, listener) {
	if (!listeners.has(key)) listeners.set(key, new Set());
	listeners.get(key).add(listener);
	return () => listeners.get(key).delete(listener);
}
