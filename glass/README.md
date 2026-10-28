## Local compatibility patch

The `window.open` override in `glass.handler.js` rewrites only the URL and forwards all remaining arguments to the native function, including the browsing target and window features. It returns the real native result.

Preserve this change when updating the vendored engine. Dropping the target changes GeForce NOW's `window.open(url, "_self")` sign-in redirect into a new tab. Named authentication popups also need their target and features intact.

`tests/uv-window-open.test.mjs` exercises the actual vendored override. The build copies this directory to `static/glass/`.
