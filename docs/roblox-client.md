# Velora Roblox prototype

The `/roblox/` route is an independent experimental launcher. Its experience
frame runs Roblox's official engine through Velora's own `/roblox/engine/`
asset route. It does not embed or load Truffled, now.gg, or WebBlox.

The home screen uses a dark Roblox-style game library with official game icons,
live ratings and player counts. Search filters the featured catalog; pasting a
Roblox game link or place ID also resolves experiences outside that catalog.
Saved and recently opened games are stored in this browser. Account headshots
and game details use the existing Roblox connection; login and game sessions
continue through the existing launcher handlers.

## Current implementation

- Pinned official build `0.746.0.7461265`; see `src/lib/roblox/build.js`.
- Scoped shared-memory isolation headers, leaving other Velora pages unchanged.
- Roblox sign-in through the existing Prism browser session. No cookie inputs,
  cookie URLs, or third-party account pools.
- Browser and pthread HTTP bridges to an allowlist of Roblox/CDN hosts.
- Scoped `rbx-user-agent` game-join identity and an experimental WebTransport routing adapter,
  including reserved-server teleport joins.
  Server denials remain denials; no private-game or account permissions change.
- Game input validation, cancellation, progress and error reporting.

The WASM binary is currently unmodified. The first approach adapts the existing
browser transport around it. The old Weblox RakNet binary patch does not match
this build and must not be applied by its old function numbers.

## Verification

Run `node --test tests/roblox-*.test.mjs` for network boundary, thread routing, hosted isolation, edge assets and session
handling checks. The normal production build is `bun run build`.

On November 10, 2026, the pinned engine joined public place 1818 (Crossroads)
in Safari using the user's signed-in session. The live multiplayer world,
avatar, inventory and player list rendered; keyboard movement moved the avatar
off its spawn pad. Leaving returned to the signed-in launcher. Other games,
reserved-server transfers and other browser versions remain unverified.

The dedicated engine needs WebTransport, WebAssembly JSPI and 2 GiB of shared
memory; the launcher checks these browser features. Open it as its own top-level
page using the Roblox entry in Apps. This first version
uses server routes and isolation headers; an S3-only export and a double-click
HTML file do not yet supply those requirements.

The client identity and neighboring WebTransport endpoint mapping are also
documented in the original experiments at
https://github.com/H644b/Roblox-Public-Web-Play-Join . This implementation uses
Velora's own request bridge and launcher with an unmodified official engine.
