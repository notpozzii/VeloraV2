import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let pending;
export function buildPortable() {
	return pending ??= generate();
}
async function generate() {
	const css = new Map();
	const result = await build({
		absWorkingDir: root,
		entryPoints: ['src/lib/downloads/portable/main.js'],
		bundle: true, write: false, outfile: 'portable.js', format: 'iife',
		platform: 'browser', conditions: ['browser'], target: 'es2022', minify: true, legalComments: 'none',
		alias: { '$lib': resolve(root, 'src/lib'), '$app/environment': resolve(root, 'src/lib/downloads/portable/environment.js'),
			'$lib/utils/localspace.js': resolve(root, 'src/lib/downloads/portable/settings.js'),
			'$lib/utils/cloak.js': resolve(root, 'src/lib/downloads/portable/startup.js') },
		loader: Object.fromEntries(['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'otf', 'ttf', 'woff', 'woff2'].map(type => [`.${type}`, 'dataurl'])),
		plugins: [{ name: 'portable-svelte', setup(bundle) {
			bundle.onLoad({ filter: /\.svelte$/, namespace: 'file' }, async ({ path }) => {
				const source = await readFile(path, 'utf8');
				const compiled = compile(source, { filename: path, generate: 'client', css: 'external', runes: true, dev: false });
				const id = `portable-css:${path}`;
				if (compiled.css?.code) css.set(id, compiled.css.code);
				return { contents: compiled.js.code + (compiled.css?.code ? `\nimport ${JSON.stringify(id)};` : ''), loader: 'js', resolveDir: dirname(path) };
			});
			bundle.onResolve({ filter: /^portable-css:/ }, args => ({ path: args.path, namespace: 'portable-css' }));
			bundle.onLoad({ filter: /.*/, namespace: 'portable-css' }, args => ({ contents: css.get(args.path), loader: 'css', resolveDir: root }));
			bundle.onLoad({ filter: /curated-wallpapers\.json$/ }, async ({ path }) => {
				const entries = JSON.parse(await readFile(path, 'utf8'));
				for (const entry of entries) for (const key of ['src', 'thumbnail']) entry[key] = new URL(entry[key], 'https://velorastudy.s3.us-east-2.amazonaws.com').href;
				return { contents: JSON.stringify(entries), loader: 'json' };
			});
		} }]
	});
	const script = result.outputFiles.find(file => file.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
	const style = result.outputFiles.find(file => file.path.endsWith('.css')).text.replace(/<\/style/gi, '<\\/style');
	const template = await readFile(resolve(root, 'src/lib/downloads/index.html'), 'utf8');
	const html = template.replace('<!-- PORTABLE_STYLE -->', `<style>${style}</style>`).replace('<!-- PORTABLE_SCRIPT -->', `<script>${script}</script>`);
	const output = resolve(root, 'static/portable/index.html');
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, html);
	return { output, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await buildPortable());
