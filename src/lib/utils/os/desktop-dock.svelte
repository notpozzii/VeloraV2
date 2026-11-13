<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import Icon from '$lib/utils/browser/icon.svelte';
	let { compact = false, keepOpen = false, children } = $props();
	let expanded = $state(false);
	let contentWidth = $state(0);
	let root;
	let content;
	let trigger = $state(null);
	let closeTimer;
	let hovering = false;
	const isOpen = $derived(!compact || expanded || keepOpen);
	$effect(() => { if (!compact) expanded = false; });
	onMount(() => {
		const measure = () => { contentWidth = Math.ceil(content.getBoundingClientRect().width); };
		const observer = new ResizeObserver(measure);
		observer.observe(content);
		measure();
		return () => observer.disconnect();
	});
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

<nav class="desktop-dock" class:compact class:dock-open={isOpen} aria-label="App dock" bind:this={root}
	style:--dock-content-width={`${contentWidth}px`}
	onpointerenter={enter} onpointerleave={leave}
	onfocusout={(event) => { if (!root?.contains(event.relatedTarget)) scheduleClose(); }}>
	{#if compact}
		<button class="dock-compact-trigger" type="button" bind:this={trigger} onclick={open}
			aria-label="Expand app dock" aria-expanded={isOpen} aria-controls="desktop-dock-content"
			aria-hidden={isOpen} inert={isOpen}>
			<Icon name="apps" size={17} /><span>Apps</span>
			<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 7.5 3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	{/if}
	<div class="dock-content" id="desktop-dock-content" bind:this={content} inert={!isOpen} aria-hidden={!isOpen}>
		{@render children()}
	</div>
</nav>

<style>
	.desktop-dock { --dock-padding: 10px; --dock-viewport-gap: 28px; }
	.dock-content { display: flex; align-items: center; gap: 8px; width: max-content; min-width: 0; max-width: calc(100vw - var(--dock-viewport-gap) - var(--dock-padding) - var(--dock-padding) - 2px); height: calc(var(--dock-height) - 14px); }
	.desktop-dock.compact { width: calc(var(--dock-content-width) + var(--dock-padding) + var(--dock-padding) + 2px); transition: width 360ms cubic-bezier(.22,1,.36,1), height 360ms cubic-bezier(.22,1,.36,1), border-radius 360ms; }
	.compact .dock-content { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); opacity: 1; visibility: visible; transition: opacity 160ms ease 100ms, visibility 0s; }
	.desktop-dock.compact:not(.dock-open) { width: 112px; height: 38px; padding: 0; border-radius: 22px; }
	.compact:not(.dock-open) .dock-content { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 90ms ease, visibility 0s linear 100ms; }
	.dock-compact-trigger { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; padding: 0 12px; border: 0; border-radius: inherit; background: transparent; color: var(--os-text); font-size: 12px; cursor: pointer; transition: opacity 100ms ease 100ms; }
	.dock-compact-trigger :global(svg) { flex: none; color: var(--os-accent); }
	.dock-open .dock-compact-trigger { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 80ms ease; }
	@media(max-width:480px) { .desktop-dock { --dock-padding: 6px; --dock-viewport-gap: 16px; } .dock-content { gap: 3px; } }
	@media(prefers-reduced-motion:reduce) { .desktop-dock.compact,.compact .dock-content,.dock-compact-trigger { transition: none; } }
</style>
