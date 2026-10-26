# Direct Velora deployment

This source builds the full SvelteKit application for the existing ChatGPT Site.
The desktop and all browser code, routes, service workers, themes and wallpapers
are served on the Site origin. There is no outer iframe to a Cloudflare site.
App windows still use Velora's original local iframes and proxy loaders.

Build with the Sites build helper or `npm run build`. The output is a Worker at
`dist/server/index.js` and assets at `dist/client`. The existing Site identity
must be preserved in `.openai/hosting.json`, with no `static` property.

The original Wisp relay remains external at `wss://system.pilotrights.com/jsonn/`.
It needs raw network connections that the Sites runtime does not support.
Custom relays remain configurable in Settings. The BYOD server route remains
available, but requires the same Cloudflare secret environment variables as the
original deployment. No credentials are included in this source.

GeForce opens maximized and uses optional Chromium Escape capture when native
fullscreen is active. The browser's hold-Escape exit remains available. Safari
does not support the Keyboard Lock API and falls back to normal Escape behavior.

The Games library loads its catalog, thumbnails, and game files from the existing
game host at `https://gtest.5.188.124.68.nip.io`, configured in
`src/lib/books/config.ts`. The game archive is not bundled with this repository;
availability of individual games depends on that host. The Pyrite bundle at
`static/pyrite/index.html` remains absent.
