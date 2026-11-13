export const PANIC_SETTING = 'panicPreferences';
export const defaultPanicPreferences = Object.freeze({
	enabled: true,
	url: 'https://www.google.com/',
	shortcut: Object.freeze({ code: 'Quote', ctrl: false, alt: false, shift: false, meta: false })
});

export function panicDestination(value) {
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text) return null;
	try {
		const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
		return ['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null;
	} catch { return null; }
}

export function normalizeShortcut(value) {
	if (!value || typeof value.code !== 'string' || !/^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Backquote|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Minus|Equal|Space|Pause|Insert|Delete|Home|End|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(value.code)) return null;
	return { code: value.code, ctrl: value.ctrl === true, alt: value.alt === true, shift: value.shift === true, meta: value.meta === true };
}

export function normalizePanicPreferences(value) {
	return {
		enabled: value?.enabled !== false,
		url: panicDestination(value?.url) || defaultPanicPreferences.url,
		shortcut: normalizeShortcut(value?.shortcut) || { ...defaultPanicPreferences.shortcut }
	};
}

export function shortcutFromEvent(event) {
	return normalizeShortcut({ code: event.code, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey });
}

export function shortcutLabel(shortcut) {
	const key = shortcut.code;
	const labels = { Backquote: '`', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
	return [shortcut.ctrl && 'Ctrl', shortcut.alt && 'Alt', shortcut.shift && 'Shift', shortcut.meta && '⌘', labels[key] || key.replace(/^(Key|Digit)/, '')].filter(Boolean).join(' + ');
}

export function matchesPanicKey(event, preferences) {
	if (!preferences.enabled || event.repeat || event.isComposing || event.defaultPrevented) return false;
	const target = event.target;
	if (target?.ownerDocument?.querySelector?.('[data-panic-recording="true"]')) return false;
	const key = preferences.shortcut;
	if (event.code !== key.code || !!event.ctrlKey !== key.ctrl || !!event.altKey !== key.alt || !!event.shiftKey !== key.shift || !!event.metaKey !== key.meta) return false;
	const path = event.composedPath?.() || [target];
	const typing = path.some(node => node?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName) || node?.getAttribute?.('role') === 'textbox');
	return !typing || key.ctrl || key.alt || key.meta || /^F\d+$/.test(key.code);
}
