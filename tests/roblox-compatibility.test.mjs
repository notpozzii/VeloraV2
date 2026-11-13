import test from 'node:test';
import assert from 'node:assert/strict';
import { robloxPlaybackSupport } from '../src/lib/roblox/compatibility.js';

const safari = () => ({
	isSecureContext: true, crossOriginIsolated: true,
	SharedArrayBuffer: function SharedArrayBuffer() {},
	WebTransport: function WebTransport() {},
	WebAssembly: { Suspending() {}, promising() {} },
	navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/625.2.8 Version/27.2 Safari/625.2.8' }
});

test('Safari with the required engine features is accepted without a Chromium identity', () => {
	assert.deepEqual(robloxPlaybackSupport(safari()), { supported: true, missing: [], message: '' });
});

test('older Safari receives an upgrade explanation only when playback is requested', () => {
	const host = safari();
	host.navigator.userAgent = host.navigator.userAgent.replace('27.2', '26.6');
	delete host.WebAssembly.Suspending;
	const result = robloxPlaybackSupport(host);
	assert.equal(result.supported, false);
	assert.deepEqual(result.missing, ['wasm-jspi']);
	assert.match(result.message, /Safari 27 or newer/);
	assert.match(result.message, /still browse and sign in/);
});

test('both JSPI APIs and WebTransport are required by the actual engine', () => {
	const host = safari();
	delete host.WebAssembly.promising;
	delete host.WebTransport;
	assert.deepEqual(robloxPlaybackSupport(host).missing, ['webtransport', 'wasm-jspi']);
});

test('unisolated embeds get a direct-tab remedy without blocking Roblox browsing', () => {
	const host = safari(); host.crossOriginIsolated = false;
	const result = robloxPlaybackSupport(host);
	assert.deepEqual(result.missing, ['shared-memory']);
	assert.match(result.message, /own browser tab/);
	host.isSecureContext = false;
	assert.match(robloxPlaybackSupport(host).message, /HTTPS/);
});
