import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { buildPortable } from '../scripts/build-portable.mjs';
import { loadSetting, saveSetting, onSettingChange } from '../src/lib/downloads/portable/settings.js';

// The route's SVG raw import is handled by Vite, so runtime response tests live
// in sites-runtime.test.mjs. The standalone artifact is inspected here.
test('the portable artifact bundles executable desktop code and all initial assets into one HTML document', async () => {
	const built = await buildPortable();
	const html = await readFile(built.output, 'utf8');
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
	assert.equal(scripts.length, 1);
	assert.doesNotThrow(() => new Script(scripts[0][1]));
	const document = html.replace(/<script>[\s\S]*?<\/script>/g, '');
	assert.match(document, /id="velora-root"/);
	assert.doesNotMatch(document, /<iframe\b|<script\b[^>]*src=|<link\b[^>]*href=/i);
	assert.doesNotMatch(html, /<!-- PORTABLE_(?:STYLE|SCRIPT) -->/);
	const css = [...document.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
	for (const url of css.matchAll(/url\(([^)]+)\)/g)) assert.match(url[1], /^["']?data:/);
	assert.match(scripts[0][1], /data:image\/jpeg;base64,/);
	assert.match(scripts[0][1], /Desktop runs from this file/);
	assert.match(scripts[0][1], /velorastudy\.s3\.us-east-2\.amazonaws\.com/);
	assert.ok(built.bytes < 20 * 1024 * 1024, 'download must fit the static asset size limit');
});

test('portable preferences stay usable when file storage is denied and notify local listeners', async () => {
	Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('File storage denied'); } });
	try {
		const changes = [];
		const unsubscribe = onSettingChange('desktopGlassStrength', value => changes.push(value));
		assert.equal(await loadSetting('desktopGlassStrength', 60), 60);
		await saveSetting('desktopGlassStrength', 75);
		assert.equal(await loadSetting('desktopGlassStrength', 60), 75);
		assert.deepEqual(changes, [75]);
		unsubscribe();
		await saveSetting('desktopGlassStrength', 30);
		assert.deepEqual(changes, [75]);
	} finally { delete globalThis.localStorage; }
});
