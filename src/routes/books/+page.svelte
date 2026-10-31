<!-- The game catalog integration originated in Endis. Velora's library interface is maintained here. -->
<script lang="ts">
	import type { Game } from '$lib/books/types';
	import { collectTags, formatTag, TOP_GAME_ID } from '$lib/books/catalog';
	import { favorites } from '$lib/books/favorites.svelte';
	import { trackVisit } from '$lib/books/history';
	import { intersect } from '$lib/books/intersect';
	import GameCard from '$lib/books/bookCard.svelte';
	import GameOverlay from '$lib/books/bookOverlay.svelte';
	import Shell from '$lib/utils/library/shell.svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let query = $state('');
	let category = $state('');
	let collection = $state('all');
	let sort = $state('az');
	let displayedCount = $state(48);
	let activeGame = $state<Game | null>(null);
	const categories = $derived(
		collectTags(data.games).map((id) => ({
			id,
			label: formatTag(id),
			count: data.games.filter((game) => game.tags.includes(id)).length
		}))
	);
	const savedCount = $derived(data.games.filter((game) => favorites.has(game.id)).length);
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const games = data.games.filter(
			(game) =>
				(!q || game.name.toLowerCase().includes(q) || game.tags.some((tag) => tag.includes(q))) &&
				(!category || game.tags.includes(category)) &&
				(collection !== 'saved' || favorites.has(game.id))
		);
		return games.sort((a, b) => {
			const topOrder = Number(b.id === TOP_GAME_ID) - Number(a.id === TOP_GAME_ID);
			if (topOrder) return topOrder;
			const favoriteOrder = Number(favorites.has(b.id)) - Number(favorites.has(a.id));
			if (favoriteOrder) return favoriteOrder;
			return sort === 'za'
				? b.name.localeCompare(a.name, undefined, { numeric: true })
				: a.name.localeCompare(b.name, undefined, { numeric: true });
		});
	});
	const visible = $derived(filtered.slice(0, displayedCount));
	const picks = $derived(
		['baseball.irish', '10 Minutes Till Dawn', 'Slope', '2048']
			.map((name) => data.games.find((game) => game.name.toLowerCase() === name.toLowerCase()))
			.filter((game): game is Game => !!game)
	);
	$effect(() => {
		query;
		category;
		collection;
		sort;
		displayedCount = 48;
	});
	function openGame(game: Game) {
		trackVisit('game', game.id, game.name, game.thumb);
		activeGame = game;
	}
	function loadMore() {
		displayedCount = Math.min(displayedCount + 48, filtered.length);
	}
	function randomGame() {
		if (filtered.length) openGame(filtered[Math.floor(Math.random() * filtered.length)]);
	}
	function clearFilters() {
		query = '';
		category = '';
		collection = 'all';
	}
</script>

<svelte:head><title>Velora — Games</title></svelte:head>
<Shell
	section="games"
	count={data.games.length}
	{savedCount}
	{categories}
	{category}
	{collection}
	oncategory={(value) => (category = value)}
	oncollection={(value) => (collection = value)}
>
	{#if data.catalogUnavailable}
		<div class="collection-empty">
			<Icon name="games" size={36} />
			<h2>Games unavailable</h2>
			<p>The game catalog could not load.</p>
			<button class="primary-action" onclick={() => location.reload()}>Try again</button>
		</div>
	{:else}
		<div class="collection-section-heading collection-browse-toolbar">
			<div>
				{#if collection === 'all' && !query.trim() && !category && picks.length}<h2
						id="picks-heading"
					>
						Quick picks
					</h2>{/if}
			</div>
			<label class="collection-search"
				><Icon name="search" size={17} /><input
					aria-label="Search games"
					placeholder="Search games"
					bind:value={query}
				/>{#if query}<button aria-label="Clear search" onclick={() => (query = '')}
						><Icon name="close" size={15} /></button
					>{/if}</label
			>
			<button class="quiet-action" onclick={randomGame} disabled={!filtered.length}
				>Random game <Icon name="arrow" size={15} /></button
			>
		</div>
		{#if collection === 'all' && !query.trim() && !category && picks.length}
			<section class="quick-picks" aria-labelledby="picks-heading">
				<div class="featured-grid">
					{#each picks as game, i (game.id)}<button
							class="featured-game"
							class:featured-violet={i === 1}
							class:featured-amber={i === 2}
							onclick={() => openGame(game)}
							aria-label={`Play ${game.name}`}
						>
							{#if game.thumb}<img
									src={game.thumb}
									alt=""
									onerror={(event) => (event.currentTarget.style.opacity = '0')}
								/>{/if}
							<div class="featured-shade"></div>
							<div class="featured-content">
								<span class="featured-tag">{formatTag(game.tags[0] || 'game')}</span>
								<h3>{game.name}</h3>
								<span class="featured-play">Play now <Icon name="arrow" size={16} /></span>
							</div>
						</button>{/each}
				</div>
			</section>
		{/if}
		<section aria-labelledby="games-heading">
			<div class="collection-section-heading collection-results">
				<div>
					<h2 id="games-heading">
						{collection === 'saved'
							? 'Favorites'
							: category
								? formatTag(category)
								: query.trim()
									? 'Search results'
									: 'All games'}
					</h2>
					<span>{filtered.length} {filtered.length === 1 ? 'game' : 'games'}</span>
				</div>
				<label class="collection-sort"
					>Sort<select aria-label="Sort games" bind:value={sort}
						><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select
					></label
				>
			</div>
			{#if !filtered.length}<div class="collection-empty">
					<Icon name={collection === 'saved' ? 'star' : 'search'} size={32} />
					<h3>
						{collection === 'saved' && !query && !category
							? 'No favorites yet'
							: 'No matching games'}
					</h3>
					<p>
						{collection === 'saved' && !query && !category
							? 'Use the star on a game to save it here.'
							: 'Try a different search or category.'}
					</p>
					{#if query || category}<button class="secondary-action" onclick={clearFilters}
							>Clear filters</button
						>{/if}
				</div>
			{:else}<div class="games-grid">
					{#each visible as game (game.id)}<GameCard {game} onopen={openGame} />{/each}
				</div>
				{#if displayedCount < filtered.length}<div class="load-more-row">
						<button class="secondary-action" onclick={loadMore}
							>Load more <span>{filtered.length - displayedCount} remaining</span></button
						>
						<div use:intersect={loadMore}></div>
					</div>{/if}{/if}
		</section>
	{/if}
</Shell>
<GameOverlay game={activeGame} onclose={() => (activeGame = null)} />
