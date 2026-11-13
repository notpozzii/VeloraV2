export const ROBLOX_CUSTOM_THEME_KEY = 'velora:roblox-custom-theme:v1';

// Also serialized into the proxied document: keep helpers inside this function.
export function parseCustomTheme(value) {
	if (!value || typeof value !== 'object' || typeof value.name !== 'string' || value.name.length > 32 || !value.colors || typeof value.colors !== 'object') return null;
	const colors = {};
	for (const key of ['page', 'surface', 'header', 'text', 'accent', 'border']) {
		if (!Object.prototype.hasOwnProperty.call(value.colors, key) || typeof value.colors[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.colors[key])) return null;
		colors[key] = value.colors[key].toLowerCase();
	}
	const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
	const mix = (a, b, amount) => '#' + rgb(a).map((channel, i) => Math.round(channel * (1 - amount) + rgb(b)[i] * amount).toString(16).padStart(2, '0')).join('');
	const luminance = hex => rgb(hex).map(channel => {
		const s = channel / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	}).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
	const foreground = hex => (luminance(hex) + 0.05) / 0.05 >= 1.05 / (luminance(hex) + 0.05) ? '#000000' : '#ffffff';
	colors.raised = mix(colors.surface, colors.text, 0.08);
	colors.muted = mix(colors.text, colors.surface, 0.28);
	colors.nav = foreground(colors.header);
	colors.onAccent = foreground(colors.accent);
	colors.play = colors.accent;
	colors.onPlay = colors.onAccent;
	return { id: 'custom', name: value.name.trim() || 'My theme', description: 'Your own colors.', scheme: luminance(colors.page) > 0.179 ? 'light' : 'dark', colors };
}
