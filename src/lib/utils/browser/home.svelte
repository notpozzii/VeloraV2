<script>
	import Icon from './icon.svelte';
	let { ready = false, onsearch, onopen } = $props();
	let query = $state('');
	let searching = $state(false);

	async function submitSearch(event) {
		event.preventDefault();
		const value = query.trim();
		if (!value || !onsearch || searching) return;
		searching = true;
		try {
			await onsearch(value);
		} finally {
			searching = false;
		}
	}
	async function openShortcut(url) {
		if (!onopen || searching) return;
		searching = true;
		try { await onopen(url); }
		finally { searching = false; }
	}
</script>

<section class="new-tab" aria-label="New tab">
	<div class="new-tab-content">
		<h1 class="wordmark"><span class="velora-mark" aria-hidden="true">v.</span><span>velora</span></h1>
		<form class="home-search" role="search" onsubmit={submitSearch} aria-busy={searching}>
			<span class="search-symbol"><Icon name="search" size={20} /></span>
			<input
				bind:value={query}
				type="search"
				name="q"
				aria-label="Search the web or type a URL"
				placeholder="Search the web or type a URL"
				autocomplete="off"
				spellcheck="false"
			/>
			<button class="search-submit" type="submit" aria-label="Search" disabled={!query.trim() || searching}>
				<Icon name="arrow" size={21} />
			</button>
		</form>
		<div class="home-shortcuts" role="group" aria-label="Quick links">
			<button class="home-shortcut" type="button" onclick={() => openShortcut('https://www.youtube.com/')} disabled={searching || !onopen}>
				<span class="shortcut-icon youtube">
					<svg width="27" height="27" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033"/><path d="m10 9 5 3-5 3z" fill="white"/></svg>
				</span>
				<span>YouTube</span>
			</button>
			<button class="home-shortcut" type="button" onclick={() => openShortcut('https://discord.com/app')} disabled={searching || !onopen}>
				<span class="shortcut-icon discord">
					<svg width="27" height="27" viewBox="0 0 24 24" fill="#a7b0ff" aria-hidden="true"><path d="M19.6 5.5A18 18 0 0 0 15.3 4l-.5 1a16 16 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.3 1.5C1.7 9.5 1 13.4 1.4 17.2A18 18 0 0 0 6.7 20l1.1-1.8-1.6-.8.4-.3a13.5 13.5 0 0 0 10.8 0l.4.3-1.6.8 1.1 1.8a18 18 0 0 0 5.3-2.8c.4-4.4-.7-8.2-3-11.7ZM8.4 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.2 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>
				</span>
				<span>Discord</span>
			</button>
		</div>
		{#if searching}<p class="home-status" role="status">Opening…</p>{/if}
	</div>
</section>

<style>
	.new-tab {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 40px 24px 100px;
		overflow: auto;
		background: #20221f;
		color: #eeeae1;
		font-family: var(--zen-font);
	}
	.new-tab-content {
		width: min(100%, 584px);
		text-align: center;
	}
	.wordmark { display: flex; align-items: center; justify-content: center; gap: 15px; margin: 0 0 32px; color: #eeeae1; font: 500 clamp(42px, 8vw, 64px)/1.15 var(--zen-font); letter-spacing: -3px; }
	.velora-mark { color: #d3e5b0; font: italic bold 1.15em/1 Georgia, serif; letter-spacing: -9px; padding-right: 8px; }

	.home-search {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 54px;
		padding: 5px 7px 5px 20px;
		border: 1px solid #d3e5b025;
		border-radius: 28px;
		background: #2b3027;
		box-shadow: 0 1px 6px #0003;
		transition: box-shadow 150ms ease;
		color-scheme: dark;
	}
	.home-search:hover { box-shadow: 0 2px 10px #0006; }
	.home-search:focus-within { outline: 2px solid #d3e5b0; outline-offset: 3px; }
	.search-symbol { display: grid; place-items: center; flex: 0 0 auto; color: #a2ae95; }
	.home-search input {
		flex: 1;
		min-width: 0;
		width: 100%;
		padding: 9px 0;
		border: 0;
		outline: none;
		background: transparent;
		color: #eeeae1;
		font: 400 15px/1.5 var(--zen-font);
	}
	.home-search input::placeholder { color: #a2ae95; opacity: 1; }
	.search-submit {
		display: grid;
		place-items: center;
		flex: 0 0 40px;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: #d3e5b0;
		cursor: pointer;
	}
	.search-submit:hover:not(:disabled) { background: #d3e5b017; }
	.search-submit:disabled { color: #8f9b82; cursor: default; }
	.search-submit:focus-visible { outline: 2px solid #d3e5b0; outline-offset: 1px; }
	.home-shortcuts { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
	.home-shortcut {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 13px;
		width: 112px;
		padding: 14px 12px 16px;
		border: 0;
		border-radius: 5px;
		background: transparent;
		color: #eeeae1;
		font: 400 13px/1.3 var(--zen-font);
		cursor: pointer;
		transition: background 150ms ease;
	}
	.home-shortcut:hover:not(:disabled) { background: #ffffff0f; }
	.home-shortcut:focus-visible { outline: 2px solid #d3e5b0; outline-offset: 2px; }
	.home-shortcut:disabled { opacity: .4; cursor: default; }
	.shortcut-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #31382c; }
	.discord { background: #31382c; }
	.home-status { margin: 18px 0 0; color: #8f9b82; font: 400 12px/1.5 var(--zen-font); }
	@media (max-width: 420px) {
		.new-tab { padding: 32px 18px 70px; }
		.wordmark { margin-bottom: 26px; }
		.home-search { gap: 10px; padding-left: 16px; }
		.home-search input { font-size: 13px; }
		.home-shortcuts { gap: 4px; margin-top: 18px; }
	}
	@media (max-height: 480px) { .new-tab { padding-block: 24px; } .wordmark { font-size: 42px; margin-bottom: 20px; } .home-shortcuts { margin-top: 12px; } }
	@media (prefers-reduced-motion: reduce) { .home-search, .home-shortcut { transition: none; } }
</style>
