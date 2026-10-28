## Local compatibility patch

The `window.open` override in `glass.handler.js` rewrites only the URL and forwards all remaining arguments to the native function, including the browsing target and window features. It returns the real native result.

Preserve this change when updating the vendored engine. Dropping the target changes GeForce NOW's `window.open(url, "_self")` sign-in redirect into a new tab. Named authentication popups also need their target and features intact.

`tests/uv-window-open.test.mjs` exercises the actual vendored override. The build copies this directory to `static/glass/`.

The identifier rewriter in `glass.bundle.js` also preserves non-computed class-field names and private-member accesses. A field declaration such as `parent;` is a property key, not a read of the global `parent`. Rewriting that key into `__uv.$get(parent);` creates invalid JavaScript and prevents NVIDIA's sign-in application from starting. Computed keys and field initializers still pass through normal rewriting. Coverage lives in `tests/uv-class-fields.test.mjs`.
