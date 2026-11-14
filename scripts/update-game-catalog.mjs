import { writeFile } from 'node:fs/promises';
import { GAMES_BASE } from '../src/lib/books/config.ts';

const response = await fetch(new URL('/books/gmes.json', GAMES_BASE), { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Game catalog returned ${response.status}`);
const games = await response.json();
if (!Array.isArray(games) || !games.length || !games.every(game =>
	game && typeof game.file_name === 'string' && game.file_name && typeof game.title === 'string' && game.title
)) throw new Error('The game host returned an invalid catalog; the existing copy was kept.');
await writeFile(new URL('../src/lib/books/catalog.json', import.meta.url), JSON.stringify(games, null, 2) + '\n');
console.log(`Updated the built-in catalog: ${games.length} games.`);
