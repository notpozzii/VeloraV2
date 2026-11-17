<script>
	import Icon from '$lib/utils/browser/icon.svelte';
	import veloraMark from '$lib/assets/velora-mark.svg';

	let {
		time = '', date = '', shortDate = '', browserUrl = '/slate', downloadUrl = '/download',
		external = false, fullscreen = false, open = $bindable(false), onexpand = () => {},
		onglass = (_event) => {}, onwidgets = (_event) => {},
		onfullscreen = (_event) => {}, onwallpaper = (_event) => {},
		onsearch = async (_query) => false
	} = $props();
	let trigger;
	let panel;
	let query = $state('');
	let searchBusy = $state(false);
	let searchError = $state('');

	function close(event) {
		event?.stopPropagation();
		panel?.close();
		open = false;
		searchError = '';
	}
	function toggle(event) {
		event.stopPropagation();
		if (open) close();
		else { open = true; onexpand(); }
	}
	function action(event, callback) {
		close(event);
		callback(event);
	}
	async function submitSearch(event) {
		event.preventDefault();
		event.stopPropagation();
		const value = query.trim();
		if (!value || searchBusy) return;
		searchBusy = true;
		searchError = '';
		try {
			if (await onsearch(value)) { query = ''; close(); }
			else searchError = 'Could not open search. Please try again.';
		} catch { searchError = 'Could not open search. Please try again.'; }
		finally { searchBusy = false; }
	}
</script>

<button class="taskbar-clock" type="button" bind:this={trigger} onclick={toggle}
	aria-label={open ? 'Close desktop controls' : 'Open desktop controls'}
	aria-description={`${time}, ${date}`} aria-haspopup="dialog" aria-expanded={open}
	aria-controls="desktop-controls-panel" title={date}>
	<span>{time}</span><span>{shortDate}</span>
</button>

{#if open}
	<dialog class="clock-controls" id="desktop-controls-panel" aria-label="Desktop controls"
		bind:this={panel} onclose={() => { open = false; searchError = ''; }}
		onclick={(event) => {
			event.stopPropagation();
			if (event.target !== event.currentTarget) return;
			const bounds = event.currentTarget.getBoundingClientRect();
			if (event.clientX < bounds.left || event.clientX > bounds.right ||
				event.clientY < bounds.top || event.clientY > bounds.bottom) close();
		}}
		{@attach (node) => {
			node.showModal();
			node.querySelector('input')?.focus();
			return () => { node.close(); if (trigger?.isConnected) trigger.focus(); };
		}}>
		<div class="controls-heading">
			<a class="controls-brand" href="https://discord.gg/3vcMsqJMd" target="_blank" rel="noopener noreferrer"
				aria-label="Join Velora on Discord" onclick={close}>
				<img src={veloraMark} width="26" height="26" alt="" /><span>velora</span>
			</a>
			<button class="controls-close" type="button" aria-label="Close desktop controls" onclick={close}><Icon name="close" size={17} /></button>
		</div>
		<p class="controls-date">{date}</p>
		<form class="controls-search" role="search" aria-label="Desktop search" onsubmit={submitSearch}>
			<Icon name="search" size={16} />
			<input bind:value={query} aria-label="Search the web or enter a URL" placeholder="Search or enter a URL"
				autocomplete="off" spellcheck="false" disabled={searchBusy} oninput={() => { searchError = ''; }} />
			<button type="submit" aria-label="Submit desktop search" disabled={!query.trim() || searchBusy} aria-busy={searchBusy}><Icon name="arrow" size={16} /></button>
		</form>
		{#if searchError}<p class="controls-error" role="alert">{searchError}</p>{/if}
		<nav class="controls-grid" aria-label="Desktop shortcuts">
			<a href={browserUrl} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined} onclick={close}><Icon name="globe" size={19} /><span>Browser</span></a>
			<button type="button" data-widget-picker-toggle onclick={(event) => action(event, onwidgets)} aria-label="Add desktop widgets" aria-haspopup="dialog"><Icon name="widgets" size={19} /><span>Widgets</span></button>
			<button type="button" onclick={(event) => action(event, onfullscreen)} aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}><Icon name="fullscreen" size={19} /><span>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button>
			<button type="button" onclick={(event) => action(event, onglass)} aria-label="Adjust liquid glass" aria-haspopup="dialog"><Icon name="settings" size={19} /><span>Glass</span></button>
			<button type="button" onclick={(event) => action(event, onwallpaper)} aria-label="Change wallpaper" aria-haspopup="dialog"><Icon name="desktop" size={19} /><span>Wallpaper</span></button>
			<a href={downloadUrl} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined} onclick={close}><Icon name="download" size={19} /><span>Download</span></a>
		</nav>
	</dialog>
{/if}

<style>
	.clock-controls {
		position: fixed;
		inset: auto 10px calc(var(--dock-height) + 12px) auto;
		margin: 0;
		width: min(352px, calc(100vw - 20px));
		max-height: calc(100dvh - var(--dock-height) - 28px);
		overflow: auto;
		padding: 18px;
		border: 1px solid rgba(240, 250, 232, var(--glass-border, .22));
		border-radius: 14px;
		background: rgba(20, 31, 25, var(--glass-opacity, .85));
		color: var(--os-text, #f2f4ed);
		backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturation, 130%));
		-webkit-backdrop-filter: blur(var(--glass-blur, 24px)) saturate(var(--glass-saturation, 130%));
		box-shadow: 0 12px 36px #07110a40;
		animation: controls-in 160ms ease;
	}
	.clock-controls::backdrop { background: transparent; backdrop-filter: none; }
	.controls-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.controls-brand { display: flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; font-size: 14px; font-weight: 600; }
	.controls-brand img { display: block; object-fit: contain; }
	.controls-close { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; color: var(--os-muted, #b9c0b3); background: transparent; }
	.controls-close:hover { color: inherit; background: #ffffff0d; }
	.controls-date { margin: 10px 0 16px; font-size: 12px; line-height: 1.4; color: var(--os-muted, #b9c0b3); }
	.controls-search { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 8px 0 11px; border: 1px solid #e9edde22; border-radius: 8px; background: #07110a26; color: var(--os-muted, #b9c0b3); }
	.controls-search:focus-within { border-color: var(--os-accent, #d3e5b0); }
	.controls-search input { flex: 1; min-width: 0; width: 100%; border: 0; outline: 0; padding: 0; color: var(--os-text, #f2f4ed); background: transparent; font: inherit; font-size: 12px; }
	.controls-search input::placeholder { color: var(--os-muted, #b9c0b3); }
	.controls-search button { display: grid; place-items: center; flex: none; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 5px; color: var(--os-accent, #d3e5b0); background: #d3e5b015; }
	.controls-search button:disabled { opacity: .35; }
	.controls-error { margin: 8px 0 0; color: #ffb4ab; font-size: 11px; }
	.controls-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-top: 14px; }
	.controls-grid > a, .controls-grid > button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-width: 0; min-height: 62px; padding: 9px 4px; border: 1px solid #e9edde16; border-radius: 9px; background: #eff6df08; color: inherit; text-decoration: none; font-size: 11px; line-height: 1.2; }
	.controls-grid > a:hover, .controls-grid > button:hover { background: #d3e5b021; border-color: #d3e5b044; }
	.controls-grid :global(svg) { color: var(--os-accent, #d3e5b0); }
	.clock-controls :is(button, a):focus-visible { outline: 2px solid var(--os-accent, #d3e5b0); outline-offset: 2px; }
	@keyframes controls-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
	@media (max-width: 480px) { .clock-controls { right: 8px; bottom: calc(var(--dock-height) + 8px); width: min(352px, calc(100vw - 16px)); max-height: calc(100dvh - var(--dock-height) - 20px); } }
	@media (prefers-reduced-motion: reduce) { .clock-controls { animation: none; } }
</style>
