import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaFailureDetails, watchMediaFailures } from '../src/lib/utils/browser/media-failure.js';

test('media reports distinguish download, decode, and source failures without exposing signed URLs', () => {
	const detail = mediaFailureDetails({ error: { code: 4, message: 'Failed opening https://ads.example/video?token=secret and blob:https://ads.example/private-id' }, currentSrc: 'blob:https://velora.test/private-id' }, 'https://velora.test');
	assert.equal(detail.code, 4);
	assert.equal(detail.source, 'Local video blob');
	assert.doesNotMatch(JSON.stringify(detail), /secret|private-id|ads\.example/);
	assert.match(mediaFailureDetails({ error: { code: 2 }, currentSrc: 'https://ads.example/video?secret' }, '').description, /download/);
	assert.match(mediaFailureDetails({ error: { code: 3 }, currentSrc: '' }, '').description, /decoded/);
	assert.equal(mediaFailureDetails({ error: null }, ''), null);
	assert.equal(mediaFailureDetails({ error: { code: 1 } }, ''), null);
});

test('the monitor reads native decoder errors across nested ad frames and releases detached documents', () => {
	const docs = new WeakMap(), native = new WeakMap(), reports = [];
	class Frame extends EventTarget { get contentDocument() { return docs.get(this); } }
	class Media { get error() { return native.get(this).error; } get currentSrc() { return native.get(this).currentSrc; } }
	class Doc extends EventTarget {
		constructor(videos = [], frames = []) { super(); this.videos = videos; this.frames = frames; }
		querySelectorAll(selector) { return selector === 'iframe' ? this.frames : this.videos; }
	}
	const ad = new Frame(), root = new Frame(), video = new Media();
	// The proxy-facing property can hide the native decoder state.
	Object.defineProperty(video, 'error', { value: null });
	native.set(video, { error: { code: 4, message: 'DEMUXER_ERROR_COULD_NOT_OPEN' }, currentSrc: 'blob:https://upstream.test/id' });
	docs.set(ad, new Doc([video]));
	docs.set(root, new Doc([], [ad]));
	let poll, cleared = false;
	const stop = watchMediaFailures(root, report => reports.push(report), {
		HTMLIFrameElement: Frame, HTMLMediaElement: Media, location: { origin: 'https://velora.test' },
		setInterval(callback) { poll = callback; return 1; }, clearInterval(id) { assert.equal(id, 1); cleared = true; }
	});
	assert.equal(reports.length, 1);
	assert.equal(reports[0].source, 'Video blob from another origin');
	assert.match(reports[0].detail, /DEMUXER_ERROR/);
	poll();
	assert.equal(reports.length, 1, 'polling must not repeat the same alert');
	docs.set(root, new Doc());
	poll();
	stop();
	assert.equal(cleared, true);
});
