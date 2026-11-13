import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { browserMessage, clickedPlace, launchPlace, createBrowsePlugin, installPlayBridge } from '../src/lib/roblox/browse.js';
import { ROBLOX_THEMES } from '../src/lib/roblox/themes.js';

const base = 'https://www.roblox.com/games/1818/Crossroads';

test('only explicit Roblox launch URLs launch; normal cards and lookalike hosts stay navigation', () => {
	assert.equal(launchPlace('/games/start?placeId=1818', base), '1818');
	assert.equal(launchPlace('roblox://placeId=1818', base), '1818');
	for (const url of ['/games/1818/Crossroads', 'https://roblox.com.evil.test/games/start?placeId=1818', 'https://token@www.roblox.com/games/start?placeId=1818', 'javascript:alert(1)', '/games/start?placeId=-1', '/games/start?placeId=9007199254740992']) assert.equal(launchPlace(url, base), null);
});

function fixture({ disabled = false, anchor = false, href = '/games/1818/Crossroads', play = true, cardId = null } = {}) {
	const metadata = { getAttribute: () => '1818' };
	const control = {
		closest: selector => selector.includes('[disabled]') ? (disabled ? {} : null) : cardId ? { getAttribute: () => cardId } : null,
		matches: selector => selector === 'a[href]' ? anchor : play,
		getAttribute: () => href
	};
	return { target: { closest: selector => selector === '#velora-community-link' ? null : control }, document: { querySelector: () => metadata } };
}

test('the live game-page metadata supplies the ID and gated buttons are left to Roblox', () => {
	const normal = fixture();
	assert.equal(clickedPlace(normal.target, normal.document, base), '1818');
	const card = fixture({ cardId: '142823291' });
	assert.equal(clickedPlace(card.target, card.document, base), '142823291');
	for (const f of [fixture({ disabled: true }), fixture({ anchor: true, play: false })]) assert.equal(clickedPlace(f.target, f.document, base), null);
});

test('Play is captured before the native-app launcher, with only the ID sent to the parent', () => {
	const sent = [];
	let listener;
	const f = fixture();
	installPlayBridge({ nonce: 'test-nonce', url: base }, { document: f.document, addEventListener(type, callback, capture) { assert.equal(type, 'click'); assert.equal(capture, true); listener = callback; }, parent: { postMessage: data => sent.push(data) } });
	let prevented = 0;
	listener({ target: f.target, button: 0, preventDefault() { prevented++; }, stopImmediatePropagation() { prevented++; } });
	assert.equal(prevented, 2);
	assert.deepEqual(sent, [{ type: 'velora:roblox-browse-ready', nonce: 'test-nonce' }, { type: 'velora:roblox-play', nonce: 'test-nonce', placeId: '1818' }]);
});

test('parent accepts only its Roblox frame, matching origin and per-frame nonce', () => {
	const frame = { contentWindow: {} };
	const event = { origin: 'https://velora.test', source: frame.contentWindow, data: { type: 'velora:roblox-play', nonce: 'test', placeId: '1818' } };
	assert.deepEqual(browserMessage(event, frame, event.origin, 'test'), { type: 'play', placeId: '1818' });
	for (const changed of [{ source: {} }, { origin: 'https://other.test' }, { data: { ...event.data, nonce: 'wrong' } }, { data: { ...event.data, placeId: '-1' } }]) assert.equal(browserMessage({ ...event, ...changed }, frame, 'https://velora.test', 'test'), null);
});

test('theme changes accept only supported choices from the current Roblox frame', () => {
	const frame = { contentWindow: {} };
	const event = { origin: 'https://velora.test', source: frame.contentWindow, data: { type: 'velora:roblox-theme', nonce: 'theme-test', theme: 'velora' } };
	assert.deepEqual(browserMessage(event, frame, event.origin, 'theme-test'), { type: 'theme', theme: 'velora' });
	for (const changed of [{ source: {} }, { origin: 'https://other.test' }, { data: { ...event.data, nonce: 'old-frame' } }, { data: { ...event.data, theme: 'unknown' } }, { data: { ...event.data, theme: null } }]) assert.equal(browserMessage({ ...event, ...changed }, frame, event.origin, 'theme-test'), null);
});

test('the community link leaves the proxy through a validated parent handoff', () => {
	const sent = [];
	let listener;
	installPlayBridge({ nonce: 'community-test', url: base }, { document: {}, addEventListener(_type, callback) { listener = callback; }, parent: { postMessage: data => sent.push(data) } });
	let prevented = 0;
	listener({ target: { closest: selector => selector === '#velora-community-link' ? {} : null }, button: 0, preventDefault() { prevented++; }, stopImmediatePropagation() { prevented++; } });
	assert.equal(prevented, 2);
	assert.deepEqual(sent.at(-1), { type: 'velora:roblox-discord', nonce: 'community-test' });
	const frame = { contentWindow: {} };
	const event = { source: frame.contentWindow, origin: 'https://velora.test', data: sent.at(-1) };
	assert.deepEqual(browserMessage(event, frame, event.origin, 'community-test'), { type: 'discord' });
	assert.equal(browserMessage({ ...event, source: {} }, frame, event.origin, 'community-test'), null);
});

test('frame plugin appends the handoff after rewritten Roblox HTML and leaves all other responses intact', async () => {
	let hook;
	class Managed { tap(_hook, callback) { hook = callback; } install() {} }
	createBrowsePlugin(Managed, 'test').install({ hooks: { fetch: { response: {} } } });
	const rewritten = new TextEncoder().encode('<html><head><script>/* Prism bootstrap */</script></head><body>Roblox</body></html>');
	const response = { body: new Response(rewritten).body, headers: new Headers({ 'content-type': 'text/html', 'content-length': String(rewritten.length) }), status: 200 };
	hook({ parsed: { url: new URL(base) }, request: { rawDestination: 'iframe' } }, { response });
	const text = await new Response(response.body).text();
	assert.ok(text.startsWith(new TextDecoder().decode(rewritten)));
	assert.ok(text.includes('data-velora-play-bridge'));
	assert.equal(response.headers.has('content-length'), false);
	for (const [url, destination, contentType] of [['https://example.com/', 'iframe', 'text/html'], [base, 'script', 'text/javascript'], [base, 'empty', 'application/json']]) {
		const unchanged = { body: rewritten, headers: new Headers({ 'content-type': contentType }), status: 200 };
		hook({ parsed: { url: new URL(url) }, request: { rawDestination: destination } }, { response: unchanged });
		assert.equal(unchanged.body, rewritten);
	}
});

test('the injected bridge stays self-contained after production minification', async () => {
	const bundled = await build({ entryPoints: ['src/lib/roblox/browse.js'], bundle: true, minify: true, format: 'iife', globalName: 'Bridge', write: false });
	const context = vm.createContext({ URL, URLSearchParams, TextEncoder, ReadableStream, TransformStream, Response });
	vm.runInContext(bundled.outputFiles[0].text, context);
	let hook;
	class Managed { tap(_hook, callback) { hook = callback; } install() {} }
	let preference, customTheme;
	context.Bridge.createBrowsePlugin(Managed, 'compiled-test', () => preference, () => customTheme).install({ hooks: { fetch: { response: {} } } });
	const injectedScript = async () => {
		const response = { body: '<html></html>', status: 200, headers: new Headers({ 'content-type': 'text/html' }) };
		hook({ parsed: { url: new URL(base) }, request: { rawDestination: 'iframe' } }, { response });
		return (await new Response(response.body).text()).match(/<script data-velora-play-bridge>([\s\S]*)<\/script>/)[1];
	};
	const sent = [];
	const f = fixture();
	const attributes = new Map(), colors = new Map(), classes = new Set();
	f.document.createElement = () => ({ textContent: '' });
	f.document.getElementById = () => null;
	f.document.querySelector = selector => selector.startsWith('#game-detail-meta-data') ? { getAttribute: () => '1818' } : null;
	f.document.head = { appendChild() {} };
	f.document.documentElement = { classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } }, style: { setProperty: (name, value) => colors.set(name, value) }, setAttribute: (name, value) => attributes.set(name, value) };
	let listener;
	context.window = { document: f.document, MutationObserver: class { observe() {} }, addEventListener(type, callback) { if (type === 'click') listener = callback; }, parent: { postMessage: message => sent.push(message) } };
	vm.runInContext(await injectedScript(), context);
	assert.equal(attributes.get('data-velblox-theme'), 'velora');
	assert.equal(classes.has('velblox-modern'), true);
	assert.equal(colors.get('--vb-accent'), '#d3e5b0');
	listener({ target: f.target, button: 0, preventDefault() {}, stopImmediatePropagation() {} });
	assert.equal(sent.at(-1).placeId, '1818');
	assert.equal(sent.at(-1).nonce, 'compiled-test');
	// Every new document uses the latest preference, rather than the value
	// captured when the proxy frame was first created.
	preference = 'classic';
	vm.runInContext(await injectedScript(), context);
	assert.equal(attributes.get('data-velblox-theme'), 'classic');
	assert.equal(classes.has('velblox-classic'), true);
	assert.equal(classes.has('velblox-modern'), false);
	preference = 'roblox';
	vm.runInContext(await injectedScript(), context);
	assert.equal(attributes.get('data-velblox-theme'), 'roblox');
	assert.equal(classes.has('velblox-classic'), false);
	assert.equal(classes.has('velblox-modern'), false);
	preference = 'custom';
	vm.runInContext(await injectedScript(), context);
	assert.equal(attributes.get('data-velblox-theme'), 'velora');
	customTheme = { name: 'Ocean </script> theme', colors: { ...ROBLOX_THEMES.find(item => item.id === 'light').colors, accent: '#0099aa' } };
	const customScript = await injectedScript();
	assert.equal(customScript.includes('</script> theme'), false);
	vm.runInContext(customScript, context);
	assert.equal(attributes.get('data-velblox-theme'), 'custom');
	assert.equal(attributes.get('data-velblox-scheme'), 'light');
	assert.equal(classes.has('velblox-modern'), true);
	assert.equal(colors.get('--vb-accent'), '#0099aa');
});
