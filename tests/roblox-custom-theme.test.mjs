import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomTheme } from '../src/lib/roblox/custom-theme.js';
import { ROBLOX_THEMES } from '../src/lib/roblox/themes.js';
import { browserMessage } from '../src/lib/roblox/browse.js';

const draft = () => ({ name: ' Midnight ', colors: { ...ROBLOX_THEMES.find(theme => theme.id === 'velora').colors, accent: '#AABBCC' } });

test('custom themes normalize six editable colors and derive the remaining palette', () => {
	const theme = parseCustomTheme(draft());
	assert.equal(theme.id, 'custom');
	assert.equal(theme.name, 'Midnight');
	assert.equal(theme.scheme, 'dark');
	assert.equal(theme.colors.accent, '#aabbcc');
	assert.equal(theme.colors.onAccent, '#000000');
	assert.equal(theme.colors.nav, '#ffffff');
	assert.equal(theme.colors.play, theme.colors.accent);
	assert.equal(theme.colors.onPlay, theme.colors.onAccent);
	assert.deepEqual(parseCustomTheme(JSON.parse(JSON.stringify(theme))), theme);
	const light = draft(); light.colors.page = '#ffffff'; light.colors.header = '#ffffff'; light.colors.accent = '#000000';
	assert.equal(parseCustomTheme(light).scheme, 'light');
	assert.equal(parseCustomTheme(light).colors.nav, '#000000');
	assert.equal(parseCustomTheme(light).colors.onAccent, '#ffffff');
});

test('malformed or injected colors cannot become CSS; extra palette keys are discarded', () => {
	for (const value of [null, [], {}, { colors: {} }, { ...draft(), name: 'x'.repeat(33) }, { ...draft(), colors: null }]) assert.equal(parseCustomTheme(value), null);
	for (const color of ['red', '#fff', '#12345678', 'url(https://other.test)', '#fff;display:none', '', 12]) {
		const value = draft(); value.colors.page = color;
		assert.equal(parseCustomTheme(value), null);
	}
	const missing = draft(); delete missing.colors.border;
	assert.equal(parseCustomTheme(missing), null);
	const inherited = draft(); inherited.colors = Object.create(inherited.colors);
	assert.equal(parseCustomTheme(inherited), null);
	const extra = draft(); extra.colors.evil = 'url(https://other.test)'; extra.colors.nav = '#ff0000';
	assert.equal('evil' in parseCustomTheme(extra).colors, false);
	assert.equal(parseCustomTheme(extra).colors.nav, '#ffffff');
});

test('custom themes only reach storage through the active frame, origin and nonce', () => {
	const frame = { contentWindow: {} };
	const event = { source: frame.contentWindow, origin: 'https://velora.test', data: { type: 'velora:roblox-custom-theme', nonce: 'custom-test', customTheme: draft() } };
	assert.deepEqual(browserMessage(event, frame, event.origin, 'custom-test'), { type: 'custom-theme', customTheme: parseCustomTheme(draft()) });
	for (const changed of [{ source: {} }, { origin: 'https://other.test' }, { data: { ...event.data, nonce: 'old' } }, { data: { ...event.data, customTheme: { colors: {} } } }]) assert.equal(browserMessage({ ...event, ...changed }, frame, event.origin, 'custom-test'), null);
});
