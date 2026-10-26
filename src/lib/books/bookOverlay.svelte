<script lang="ts">
	import type { Game } from './types';
	import Rocket from '$lib/utils/loading/rocket.svelte';
	import { frameLoading } from '$lib/utils/loading/frame-loading.js';

	let { game, onclose }: { game: Game | null; onclose: () => void } = $props();

	let frame = $state<HTMLIFrameElement>();
	let proxied = $state(false);
	let contentLoading = $state(true);
	const src = $derived.by(() => {
		if (!game) return '';
		if (!proxied) return game.url;
		const url = encodeURIComponent(new URL(game.url, 'https://gtest.5.188.124.68.nip.io/').href);
		return `/api?url=${url}&type=glass&transport=libcurlRaw&autoSW=true`;
	});

	$effect(() => {
		document.body.style.overflow = game ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	});

	$effect(() => {
		game;
		proxied = false;
	});

	function requestFullscreen() {
		frame?.requestFullscreen?.();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && game) onclose();
	}
</script>

<svelte:window {onkeydown} />

{#if game}
	<div class="overlay">
		<div class="toolbar">
			<div class="game-heading">
				<button class="tbtn" onclick={onclose}>
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M19 12H5M12 19l-7-7 7-7" />
					</svg>
					Back
				</button>

				<span class="title">{game.name}</span>
			</div>

			<p class="connection-note">If the game isn’t loading, use proxy connection.</p>

			<div class="game-controls">
				<button
					class="tbtn"
					class:active={proxied}
					aria-label={proxied ? 'Use direct connection' : 'Use proxy connection'}
					onclick={() => (proxied = !proxied)}
				>
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="9" />
						<path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
					</svg>
					<span>{proxied ? 'Use direct connection' : 'Use proxy connection'}</span>
				</button>

				<button class="tbtn" onclick={requestFullscreen} aria-label="Fullscreen">
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
					</svg>
				</button>
			</div>
		</div>

		<div class="game-content">
			{#key proxied}
				<iframe
					bind:this={frame}
					use:frameLoading={(value) => (contentLoading = value)}
					{src}
					title={game.name}
					sandbox={proxied
						? undefined
						: 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock'}
					allow="autoplay; fullscreen; gamepad"
				></iframe>
			{/key}
			{#if contentLoading}<Rocket />{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		flex-direction: column;
		background: #191d19;
	}

	.toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		background: #191f19;
		border-bottom: 1px solid #ffffff16;
	}
	.game-heading,
	.game-controls {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.game-controls {
		justify-content: flex-end;
	}
	.connection-note {
		margin: 0;
		color: #a7b29e;
		font: 400 12px/1.5 var(--font-family-body);
		text-align: center;
	}

	.tbtn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #2a3526;
		color: #c4d1b9;
		border: 1px solid #ffffff22;
		padding: 8px 12px;
		border-radius: 7px;
		cursor: pointer;
		font-size: 12px;
		font-family: var(--font-family-body);
		flex-shrink: 0;
		white-space: nowrap;
		backdrop-filter: blur(12px);
		transition:
			background 0.2s,
			color 0.2s;
	}
	.tbtn:hover {
		background: #3b4a32;
		color: #edf4e7;
	}
	.tbtn.active {
		background: #d3e8b2;
		border-color: #d3e8b2;
		color: #23331c;
	}

	.title {
		flex: 1;
		font-family: var(--font-family-heading);
		font-weight: 600;
		font-size: 15px;
		color: #edf4e7;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.game-content {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: none;
		background: #191f19;
	}
	.tbtn:focus-visible {
		outline: 2px solid #d3e8b2;
		outline-offset: 3px;
	}
	@media (max-width: 960px) {
		.toolbar {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.game-controls {
			grid-column: 2;
			grid-row: 1;
		}
		.connection-note {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
	@media (max-width: 560px) {
		.toolbar {
			gap: 7px;
			padding: 9px;
		}
		.tbtn {
			padding: 8px;
		}
		.tbtn span {
			display: none;
		}
		.title {
			font-size: 12px;
		}
	}
</style>
