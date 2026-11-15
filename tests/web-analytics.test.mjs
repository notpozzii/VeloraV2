import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsTagFor, startWebAnalytics } from '../src/lib/utils/web-analytics.js';

function browser(hostname = 'english.mathrightnow.org') {
	const scripts = [];
	const host = {
		location: { hostname, protocol: 'https:' },
		document: {
			contentType: 'text/html',
			querySelector: () => scripts[0] || null,
			createElement: () => ({
				attributes: {}, listeners: {},
				setAttribute(name, value) { this.attributes[name] = value; },
				addEventListener(name, listener) { this.listeners[name] = listener; },
				remove() { scripts.splice(scripts.indexOf(this), 1); }
			}),
			head: { appendChild(script) { scripts.push(script); } }
		}
	};
	host.top = host;
	return { host, scripts };
}

test('hostnames use their registered site tags without matching other copies or inherited keys', () => {
	assert.equal(analyticsTagFor('ENGLISH.MATHRIGHTNOW.ORG'), analyticsTagFor('mathrightnow.org'));
	assert.equal(analyticsTagFor('cloud.schoolcity.cc'), analyticsTagFor('schoolcity.cc'));
	for (const hostname of ['localhost', 'cdn.jsdelivr.net', 'other.chatgpt.site', 'evilmathrightnow.org', 'schoolcity.cc.example.com', '__proto__']) {
		assert.equal(analyticsTagFor(hostname), null, hostname);
	}
});

test('a hosted desktop loads one non-blocking Cloudflare tag with only its public token', () => {
	const { host, scripts } = browser();
	assert.equal(startWebAnalytics(host), true);
	assert.equal(startWebAnalytics(host), false);
	assert.equal(scripts.length, 1);
	assert.equal(scripts[0].type, 'module');
	assert.equal(scripts[0].src, 'https://static.cloudflareinsights.com/beacon.min.js');
	assert.deepEqual(JSON.parse(scripts[0].attributes['data-cf-beacon']), { token: analyticsTagFor(host.location.hostname) });
});

test('embedded apps, local files, SVG documents and unregistered hosts send no analytics', () => {
	for (const change of [
		host => { host.top = {}; },
		host => { host.location.protocol = 'file:'; },
		host => { host.location.hostname = 'localhost'; },
		host => { host.document.contentType = 'image/svg+xml'; }
	]) {
		const { host, scripts } = browser();
		change(host);
		assert.equal(startWebAnalytics(host), false);
		assert.equal(scripts.length, 0);
	}
});

test('a blocked analytics script is removable and analytics exceptions do not break startup', () => {
	const { host, scripts } = browser();
	startWebAnalytics(host);
	scripts[0].listeners.error();
	assert.equal(scripts.length, 0);
	host.document.createElement = () => { throw new Error('Blocked'); };
	assert.equal(startWebAnalytics(host), false);
	assert.equal(startWebAnalytics(undefined), false);
});
