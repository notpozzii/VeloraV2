<script lang="ts">
	import type { Game } from './types';
	import { formatTag } from './catalog';
	import { favorites } from './favorites.svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	let { game, onopen }: { game: Game; onopen: (game: Game) => void } = $props();
	let failed = $state(false);
	const initials = $derived(
		game.name
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase()
	);
</script>

<article class="game-card" data-zone-id={game.id}>
	<button class="game-open" onclick={() => onopen(game)} aria-label={`Play ${game.name}`}>
		<div class="game-cover">
			{#if game.thumb && !failed}<img
					src={game.thumb}
					alt=""
					loading="lazy"
					decoding="async"
					onerror={() => (failed = true)}
				/>{:else}<span class="game-initials">{initials}</span>{/if}
			<span class="game-play"><Icon name="arrow" size={19} /><span>Play</span></span>
		</div>
		<div class="game-card-info">
			<h3>{game.name}</h3>
			<p>{game.tags.slice(0, 2).map(formatTag).join(' · ') || 'Game'}</p>
		</div>
	</button>
	<button
		class="game-save"
		class:is-saved={favorites.has(game.id)}
		aria-pressed={favorites.has(game.id)}
		aria-label={`${favorites.has(game.id) ? 'Remove' : 'Save'} ${game.name} ${favorites.has(game.id) ? 'from' : 'to'} favorites`}
		onclick={() => favorites.toggle(game.id)}><Icon name="star" size={15} /></button
	>
</article>
