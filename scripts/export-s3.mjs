import { cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
function run(command, args, options = {}) {
	const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, ['scripts/copy-browser-assets.mjs']);
run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
	env: { ...process.env, VELORA_S3_EXPORT: '1', VITE_VELORA_S3: '1' }
});
const manifest = JSON.parse(readFileSync('build/s3/manifest.json', 'utf8'));
// Exact /api, /slate, etc. keys let existing iframe URLs work on S3's REST host.
// These aliases are uploaded as HTML, even though the keys lack an extension.
const aliases = manifest.routes.filter((route) => route !== '/').map((route) =>
	`aws s3 cp "$package_dir/site/index.html" "$bucket_url${route}" --content-type text/html --cache-control no-cache`
).join('\n');
writeFileSync('build/s3/upload-s3.sh', `#!/usr/bin/env bash
set -euo pipefail
if [[ $# != 1 || ! "$1" =~ ^[a-z0-9][a-z0-9.-]+[a-z0-9]$ ]]; then
  echo "Usage: bash upload-s3.sh YOUR_BUCKET_NAME" >&2
  exit 1
fi
package_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
bucket_url="s3://$1"
aws s3 sync "$package_dir/site/" "$bucket_url/" --cache-control no-cache
# Bundles are gzip files decoded by the downloader, not HTTP content-encoding.
aws s3 cp "$package_dir/site/" "$bucket_url/" --recursive --exclude '*' --include 'velora-bundle.*.gz' --content-type application/octet-stream --cache-control 'public,max-age=31536000,immutable'
# Ensure JavaScript modules and WASM get browser-compatible MIME types.
aws s3 cp "$package_dir/site/" "$bucket_url/" --recursive --exclude '*' --include '*.mjs' --content-type application/javascript --cache-control no-cache
aws s3 cp "$package_dir/site/" "$bucket_url/" --recursive --exclude '*' --include '*.wasm' --content-type application/wasm --cache-control no-cache
# These worker imports carry a release hash in their query string.
for asset in velora-static-worker.js glass/glass.bundle.js glass/glass.config.js glass/glass.sw.js poly/polygon.all.js prism/prism.sw.js; do
  aws s3 cp "$package_dir/site/$asset" "$bucket_url/$asset" --content-type application/javascript --cache-control 'public,max-age=31536000,immutable'
done
${aliases}
echo "Uploaded. Open your bucket's HTTPS object URL ending in /index.html."
`);
cpSync('readme/S3.md', 'build/s3/README.md');
rmSync('build/velora-s3.zip', { force: true });
run('zip', ['-qr', '../velora-s3.zip', '.'], { cwd: `${root}/build/s3` });
console.log('Created build/velora-s3.zip. Upload the entire site folder, not just index.html.');
