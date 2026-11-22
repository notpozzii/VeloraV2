import { readFile, writeFile } from 'node:fs/promises';
import { GAMES_BASE } from '../src/lib/books/config.ts';

const response = await fetch(new URL('/books/gmes.json', GAMES_BASE), { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Game catalog returned ${response.status}`);
const games = await response.json();
if (!Array.isArray(games) || !games.length || !games.every(game =>
	game && typeof game.file_name === 'string' && game.file_name && typeof game.title === 'string' && game.title
)) throw new Error('The game host returned an invalid catalog; the existing copy was kept.');
const catalogPath = new URL('../src/lib/books/catalog.json', import.meta.url);
const previous = JSON.parse(await readFile(catalogPath, 'utf8'));
const previousByFile = new Map(previous.map(game => [game.file_name, game]));
const currentFiles = new Set(games.map(game => game.file_name));
const renamedByTitle = new Map();
const titleKey = game => JSON.stringify([game.title, game.origin ?? '']);

for (const game of previous) {
	if (currentFiles.has(game.file_name)) continue;
	const key = titleKey(game);
	if (!renamedByTitle.has(key)) renamedByTitle.set(key, []);
	renamedByTitle.get(key).push(game);
}

const updated = games.map(game => {
	const match = previousByFile.get(game.file_name) ?? renamedByTitle.get(titleKey(game))?.shift();
	const stableId = match?.id ?? match?.file_name.replace(/index\.html?$/i, '').replace(/^\/+|\/+$/g, '');
	return stableId ? { ...game, id: stableId } : game;
});
await writeFile(catalogPath, JSON.stringify(updated, null, 2) + '\n');
console.log(`Updated the built-in catalog: ${games.length} games.`);
