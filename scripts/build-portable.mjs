import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let pending;
export function buildPortable() {
	return pending ??= generate();
}
async function compileDesktop(assetLoader) {
	const css = new Map();
	const result = await build({
		absWorkingDir: root,
		entryPoints: ['src/lib/downloads/portable/main.js'],
		bundle: true, write: false, outfile: 'portable.js', format: 'iife',
		platform: 'browser', conditions: ['browser'], target: 'es2022', minify: true, legalComments: 'none',
		...(assetLoader === 'file' ? { publicPath: 'https://velorastudy.s3.us-east-2.amazonaws.com/portable/assets/', assetNames: '[name]-[hash]' } : {}),
		alias: { '$lib': resolve(root, 'src/lib'), '$app/environment': resolve(root, 'src/lib/downloads/portable/environment.js'),
			'$lib/utils/localspace.js': resolve(root, 'src/lib/downloads/portable/settings.js'),
			'$lib/utils/cloak.js': resolve(root, 'src/lib/downloads/portable/startup.js') },
		loader: Object.fromEntries(['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'otf', 'ttf', 'woff', 'woff2'].map(type => [`.${type}`, assetLoader])),
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
	return { script, style, assets: result.outputFiles.filter(file => !/\.(?:js|css)$/.test(file.path)) };
}
function cdata(value) {
	return '<![CDATA[' + value.replaceAll(']]>', ']]]]><![CDATA[>') + ']]>';
}
async function generate() {
	const { script, style } = await compileDesktop('dataurl');
	const template = await readFile(resolve(root, 'src/lib/downloads/index.html'), 'utf8');
	const html = template.replace('<!-- PORTABLE_STYLE -->', () => `<style>${style}</style>`).replace('<!-- PORTABLE_SCRIPT -->', () => `<script>${script}</script>`);
	const output = resolve(root, 'static/portable/index.html');
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, html);

	// The SVG runs the same desktop code. Keep its images hosted to preserve
	// the smaller direct SVG download instead of embedding megabytes of media.
	const compact = await compileDesktop('file');
	const assets = resolve(root, 'static/portable/assets');
	await mkdir(assets, { recursive: true });
	for (const asset of compact.assets) await writeFile(resolve(assets, basename(asset.path)), asset.contents);
	const adapter = await readFile(resolve(root, 'src/lib/downloads/portable/svg-document.js'), 'utf8');
	const svgTemplate = await readFile(resolve(root, 'src/lib/downloads/velora.svg'), 'utf8');
	const svg = svgTemplate
		.replace('<!-- PORTABLE_STYLE -->', () => `<style>${cdata(styleForSvg(compact.style))}</style>`)
		.replace('<!-- PORTABLE_SCRIPT -->', () => `<script type="application/ecmascript">${cdata(adapter + '\n' + compact.script)}</script>`);
	const svgOutput = resolve(root, 'static/portable/velora.svg');
	await writeFile(svgOutput, svg);
	await writeFile(resolve(root, 'static/velora-direct.svg'), svg);
	return { output, svgOutput, bytes: Buffer.byteLength(html), svgBytes: Buffer.byteLength(svg) };
}
function styleForSvg(style) {
	return style + 'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#17221c}#portable-startup{position:fixed;inset:0;display:grid;place-items:center;color:#e8efdf;font:16px system-ui}';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await buildPortable());
