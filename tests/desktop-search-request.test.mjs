import test from 'node:test';
import assert from 'node:assert/strict';
import { requestBrowserSearch } from '../src/lib/utils/browser/desktop-search-request.js';

function host() {
	const listeners = new Set();
	return {
		location: { origin: 'http://127.0.0.1:5280' },
		addEventListener: (name, callback) => listeners.add(callback),
		removeEventListener: (name, callback) => listeners.delete(callback),
		emit: (event) => [...listeners].forEach((callback) => callback(event)),
		get listenerCount() {
			return listeners.size;
		}
	};
}

test('existing Browser receives the trimmed query, and only its matching acknowledgement confirms reuse', async () => {
	const parent = host();
	let sent;
	const frame = {
		postMessage(message, origin) {
			sent = { message, origin };
		}
	};
	const result = requestBrowserSearch(frame, '  cats & dogs  ', { host: parent });
	assert.equal(sent.origin, parent.location.origin);
	assert.equal(sent.message.query, 'cats & dogs');
	assert.equal(sent.message.type, 'velora:browser-search');
	const data = { type: 'velora:browser-search-accepted', requestId: sent.message.requestId };
	parent.emit({ source: {}, origin: parent.location.origin, data });
	parent.emit({ source: frame, origin: 'https://elsewhere.test', data });
	parent.emit({
		source: frame,
		origin: parent.location.origin,
		data: { ...data, requestId: 'wrong' }
	});
	assert.equal(parent.listenerCount, 1);
	parent.emit({ source: frame, origin: parent.location.origin, data });
	assert.equal(await result, true);
	assert.equal(parent.listenerCount, 0);
});

test('unready and unavailable Browser frames fall back without leaving listeners behind', async () => {
	const parent = host();
	assert.equal(
		await requestBrowserSearch({ postMessage() {} }, 'example.com', { host: parent, timeout: 1 }),
		false
	);
	assert.equal(parent.listenerCount, 0);
	assert.equal(
		await requestBrowserSearch(
			{
				postMessage() {
					throw Error('closed');
				}
			},
			'example.com',
			{ host: parent }
		),
		false
	);
	assert.equal(parent.listenerCount, 0);
});

test('empty input and missing targets never send a navigation request', async () => {
	const parent = host();
	const frame = {
		postMessage() {
			assert.fail('Should not send');
		}
	};
	assert.equal(await requestBrowserSearch(frame, '  ', { host: parent }), false);
	assert.equal(await requestBrowserSearch(null, 'example.com', { host: parent }), false);
	assert.equal(parent.listenerCount, 0);
});
