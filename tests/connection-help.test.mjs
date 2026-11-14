import test from 'node:test';
import assert from 'node:assert/strict';
import { isConnectionError, connectionSettingsUrl } from '../src/lib/utils/connection-help.js';

test('network and proxy failures offer connection defaults as a recovery step', () => {
	for (const message of ['Connection failed', 'Failed to connect to the experience',
		'Failed to fetch', 'The app connection timed out. Try again.',
		'Failed to load /prism/prism.js', 'All clients returned an invalid MessagePort.',
		'Wisp relay unavailable', 'WebSocket closed', 'Error Code: 279', 'HTTP 502']) {
		assert.equal(isConnectionError(message), true, message);
	}
	assert.equal(isConnectionError(new Error('The proxy connection failed.')), true);
	assert.equal(connectionSettingsUrl, '/settings#connection');
});

test('sign-in, invalid addresses and device failures do not suggest resetting network preferences', () => {
	for (const message of ['', null, undefined, 'Log in on Roblox, then press Play again.',
		'This bookmark has an invalid address.', 'Fullscreen is unavailable here.',
		'The Roblox engine encountered a memory error.', 'Could not enable shared memory.',
		'Roblox could not start its graphics engine on this browser.']) {
		assert.equal(isConnectionError(message), false, String(message));
	}
});
