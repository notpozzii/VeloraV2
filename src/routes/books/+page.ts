import type { PageLoad } from './$types';
import { loadCatalog } from '$lib/books/catalog';

export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	// The catalog and game assets are served by the configured game host.
	// Only a missing catalog gets the empty state; other failures stay visible.
	const missingCatalog = new Error('Game catalog is unavailable');
	try {
		const games = await loadCatalog(async (input, init) => {
			const response = await fetch(input, init);
			if (response.status === 404) throw missingCatalog;
			return response;
		});
		return { games, catalogUnavailable: false };
	} catch (error) {
		if (error === missingCatalog) return { games: [], catalogUnavailable: true };
		throw error;
	}
};
