The game list is bundled in `catalog.json`, so opening Games does not depend on a browser request to the external game host. Game and thumbnail URLs still use `GAMES_BASE` in `config.ts`.

To update the list from the existing host, run `node scripts/update-game-catalog.mjs` with Node 24 or newer, review the JSON change, then rebuild and publish. Builds use the checked-in copy and do not require the game host to be online.
