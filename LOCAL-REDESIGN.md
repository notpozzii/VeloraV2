# Velora — local redesign

This checkout contains the approved Velora desktop redesign and its local preview instructions.

## Preview

Open http://127.0.0.1:5280/ while the local server is running. To restart it from this folder:

```sh
npm run dev -- --host 127.0.0.1 --port 5280 --strictPort
```

The installed dependencies are reused through the existing local node_modules link.

## The concept

A calmer desktop: graphite and pale sage, natural landscape photography, a quiet clock and search control, an open landscape, and a compact dock. Repeated desktop launch cards, promotional copy, and the side panel have been removed for more space. Open the launcher from All apps, the search control, or Cmd/Ctrl+K. The launcher supports app lookup and web browsing, Enter, Escape, and keyboard focus containment. Type a website or a topic to browse with your saved browser/search settings; an existing Browser receives a new tab without losing its current tabs. Cmd/Ctrl+Enter chooses the web result when an app also matches. App/window behavior and proxy routes are reused from Velora.

Pyrite has been removed from the desktop, dock, and launcher. Apps start automatically without an initial loading click.

The new style continues through the browser, new-tab page, settings, app/game libraries, wallpaper chooser, window controls, and download page. Desktop wallpaper customization remains available.

The game collection is served by Velora's existing game host, configured in `src/lib/books/config.ts`. Games loads its catalog, thumbnails, and playable files from that host. External game/relay uptime, third-party app logins, and streaming connections still depend on the original services.

This local version has no Velora banner, popunder, SmartLink, click-ad, or analytics integration. The old ad-disable shortcut has also been removed.

## Validation

The production build and 43 proxy/runtime, search, and window tests passed. Main local routes responded successfully. After correcting the Vite allow-list for shared dependencies, all 244 requests in the desktop startup module/dependency graph returned successfully. Rendered interaction/visual inspection was unavailable because local browser automation is disabled in Work settings; no alternative browser automation was used.

## Wallpaper

`src/lib/img/bg/highlands.jpg`, with a small chooser thumbnail in `src/lib/img/bg-downsized/highlands.jpg`.

Created with the built-in image-generation tool, then converted to JPEG for the project. Prompt: “Quiet editorial travel photograph of remote Scottish Highland or Faroe Island coastal hills: dark olive and sage grass, a still slate-blue sea inlet, distant mountain silhouettes under a pale warm-gray overcast sky. Wide composition with negative space at top left and the valley and reflective water on the right. Real texture, subtle mist, muted mineral palette. No people, buildings, roads, typography, logos, UI, or watermark.”

The untouched generated original is retained in the Codex generated-images folder.
