<!--This g a m e page is from Endis-->

<script lang="ts">
	import type { Game } from '$lib/books/types';
	import { collectTags } from '$lib/books/catalog';
	import { favorites } from '$lib/books/favorites.svelte';
	import { trackVisit } from '$lib/books/history';
	import { intersect } from '$lib/books/intersect';
	import GameToolbar from '$lib/books/bookToolbar.svelte';
	import GameCard from '$lib/books/bookCard.svelte';
	import GameOverlay from '$lib/books/bookOverlay.svelte';
	import type { PageData } from './$types';
	import '$lib/style/apps.css';
	import Icon from '$lib/utils/browser/icon.svelte';

	const BATCH = 60;

	let { data }: { data: PageData } = $props();

	let search = $state('');
	let selectedTags = $state<string[]>([]);
	let filter = $state<'all' | 'favorites'>('all');
	let displayedCount = $state(BATCH);
	let activeGame = $state<Game | null>(null);

	const tagList = $derived(collectTags(data.games));

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return data.games.filter((g) => {
			const matchesSearch =
				!q || g.name.toLowerCase().includes(q) || g.tags.some((t) => t.toLowerCase().includes(q));
			const matchesTag = !selectedTags.length || g.tags.some((t) => selectedTags.includes(t));
			const matchesFav = filter === 'all' || favorites.has(g.id);
			return matchesSearch && matchesTag && matchesFav;
		});
	});

	const favoriteGames = $derived(data.games.filter((g) => favorites.has(g.id)));
	const visible = $derived(filtered.slice(0, displayedCount));

	$effect(() => {
		search;
		selectedTags;
		filter;
		displayedCount = BATCH;
	});

	function loadMore() {
		displayedCount = Math.min(displayedCount + BATCH, filtered.length);
	}

	function openGame(game: Game) {
		trackVisit('game', game.id, game.name, game.thumb);
		activeGame = game;
	}

	function openRandom() {
		const pool = filtered.length ? filtered : data.games;
		if (pool.length) openGame(pool[Math.floor(Math.random() * pool.length)]);
	}
</script>

<div class="library-page games-library">
	<header class="library-header">
		<div>
			<h1 class="library-title">Games</h1>
		</div>
		<span class="library-count"
			>{data.catalogUnavailable ? 'Catalog unavailable' : `${data.games.length} games`}</span
		>
	</header>

	{#if data.catalogUnavailable}
		<section class="catalog-missing" aria-labelledby="catalog-missing-title">
			<div class="catalog-symbol"><Icon name="games" size={28} /></div>
			<h2 id="catalog-missing-title">Games unavailable</h2>
			<p class="catalog-description">The game catalog could not load. Reload to try again.</p>
			<a class="catalog-link" href="/apps">Open Apps <Icon name="arrow" size={15} /></a>
		</section>
	{:else}
		<GameToolbar
			bind:search
			bind:selected={selectedTags}
			bind:filter
			tags={tagList}
			onrandom={openRandom}
		/>

		{#if favoriteGames.length > 0 && filter !== 'favorites'}
			<div class="section-header">Favorites</div>
			<div class="grid">
				{#each favoriteGames.slice(0, 12) as game (game.id)}
					<GameCard {game} onopen={openGame} />
				{/each}
			</div>
		{/if}

		<div class="section-header">
			{filter === 'favorites' ? 'Favorites' : 'All games'} <span>{filtered.length} games</span>
		</div>

		{#if filtered.length === 0}
			<p class="empty">No games match your search or filters.</p>
		{:else}
			<div class="grid">
				{#each visible as game (game.id)}
					<GameCard {game} onopen={openGame} />
				{/each}
			</div>

			{#if displayedCount < filtered.length}
				<div class="load-more-row">
					<button class="load-more" onclick={loadMore}>
						Load More ({filtered.length - displayedCount} remaining)
					</button>
				</div>
				<div use:intersect={loadMore}></div>
			{/if}
		{/if}

		<GameOverlay game={activeGame} onclose={() => (activeGame = null)} />
	{/if}
</div>

<style>
	:global(body) {
		background: #20221f;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 17px;
		padding: 0 0 24px;
		content-visibility: auto;
		contain-intrinsic-size: 500px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin: 23px 0 15px;
		font-size: 11px;
		font-weight: 500;
		color: #c9cfbf;
	}
	.section-header span {
		color: #78836d;
		font-size: 10px;
		font-weight: 400;
	}

	.empty {
		padding: 48px 24px;
		text-align: center;
		color: #8e9981;
	}
	.catalog-missing {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 340px;
		justify-content: center;
		padding: 45px 24px;
		border: 1px solid #d3e5b015;
		border-radius: 13px;
		background: #252922;
		text-align: center;
	}
	.catalog-symbol {
		display: grid;
		place-items: center;
		width: 65px;
		height: 65px;
		margin-bottom: 23px;
		border: 1px solid #d3e5b025;
		border-radius: 19px;
		color: #c2d5a2;
		background: #d3e5b008;
	}
	.catalog-missing h2 {
		margin: 0;
		color: #e3e9d9;
		font-size: clamp(21px, 3vw, 30px);
		line-height: 1.2;
		letter-spacing: -0.045em;
		font-weight: 450;
	}
	.catalog-description {
		max-width: 345px;
		margin: 15px 0 24px;
		color: #8e9d80;
		font-size: 12px;
		line-height: 1.8;
	}
	.catalog-link {
		display: inline-flex;
		align-items: center;
		gap: 14px;
		padding: 11px 15px;
		border: 1px solid #d3e5b0;
		border-radius: 7px;
		color: #26301d;
		background: #d3e5b0;
		text-decoration: none;
		font-size: 11px;
		font-weight: 500;
		transition:
			background 180ms ease,
			transform 180ms ease;
	}
	.catalog-link:hover {
		background: #e0edc8;
		transform: translateY(-2px);
	}
	.catalog-link:focus-visible {
		outline: 1px solid #d3e5b0;
		outline-offset: 4px;
	}

	.load-more-row {
		display: flex;
		justify-content: center;
		padding: 12px 24px 32px;
	}
	.load-more {
		padding: 11px 20px;
		background: #2b3125;
		border: 1px solid #d3e5b026;
		border-radius: 7px;
		color: #bbcda5;
		font:
			500 11px Inter,
			-apple-system,
			sans-serif;
		cursor: pointer;
		backdrop-filter: blur(12px);
		transition:
			background 0.2s,
			color 0.2s;
	}
	.load-more:hover {
		background: #343f2b;
		color: #edece4;
	}
	@media (max-width: 640px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
	}
</style>
