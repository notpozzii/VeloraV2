import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { normalizeWebUrl } from '../src/lib/utils/web-url.js';

test('saved addresses normalize domains while preserving paths, ports, queries and fragments', () => {
	for (const [input, expected] of [
		[' example.com ', 'https://example.com/'],
		['HTTP://Example.COM:8080/path?q=a%20b#part', 'http://example.com:8080/path?q=a%20b#part'],
		['example.com:443/path', 'https://example.com/path'],
		['localhost:5295/apps', 'https://localhost:5295/apps'],
		['https://[::1]/', 'https://[::1]/']
	]) assert.equal(normalizeWebUrl(input), expected);
});

test('empty, malformed and non-web addresses cannot become saved shortcuts', () => {
	for (const input of [null, undefined, 4, '', '  ', 'not a url', 'example', '.', 'example..com',
		'https://', 'ftp://example.com', 'javascript:alert(1)', 'data:text/html,hi',
		'https://user:password@example.com', 'https://exam\nple.com', 'https://example.com/bad path']) {
		assert.equal(normalizeWebUrl(input), null, String(input));
	}
});

const source = readFileSync(new URL('../src/routes/slate/+page.svelte', import.meta.url), 'utf8');
function fixture(overrides = {}) {
	const frame = { id: 1, url: null, displayUrl: 'https://example.com/' };
	const errors = [];
	const engines = [];
	const context = vm.createContext({
		URL, Error, normalizeWebUrl, activeFrame: frame, frames: [frame], inputFocused: true,
		settingsReady: Promise.resolve(), browserDestroyed: false, startupError: null,
		previewMode: false, letheEngine: 'sj2', searchEngine: 'google', car: 'libcurl', customWisp: '',
		bookmarkListOpen: true, inputEl: { blur() {} }, bookmarks: [], bookmarkMenu: true,
		bookmarkError: '', activeFrameURL: '', activeFrameTitle: '', activeFrameEngine: 'sj2',
		popupInterceptor: true, LastPopupIntState: true,
		search: value => value, isAutoConnection: () => false,
		async prepareBrowserEngine(engine) { engines.push(engine); return { engine: 'sj2' }; },
		tabFrames: { async get(id) { return { id }; } },
		prismEncode: (url, target) => `/prism/${target.id}/${encodeURIComponent(url)}`,
		async reportDesktopSearchError(error, request) { errors.push({ error, request }); },
		...overrides
	});
	for (const name of ['navigateTo', 'bookmarkSearch', 'addBookmark']) {
		const match = source.match(new RegExp(`\t(?:async )?function ${name}\\([\\s\\S]*?^\t}`, 'm'));
		assert.ok(match, `${name} is exercised from the browser component`);
		vm.runInContext(match[0], context);
	}
	return { context, frame, errors, engines };
}

test('invalid bookmark edits stay open; a valid edit saves its normalized address', () => {
	const { context } = fixture();
	context.addBookmark();
	assert.equal(context.bookmarks.length, 0);
	assert.equal(context.bookmarkMenu, true);
	assert.match(context.bookmarkError, /valid website/);
	context.activeFrameURL = ' example.com/path ';
	context.activeFrameTitle = '  Example  ';
	context.addBookmark();
	assert.equal(context.bookmarkMenu, false);
	assert.equal(context.bookmarks[0].url, 'https://example.com/path');
	assert.equal(context.bookmarks[0].title, 'Example');
});

test('bookmark startup failures are visible, release busy state and allow a successful retry', async () => {
	let attempts = 0;
	const failure = new Error('Failed to load /prism/prism.js');
	const f = fixture({ async prepareBrowserEngine() {
		if (++attempts === 1) throw failure;
		return { engine: 'sj2' };
	} });
	await f.context.bookmarkSearch('https://example.com/', 'sj2');
	assert.equal(f.context.bookmarkListOpen, false);
	assert.equal(f.frame.preparing, false);
	assert.equal(f.errors[0].error, failure);
	assert.equal(f.errors[0].request.query, 'https://example.com/');
	await f.context.bookmarkSearch('https://example.com/', 'sj2');
	assert.match(f.frame.url, /^\/prism\/1\//);
	assert.equal(f.frame.preparing, false);
});

test('legacy invalid bookmarks show an actionable error without launching a search', async () => {
	const f = fixture();
	await f.context.bookmarkSearch('', 'sj2');
	assert.equal(f.frame.url, null);
	assert.deepEqual(f.engines, []);
	assert.match(f.errors[0].error.message, /bookmark has an invalid address/);
});

test('bookmark engine choice is honored without changing the default engine', async () => {
	const f = fixture();
	await f.context.bookmarkSearch('example.com', 'uv');
	assert.deepEqual(f.engines, ['uv']);
	assert.equal(f.context.letheEngine, 'sj2');
});

test('closing a tab during startup cannot create a frame or navigate the closed tab', async () => {
	let release;
	const held = new Promise(resolve => { release = resolve; });
	const f = fixture({ prepareBrowserEngine: () => held,
		tabFrames: { get() { assert.fail('closed tabs must not get a new proxy frame'); } } });
	const pending = f.context.bookmarkSearch('example.com', 'sj2');
	await new Promise(resolve => setImmediate(resolve));
	f.context.frames = [];
	release({ engine: 'sj2' });
	await pending;
	assert.equal(f.frame.url, null);
	assert.equal(f.frame.preparing, false);
	assert.deepEqual(f.errors, []);
});

test('a late bookmark failure cannot replace the result of a newer navigation', async () => {
	let reject;
	const held = new Promise((_, fail) => { reject = fail; });
	const f = fixture({ prepareBrowserEngine: () => held });
	const pending = f.context.bookmarkSearch('example.com', 'sj2');
	await new Promise(resolve => setImmediate(resolve));
	f.frame.navigation++;
	f.frame.url = '/newer-page';
	reject(new Error('Old request failed'));
	await pending;
	assert.equal(f.frame.url, '/newer-page');
	assert.deepEqual(f.errors, []);
});
