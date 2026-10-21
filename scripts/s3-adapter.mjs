import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addBootstrap } from './s3-bootstrap.mjs';

/** Export the client app without a Worker or a remotely hosted UI iframe. */
export default function staticPackage() {
	return {
		name: 'velora-s3-package',
		async adapt(builder) {
			const output = 'build/s3/site';
			builder.rimraf('build/s3');
			builder.mkdirp(output);
			builder.writeClient(output);
			cpSync('src/lib/assets/learning-hub-splash.png', join(output, 'learning-hub-splash.png'));
			await builder.generateFallback(join(output, 'index.html'));
			const routes = builder.routes
				.filter((route) => route.page.methods.includes('GET'))
				.map((route) => route.id);
			if (routes.some((route) => /[\[\]()]/.test(route))) {
				throw new Error('S3 export needs explicit object names for dynamic page routes.');
			}
			for (const route of routes.filter((route) => route !== '/')) {
				const target = join(output, `${route.slice(1)}.html`);
				// Keep existing standalone files such as static/test.html intact.
				if (existsSync(target)) continue;
				mkdirSync(join(target, '..'), { recursive: true });
				cpSync(join(output, 'index.html'), target);
			}
			const downloads = join(output, 'download/files');
			mkdirSync(downloads, { recursive: true });
			for (const file of ['index.html', 'velora.svg']) {
				cpSync(`src/lib/downloads/${file}`, join(downloads, file));
			}
			const missingAssets = ['books/gmes.json', 'pyrite/index.html']
				.filter((asset) => !existsSync(join(output, asset)));
			for (const asset of missingAssets) builder.log.warn(`Optional app assets missing: static/${asset}`);
			const release = addBootstrap(output, routes);
			writeFileSync('build/s3/manifest.json', JSON.stringify({
				version: 1, routes, missingAssets, bootstrap: {
					release: release.version, compressedBytes: release.compressedBytes,
					installedBytes: release.installedBytes, manifest: '/velora-release.json'
				},
				serverOnly: ['/api/byod'],
				proxyWorker: '/servy.js',
				requires: ['HTTPS', 'A reachable Wisp server']
			}, null, 2) + '\n');
			builder.log.success('S3 app exported to build/s3/site');
		}
	};
}
