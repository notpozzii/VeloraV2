// Proxy URLs belong to a browser-side service worker, not SvelteKit routes.
// Safari can send the first iframe navigation to the server before that iframe
// is controlled. Give that new document one chance to reconnect, rather than
// rendering the site's 404 inside the browser.
export function proxyRecoveryResponse(request) {
  const url = new URL(request.url);
  if (!/^\/(?:prism|geforce\/proxy)\/[^/]+\/[^/]+\//.test(url.pathname)) return null;
  const html = request.method === 'GET' && (
    request.mode === 'navigate' ||
    ['document', 'iframe'].includes(request.headers.get('sec-fetch-dest')) ||
    request.headers.get('accept')?.includes('text/html')
  );
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  };
  const body = html ? `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reconnecting · Velora</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#20251f;color:#eeeae1;font:15px/1.6 system-ui}main{max-width:420px;padding:28px}h1{font-size:22px}button,a{font:inherit;color:inherit}button{padding:9px 15px;background:#d3e5b0;color:#20251f;border:0;border-radius:8px;margin-right:16px}</style>
<main><h1>Reconnecting your browser…</h1><p id="status" role="status">Waiting for Velora's browser connection.</p>
<button id="retry" hidden>Try again</button><a href="/os" target="_top">Back to desktop</a></main>
<script src="/proxy-reconnect.js" defer></script></html>` :
    'The Velora browser connection is not ready. Refresh the browser page to reconnect. Submitted data has not been replayed.';
  return new Response(request.method === 'HEAD' ? null : body, { status: 503, headers });
}
