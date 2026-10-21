import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { staticRoute } from '../src/lib/utils/static-route.js';

test('S3 HTML aliases resolve to existing app routes', () => {
	assert.equal(staticRoute('/index.html'), '/');
	assert.equal(staticRoute('/index.htm'), '/');
	assert.equal(staticRoute('/os.html'), '/os');
	assert.equal(staticRoute('/api/index.html'), '/api');
	assert.equal(staticRoute('/api'), '/api');
	assert.equal(staticRoute('/prism/session/page'), '/prism/session/page');
});

test('uploader creates exact S3 route objects and rejects invalid bucket input', {
	skip: !existsSync('build/s3/manifest.json')
}, () => {
	const temp = mkdtempSync(join(tmpdir(), 'velora-s3-upload-'));
	try {
		const log = join(temp, 'commands');
		writeFileSync(join(temp, 'aws'), '#!/usr/bin/env node\nrequire("node:fs").appendFileSync(process.env.VELORA_UPLOAD_TEST_LOG, JSON.stringify(process.argv.slice(2))+"\\n");\n', { mode: 0o755 });
		const env = { ...process.env, PATH: `${temp}:${process.env.PATH}`, VELORA_UPLOAD_TEST_LOG: log };
		assert.equal(spawnSync('bash', ['build/s3/upload-s3.sh', 'velorastudy'], { env }).status, 0);
		const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
		assert.ok(calls.some((args) => args.includes('s3://velorastudy/api') && args.includes('text/html')));
		assert.ok(calls.some((args) => args.includes('s3://velorastudy/slate') && args.includes('text/html')));
		assert.ok(calls.some((args) => args.includes('application/wasm')));
		assert.ok(calls.every((args) => !args.includes('--delete')));
		const count = calls.length;
		assert.notEqual(spawnSync('bash', ['build/s3/upload-s3.sh', 'bad/bucket'], { env }).status, 0);
		assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, count);
	} finally { rmSync(temp, { recursive: true, force: true }); }
});

// Run after npm run export:s3 to check the actual produced bundle.
test('export contains local app routes, required worker assets, and S3 aliases', {
	skip: !existsSync('build/s3/manifest.json')
}, () => {
	const root = 'build/s3/site';
	const manifest = JSON.parse(readFileSync('build/s3/manifest.json', 'utf8'));
	const shell = readFileSync(join(root, 'index.html'), 'utf8');
	assert.doesNotMatch(shell, /<iframe/i);
	assert.match(shell, /velora-bootstrap\.js/);
	assert.doesNotMatch(shell, /_app\/immutable\/entry\/start\./);
	assert.match(readFileSync(join(root, 'velora-app.html'), 'utf8'), /_app\/immutable\/entry\/start\./);
	assert.equal(readFileSync(join(root, 'test.html'), 'utf8'), readFileSync('static/test.html', 'utf8'));
	const upload = readFileSync('build/s3/upload-s3.sh', 'utf8');
	for (const route of ['/', '/os', '/slate', '/api', '/apps', '/settings', '/download']) {
		assert.ok(manifest.routes.includes(route), route);
		if (route !== '/') {
			assert.equal(readFileSync(join(root, `${route.slice(1)}.html`), 'utf8'), shell);
			assert.ok(upload.includes(`"$bucket_url${route}" --content-type text/html`), route);
		}
	}
	for (const asset of ['servy.js', 'prism/prism.sw.js', 'prism/prism.wasm',
		'poly/polygon.all.js', 'glass/glass.bundle.js', 'charon/worker.js',
		'libby/index.mjs', 'reflux/index.mjs', 'download/files/index.html', 'download/files/velora.svg']) {
		assert.ok(existsSync(join(root, asset)), asset);
	}
	for (const entry of readdirSync(join(root, '_app/immutable/entry'))) {
		assert.ok(existsSync(join(root, '_app/immutable/entry', entry)));
	}
	assert.ok(manifest.serverOnly.includes('/api/byod'));
});
