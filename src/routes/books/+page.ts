import type { PageLoad } from './$types';
import { loadCatalog } from '$lib/books/catalog';

export const ssr = false;

export const load: PageLoad = async () => ({
	games: await loadCatalog(),
	catalogUnavailable: false
});
