import test from 'node:test';
import assert from 'node:assert/strict';
import { snapTarget } from '../src/lib/utils/window/snap.js';
import { toggleElementFullscreen } from '../src/lib/utils/browser/fullscreen.js';

test('snaps before the old 48px edge and releases without flickering', () => {
	assert.equal(snapTarget(100, 1200), 'left');
	assert.equal(snapTarget(1100, 1200), true);
	assert.equal(snapTarget(155, 1200, 'left'), 'left');
	assert.equal(snapTarget(180, 1200, 'left'), false);
	assert.equal(snapTarget(600, 1200), false);
	assert.equal(snapTarget(10, 390), false);
	assert.equal(snapTarget(200, 4000), false);
});
test('fullscreen requests the selected content with native browser UI hidden', async () => {
	let options;
	await toggleElementFullscreen(
		{
			requestFullscreen: async (value) => {
				options = value;
			}
		},
		{ fullscreenEnabled: true, fullscreenElement: null }
	);
	assert.deepEqual(options, { navigationUI: 'hide' });
});
test('fullscreen exits when already active and reports blocked or denied requests', async () => {
	let exited = false;
	await toggleElementFullscreen(null, {
		fullscreenElement: {},
		exitFullscreen: async () => {
			exited = true;
		}
	});
	assert.equal(exited, true);
	await assert.rejects(toggleElementFullscreen(null, { fullscreenEnabled: false }), /unavailable/);
	await assert.rejects(
		toggleElementFullscreen(
			{
				requestFullscreen: async () => {
					throw Error('denied');
				}
			},
			{}
		),
		/denied/
	);
});
