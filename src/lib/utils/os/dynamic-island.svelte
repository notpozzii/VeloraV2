<script>
	import { onDestroy, tick } from 'svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	import veloraMark from '$lib/assets/velora-mark.svg';

	let {
		time = '', date = '', activity = '', browserUrl = '/slate', downloadUrl = '/download',
		external = false, fullscreen = false, onexpand = () => {},
		onglass = (_event) => {}, onwidgets = (_event) => {},
		onfullscreen = (_event) => {}, onwallpaper = (_event) => {},
		onsearch = async (_query) => false
	} = $props();
	let expanded = $state(false);
	let searching = $state(false);
	let query = $state('');
	let searchBusy = $state(false);
	let searchError = $state('');
	let root;
	let trigger;
	let searchTrigger;
	let searchInput;
	let searchRoot;
	let searchHovering = false;
	let searchCloseTimer;
	let hovering = false;
	let openTimer;
	let closeTimer;

	function clearTimers() {
		clearTimeout(openTimer);
		clearTimeout(closeTimer);
	}
	function openIsland() {
		clearTimers();
		closeSearch();
		if (expanded) return;
		expanded = true;
		onexpand();
	}
	function closeIsland() {
		clearTimers();
		expanded = false;
	}
	function enterIsland(event) {
		if (event.pointerType !== 'mouse') return;
		hovering = true;
		clearTimers();
		if (!expanded) openTimer = setTimeout(openIsland, 70);
	}
	function scheduleClose() {
		clearTimers();
		closeTimer = setTimeout(() => {
			if (!hovering && !root?.contains(document.activeElement)) closeIsland();
		}, 180);
	}
	function leaveIsland(event) {
		if (event.pointerType !== 'mouse') return;
		hovering = false;
		scheduleClose();
	}
	onDestroy(() => { clearTimers(); clearTimeout(searchCloseTimer); });

	function closeSearch() {
		clearTimeout(searchCloseTimer);
		searching = false;
		searchError = '';
	}
	function scheduleSearchClose() {
		clearTimeout(searchCloseTimer);
		searchCloseTimer = setTimeout(() => {
			if (!searchHovering && !searchRoot?.contains(document.activeElement) && !searchBusy) closeSearch();
		}, 180);
	}

	async function openSearch(focus = false) {
		clearTimeout(searchCloseTimer);
		closeIsland();
		if (!searching) { searching = true; searchError = ''; onexpand(); }
		if (focus) { await tick(); searchInput?.focus(); }
	}
	async function submitSearch(event) {
		event.preventDefault();
		event.stopPropagation();
		const value = query.trim();
		if (!value || searchBusy) return;
		searchBusy = true;
		searchError = '';
		try {
			if (await onsearch(value)) { query = ''; closeSearch(); searchInput?.blur(); }
			else searchError = 'Could not open search. Please try again.';
		} catch { searchError = 'Could not open search. Please try again.'; }
		finally { searchBusy = false; }
	}

	function toggle(event) {
		event.stopPropagation();
		if (expanded) closeIsland();
		else openIsland();
	}
	function action(event, callback) {
		event.stopPropagation();
		closeIsland();
		trigger?.focus();
		callback(event);
	}
	function followLink(event) {
		event.stopPropagation();
		closeIsland();
	}
</script>

<svelte:window
	onclick={(event) => {
		if (!(event.target instanceof Node)) return;
		if (!root?.contains(event.target)) closeIsland();
		if (!searchRoot?.contains(event.target)) closeSearch();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && (expanded || searching)) {
			const wasSearching = searching;
			closeIsland();
			closeSearch();
			if (wasSearching) searchTrigger?.focus();
			else trigger?.focus();
		}
	}}
/>

<div class="desktop-top-controls">
<header class="dynamic-island" class:expanded bind:this={root} role="group" aria-label="Desktop controls"
	onpointerenter={enterIsland} onpointerleave={leaveIsland}
	onfocusout={(event) => {
		if (!hovering && !root?.contains(event.relatedTarget)) scheduleClose();
	}}>
	<div class="island-summary">
		<a class="island-brand" href="https://discord.gg/3vcMsqJMd" target="_blank" rel="noopener noreferrer"
			aria-label="Join Velora on Discord" title="Join Velora on Discord" onclick={followLink}>
			<img src={veloraMark} alt="" width="32" height="32" />
		</a>
		<button class="island-toggle" bind:this={trigger} onclick={toggle}
			aria-label={expanded ? 'Close desktop controls' : 'Open desktop controls'}
			aria-expanded={expanded} aria-controls="island-controls">
			<span class="island-label" title={activity || 'velora'}>
				{#if activity}<span class="activity-dot" aria-hidden="true"></span>{/if}
				<span>{activity || 'velora'}</span>
			</span>
			<time>{time}</time>
			<svg class="island-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>

	</div>
	<div class="island-reveal" inert={!expanded} aria-hidden={!expanded}>
		<div class="island-clip">
			<nav id="island-controls" class="island-controls" aria-label="Desktop shortcuts">
				<a href={browserUrl} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined} onclick={followLink}>
					<Icon name="globe" size={19} /><span>Browser</span>
				</a>
				<button data-widget-picker-toggle onclick={(event) => action(event, onwidgets)} aria-label="Add desktop widgets" aria-haspopup="dialog">
					<Icon name="widgets" size={19} /><span>Widgets</span>
				</button>
				<button onclick={(event) => action(event, onfullscreen)} aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}>
					<Icon name="fullscreen" size={19} /><span>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
				</button>
				<button onclick={(event) => action(event, onglass)} aria-label="Adjust liquid glass" aria-haspopup="dialog">
					<Icon name="settings" size={19} /><span>Glass</span>
				</button>
				<button onclick={(event) => action(event, onwallpaper)} aria-label="Change wallpaper" aria-haspopup="dialog">
					<Icon name="desktop" size={19} /><span>Wallpaper</span>
				</button>
				<a href={downloadUrl} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined} onclick={followLink}>
					<Icon name="download" size={19} /><span>Download</span>
				</a>
			</nav>
			<p class="island-date">{date}</p>
		</div>
	</div>
</header>

<div class="desktop-search-anchor" class:searching class:obscured={expanded} bind:this={searchRoot}
	aria-hidden={expanded} inert={expanded}
	onpointerenter={(event) => { if (event.pointerType === 'mouse') { searchHovering = true; void openSearch(); } }}
	onpointerleave={(event) => { if (event.pointerType === 'mouse') { searchHovering = false; scheduleSearchClose(); } }}
	onfocusout={(event) => { if (!searchRoot?.contains(event.relatedTarget)) scheduleSearchClose(); }}>
	<form class="desktop-search-surface" class:search-error={searching && !!searchError} role="search" aria-label="Desktop search" onsubmit={submitSearch}>
		<div class="search-row">
			<div class="search-icon-space" aria-hidden="true"><Icon name="search" size={16} /></div>
			<div id="desktop-search-field" class="island-search-field" inert={!searching} aria-hidden={!searching}>
				<input bind:this={searchInput} bind:value={query} type="text" aria-label="Search the web or enter a URL"
					placeholder="Search or enter a URL" autocomplete="off" spellcheck="false"
					disabled={searchBusy} oninput={() => { searchError = ''; }} />
				<button class="island-search-go" type="submit" aria-label="Submit desktop search" disabled={!query.trim() || searchBusy} aria-busy={searchBusy}>
					<Icon name="arrow" size={16} />
				</button>
			</div>
		</div>
		{#if searching && searchError}<p class="island-search-error" role="alert">{searchError}</p>{/if}
	</form>
	<button class="desktop-search-trigger" type="button" bind:this={searchTrigger}
		aria-label="Open desktop search" aria-expanded={searching} aria-controls="desktop-search-field"
		onclick={(event) => { event.stopPropagation(); void openSearch(true); }}>
		<Icon name="search" size={16} />
	</button>
</div>
</div>

<style>
	.desktop-top-controls {
		--island-width: min(248px, calc(100vw - 136px));
		position: absolute;
		top: max(12px, env(safe-area-inset-top));
		left: 50%;
		transform: translateX(-50%);
		z-index: 10000;
		width: var(--island-width);
		height: 46px;
	}
	.dynamic-island {
		--island-open-width: min(368px, calc(100vw - 24px));
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10000;
		width: var(--island-width);
		height: 46px;
		max-width: calc(100vw - 24px);
		overflow: hidden;
		contain: layout;
		border: 1px solid #e9edde26;
		border-radius: 25px;
		background: #17271dee;
		color: #f2f4ed;
		box-shadow: 0 8px 26px #03080638, inset 0 1px 0 #ffffff08;
		backdrop-filter: blur(22px) saturate(120%);
		-webkit-backdrop-filter: blur(22px) saturate(120%);
		user-select: none;
		transition: width 360ms cubic-bezier(.22, 1, .36, 1), height 360ms cubic-bezier(.22, 1, .36, 1), left 360ms cubic-bezier(.22, 1, .36, 1), border-radius 360ms;
	}
	.dynamic-island.expanded { width: var(--island-open-width); height: 214px; border-radius: 23px; }
	.island-summary { display: flex; align-items: center; height: 44px; padding: 0 10px 0 3px; }
	.island-brand { display: grid; place-items: center; width: 40px; height: 38px; flex: none; border-radius: 50%; }
	.island-brand img { display: block; width: 32px; height: 32px; max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none; }
	.island-brand:hover { background: #ffffff0b; }
	.island-toggle { display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0; height: 38px; padding: 0 3px 0 5px; border: 0; border-radius: 19px; background: transparent; text-align: left; }
	.island-toggle:hover .island-chevron { color: #d3e5b0; }
	.desktop-search-anchor { position: absolute; top: 0; left: calc(var(--island-width) + 10px); z-index: 10001; width: 46px; height: 46px; color: #f2f4ed; }
	.desktop-search-anchor.obscured { opacity: 0; visibility: hidden; pointer-events: none; }
	.desktop-search-surface, .desktop-search-trigger { border: 1px solid #e9edde26; background: #17271dee; box-shadow: 0 8px 26px #03080638, inset 0 1px 0 #ffffff08; backdrop-filter: blur(22px) saturate(120%); -webkit-backdrop-filter: blur(22px) saturate(120%); border-radius: 24px; }
	.desktop-search-surface { position: absolute; top: 0; left: 0; width: 46px; height: 46px; padding: 0; margin: 0; overflow: hidden; transition: width 360ms cubic-bezier(.22,1,.36,1), height 250ms ease; }
	.searching .desktop-search-surface { width: 330px; }
	.desktop-search-surface.search-error { height: 78px; }
	.search-row { display: flex; align-items: center; height: 44px; padding-right: 8px; }
	.search-icon-space { display: grid; place-items: center; flex: 0 0 44px; height: 44px; color: #cbd9bc; }
	.desktop-search-trigger { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; width: 46px; height: 46px; padding: 0; color: #cbd9bc; cursor: pointer; }
	.desktop-search-anchor.searching .desktop-search-trigger { background: transparent; border-color: transparent; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
	.island-search-field { display: flex; align-items: center; flex: 1; min-width: 0; overflow: hidden; opacity: 0; visibility: hidden; }
	.searching .island-search-field { opacity: 1; visibility: visible; transition: opacity 180ms ease 80ms; }
	.desktop-search-anchor input { min-width: 0; width: 100%; height: 36px; padding: 0 7px; border: 0; outline: 0; border-radius: 10px; background: transparent; color: #f2f4ed; font: inherit; font-size: 12px; user-select: text; }
	.desktop-search-anchor input::placeholder { color: #aebba6; }
	.desktop-search-anchor input:focus-visible { background: #d3e5b009; }
	.island-search-go { display: grid; place-items: center; flex: none; width: 29px; height: 29px; margin-left: 4px; padding: 0; border: 0; border-radius: 50%; color: #cbd9bc; background: #d3e5b015; cursor: pointer; }
	.island-search-go:hover { background: #d3e5b029; }
	.island-search-go:disabled { opacity: .35; cursor: default; }
	.desktop-search-trigger:focus-visible, .island-search-go:focus-visible { outline: 2px solid #d3e5b0; outline-offset: -2px; }
	.island-search-error { margin: 0; padding: 4px 10px 10px; font-size: 11px; color: #ffb4ab; text-align: center; }
	@media(max-width:960px) {
		.searching .desktop-search-surface { top: 56px; left: calc(0px - var(--island-width) / 2 - 10px); width: min(330px, calc(100vw - 24px)); transform: translateX(-50%); }
		.desktop-search-anchor.searching::after { content: ''; position: absolute; top: 40px; right: 0; width: 46px; height: 18px; }
		.desktop-search-anchor.searching .desktop-search-trigger { background: #17271dee; border-color: #e9edde26; }
	}
	.island-label { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; font-size: 12px; font-weight: 600; letter-spacing: -.15px; }
	.island-label > span:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
	.activity-dot { width: 5px; height: 5px; flex: none; border-radius: 50%; background: #d3e5b0; box-shadow: 0 0 8px #d3e5b035; }
	time { flex: none; font-size: 11px; font-weight: 450; font-variant-numeric: tabular-nums; color: #bfc8b9; }
	.island-chevron { flex: none; color: #7b8678; transition: transform 250ms, color 150ms; }
	.expanded .island-chevron { transform: rotate(180deg); }
	.island-reveal { position: absolute; top: 44px; left: 50%; width: calc(var(--island-open-width) - 2px); opacity: 0; visibility: hidden; transform: translate(-50%, -6px); transition: opacity 110ms ease, transform 180ms ease, visibility 0s linear 180ms; }
	.expanded .island-reveal { opacity: 1; visibility: visible; transform: translate(-50%, 0); transition: opacity 180ms ease 90ms, transform 260ms cubic-bezier(.22, 1, .36, 1) 90ms, visibility 0s; }
	.island-controls { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 5px 11px 12px; }
	.island-controls > a, .island-controls > button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-width: 0; min-height: 58px; padding: 8px 4px; border: 1px solid #e9edde16; border-radius: 12px; background: #eff6df08; color: var(--os-text, #f2f1e9); text-decoration: none; font-size: 11px; line-height: 1.2; transition: background 140ms, border-color 140ms; }
	.island-controls > a > span, .island-controls > button > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.island-controls > a:hover, .island-controls > button:hover { background: #d3e5b021; border-color: #d3e5b044; }
	.island-controls > a :global(svg), .island-controls > button :global(svg) { color: var(--os-accent, #d3e5b0); }
	.island-date { margin: 0; padding: 0 10px 14px; text-align: center; color: var(--os-muted, #b9c0b3); font-size: 11px; line-height: 1.2; white-space: nowrap; }
	@media (prefers-reduced-motion: reduce) { .desktop-top-controls, .dynamic-island, .island-reveal, .island-chevron, .desktop-search-surface, .island-search-field { transition: none; } }
</style>
