import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
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

test('the direct SVG contains the current desktop and its hosted assets are packaged', async () => {
	const built = await buildPortable();
	const svg = await readFile(built.svgOutput, 'utf8');
	assert.equal(svg, await readFile(new URL('../static/velora-direct.svg', import.meta.url), 'utf8'));
	assert.ok(!/<!-- PORTABLE_(?:STYLE|SCRIPT) -->/.test(svg), 'SVG build markers are replaced');
	const document = svg.replace(/<script\b[\s\S]*?<\/script>/g, '');
	assert.ok(!/<iframe\b/i.test(document), 'no hosted desktop wrapper');
	assert.match(svg, /velora-svg-body/);
	assert.match(svg, /desktop-top-controls/);
	assert.match(svg, /dock-compact-trigger/);
	const script = svg.match(/<script type="application\/ecmascript"><!\[CDATA\[([\s\S]*?)\]\]><\/script>/)?.[1];
	assert.ok(script, 'the desktop executes inside the SVG');
	assert.doesNotThrow(() => new Script(script.replaceAll(']]]]><![CDATA[>', ']]>')));
	const assets = [...new Set(svg.match(/https:\/\/velorastudy\.s3\.us-east-2\.amazonaws\.com\/portable\/assets\/[\w.-]+/g))];
	assert.ok(assets.length > 10, 'images remain compact hosted assets');
	for (const asset of assets) await access(new URL('../static' + new URL(asset).pathname, import.meta.url));
	assert.ok(built.svgBytes < 1024 * 1024, 'the direct SVG stays compact');
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
