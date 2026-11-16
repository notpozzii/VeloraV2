import { preferencesDefaults, preferencesResetKey, preferencesResetVersion } from '../../utils/preferences-defaults.js';
// File downloads have their own settings; browsers may deny file:// storage.
// Keep the desktop usable in memory when persistence isn't available.
const values = new Map();
const listeners = new Map();
const prefix = 'velora:portable:settings:';
function resetPreferencesOnce() {
 if (values.get(preferencesResetKey) === preferencesResetVersion) return;
 try {
  if (localStorage.getItem(prefix + preferencesResetKey) === preferencesResetVersion) {
   values.set(preferencesResetKey, preferencesResetVersion);
   return;
  }
 } catch {}
 // Only preference keys in this file's namespace; saved content stays intact.
 for (const [key, value] of Object.entries(preferencesDefaults)) values.set(key, structuredClone(value));
 values.set(preferencesResetKey, preferencesResetVersion);
 try {
  for (const [key, value] of Object.entries(preferencesDefaults)) localStorage.setItem(prefix + key, JSON.stringify(value));
  localStorage.setItem(prefix + preferencesResetKey, preferencesResetVersion);
 } catch {}
}
export async function loadSetting(key, fallback) {
 resetPreferencesOnce();
	if (values.has(key)) return values.get(key);
	try {
		const value = localStorage.getItem(prefix + key);
		if (value !== null) { const parsed = JSON.parse(value); values.set(key, parsed); return parsed ?? fallback; }
	} catch {}
	return fallback;
}
export async function saveSetting(key, value) {
	resetPreferencesOnce();
	values.set(key, value);
	try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch {}
	for (const listener of listeners.get(key) || []) listener(value);
}
export function onSettingChange(key, listener) {
	if (!listeners.has(key)) listeners.set(key, new Set());
	listeners.get(key).add(listener);
	return () => listeners.get(key).delete(listener);
}
