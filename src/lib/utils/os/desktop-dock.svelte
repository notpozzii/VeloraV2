<script>
	import { onDestroy, tick } from 'svelte';
	import { dockMagnification } from './dock-magnification.js';
	import { DEFAULT_DOCK_HOVER_STRENGTH } from './dock-settings.js';
	import Icon from '$lib/utils/browser/icon.svelte';
	let { compact = false, keepOpen = false, hoverStrength = DEFAULT_DOCK_HOVER_STRENGTH, onsearch, searchDisabled = false, children } = $props();
	let expanded = $state(false);
	let searchHover = $state(false);
	let searchFocused = $state(false);
	let searchQuery = $state('');
	let searchBusy = $state(false);
	let searchError = $state('');
	let searchInput;
	let root;
	let content;
	let trigger = $state(null);
	let closeTimer;
	let hovering = false;
	const isOpen = $derived(!compact || expanded || keepOpen);
	const searchOpen = $derived(searchHover || searchFocused || !!searchQuery || searchBusy);
	$effect(() => { if (!compact) expanded = false; });
	onDestroy(() => clearTimeout(closeTimer));
	function enter(event) {
		if (event.pointerType !== 'mouse') return;
		hovering = true;
		clearTimeout(closeTimer);
		expanded = true;
	}
	function scheduleClose() {
		clearTimeout(closeTimer);
		closeTimer = setTimeout(() => {
			if (!hovering && !root?.contains(document.activeElement)) expanded = false;
		}, 180);
	}
	function leave(event) {
		if (event.pointerType !== 'mouse') return;
		hovering = false;
		scheduleClose();
	}
	async function open() {
		clearTimeout(closeTimer);
		expanded = true;
		await tick();
		content?.querySelector('button:not(:disabled),a[href]')?.focus();
	}
	async function submitSearch(event) {
		event.preventDefault();
		const query = searchQuery.trim();
		if (!query || searchBusy || searchDisabled) return;
		searchBusy = true;
		searchError = '';
		try {
			if (await onsearch?.(query)) {
				searchQuery = '';
				searchHover = false;
				searchInput?.blur();
			} else {
				searchError = 'The browser could not open. Try again.';
			}
		} catch (error) {
			searchError = error?.message || 'The browser could not open. Try again.';
		} finally {
			searchBusy = false;
		}
	}
</script>

<svelte:window
	onclick={(event) => { if (event.target instanceof Node && !root?.contains(event.target)) expanded = false; }}
	onkeydown={async (event) => {
		if (event.key !== 'Escape' || !compact || !expanded || keepOpen) return;
		const returnFocus = root?.contains(document.activeElement);
		expanded = false;
		if (returnFocus) { await tick(); trigger?.focus(); }
	}}
/>

<nav class="desktop-dock" class:compact class:dock-open={isOpen} class:search-open={searchOpen} aria-label="App taskbar" bind:this={root}
	use:dockMagnification={{ enabled: isOpen, strength: hoverStrength }}
	onpointerenter={enter} onpointerleave={leave}
	onfocusout={(event) => { if (!root?.contains(event.relatedTarget)) scheduleClose(); }}>
	{#if compact}
		<button class="dock-compact-trigger" type="button" bind:this={trigger} onclick={open}
			aria-label="Show taskbar" aria-expanded={isOpen} aria-controls="desktop-dock-content"
			aria-hidden={isOpen} inert={isOpen} title="Show taskbar">
			<span class="dock-grip" aria-hidden="true"></span>
		</button>
	{/if}
	<div class="dock-content" id="desktop-dock-content" bind:this={content} inert={!isOpen} aria-hidden={!isOpen}>
		{@render children()}
	</div>
	<form class="dock-search" class:expanded={searchOpen} onsubmit={submitSearch}
		onpointerenter={() => (searchHover = true)} onpointerleave={() => (searchHover = false)}
		onfocusin={() => (searchFocused = true)}
		onfocusout={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) searchFocused = false; }}>
		<button type="button" aria-label="Search Velora" aria-expanded={searchOpen} disabled={searchDisabled}
			onclick={async () => { searchHover = true; await tick(); searchInput?.focus(); }}><Icon name="search" size={18} /></button>
		<input bind:this={searchInput} bind:value={searchQuery} aria-label="Search the web or enter a URL"
			placeholder="Search the web or enter a URL" autocomplete="off" spellcheck="false"
			tabindex={searchOpen ? 0 : -1} disabled={searchDisabled || searchBusy}
			oninput={() => (searchError = '')}
			onkeydown={(event) => {
				if (event.key === 'Escape') { searchQuery = ''; searchHover = false; searchInput?.blur(); }
			}} />
		{#if searchBusy}<span class="search-working" role="status">Opening…</span>{/if}
		{#if searchError}<span class="search-error" role="alert">{searchError}</span>{/if}
	</form>
</nav>

<style>
	.dock-content { display: flex; align-items: center; gap: 4px; width: max-content; min-width: 0; max-width: calc(100% - 68px); height: var(--dock-height); padding: 4px 6px; transition: max-width 240ms cubic-bezier(.22,1,.36,1); }
	.search-open .dock-content { max-width: calc(100% - min(280px, 45vw) - 28px); }
	.dock-search { position: relative; display: flex; align-items: center; flex: 0 0 40px; width: 40px; height: 40px; overflow: visible; border: 1px solid rgba(237, 244, 221, .14); border-radius: 12px; background: rgba(20, 31, 25, calc(var(--glass-opacity, .75) * .8)); backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturation, 130%)); -webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturation, 130%)); color: #e7f0dc; transition: width 240ms cubic-bezier(.22,1,.36,1), flex-basis 240ms cubic-bezier(.22,1,.36,1), border-color 180ms ease; }
	.dock-search.expanded { flex-basis: min(280px, 45vw); width: min(280px, 45vw); border-color: rgba(237, 244, 221, .28); }
	.dock-search button { display: grid; place-items: center; flex: 0 0 38px; width: 38px; height: 38px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
	.dock-search input { min-width: 0; width: 0; flex: 1; height: 100%; padding: 0 10px 0 0; border: 0; outline: 0; background: transparent; color: inherit; font: 13px system-ui, sans-serif; opacity: 0; transition: opacity 140ms ease; }
	.dock-search.expanded input { opacity: 1; }
	.dock-search input::placeholder { color: #c2ccba; }
	.dock-search:focus-within { outline: 2px solid var(--os-accent); outline-offset: 2px; }
	.search-working, .search-error { position: absolute; bottom: calc(100% + 8px); left: 0; padding: 7px 10px; border-radius: 7px; background: #1f2922; color: #eff1e5; white-space: nowrap; font-size: 11px; }
	.search-error { color: #ffb8aa; }
	.desktop-dock.compact { width: 100%; transition: height 220ms cubic-bezier(.22,1,.36,1); }
	.compact .dock-content { opacity: 1; visibility: visible; transition: opacity 120ms ease 80ms; }
	.desktop-dock.compact:not(.dock-open) { height: 3px; padding-top: 0; padding-bottom: 0; border: 0; }
	.compact:not(.dock-open) .dock-content { opacity: 0; visibility: hidden; pointer-events: none; }
	.compact:not(.dock-open) .dock-search { opacity: 0; visibility: hidden; pointer-events: none; }
	.dock-compact-trigger { position: absolute; inset: 0; width: 100%; padding: 0; border: 0; background: transparent; cursor: pointer; }
	.dock-compact-trigger::before { content: ''; position: absolute; inset: -12px 0 0; }
	.dock-grip { display: block; width: 56px; height: 3px; margin: auto; border-radius: 2px; background: var(--os-accent); opacity: .6; }
	.dock-open .dock-compact-trigger { opacity: 0; visibility: hidden; pointer-events: none; }
	@media(prefers-reduced-motion:reduce) { .desktop-dock.compact,.dock-content,.dock-search,.dock-search input { transition: none; } }
</style>
