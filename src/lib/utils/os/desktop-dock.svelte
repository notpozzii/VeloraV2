<script>
	import { onDestroy, tick } from 'svelte';
	import { dockMagnification } from './dock-magnification.js';
	import { DEFAULT_DOCK_HOVER_STRENGTH } from './dock-settings.js';
	let { compact = false, keepOpen = false, hoverStrength = DEFAULT_DOCK_HOVER_STRENGTH, children, tray } = $props();
	let expanded = $state(false);
	let root;
	let content;
	let trigger = $state(null);
	let closeTimer;
	let hovering = false;
	const isOpen = $derived(!compact || expanded || keepOpen);
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

<nav class="desktop-dock" class:compact class:dock-open={isOpen} aria-label="App taskbar" bind:this={root}
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
	{#if tray}<div class="taskbar-tray" inert={!isOpen} aria-hidden={!isOpen}>{@render tray()}</div>{/if}
</nav>

<style>
	.desktop-dock { --taskbar-tray-space: 104px; }
	.dock-content { display: flex; align-items: center; gap: 4px; width: max-content; min-width: 0; max-width: 100%; height: var(--dock-height); padding: 4px 6px; }
	.desktop-dock.compact { width: 100%; transition: height 220ms cubic-bezier(.22,1,.36,1); }
	.compact .dock-content { opacity: 1; visibility: visible; transition: opacity 120ms ease 80ms; }
	.desktop-dock.compact:not(.dock-open) { height: 3px; padding-top: 0; padding-bottom: 0; border: 0; }
	.compact:not(.dock-open) :is(.dock-content, .taskbar-tray) { opacity: 0; visibility: hidden; pointer-events: none; }
	.dock-compact-trigger { position: absolute; inset: 0; width: 100%; padding: 0; border: 0; background: transparent; cursor: pointer; }
	.dock-compact-trigger::before { content: ''; position: absolute; inset: -12px 0 0; }
	.dock-grip { display: block; width: 56px; height: 3px; margin: auto; border-radius: 2px; background: var(--os-accent); opacity: .6; }
	.dock-open .dock-compact-trigger { opacity: 0; visibility: hidden; pointer-events: none; }
	.taskbar-tray { position: absolute; right: 10px; top: 0; bottom: 0; display: flex; align-items: center; gap: 10px; }
	@media(max-width:760px) { .taskbar-tray { right: 8px; } }
	@media(prefers-reduced-motion:reduce) { .desktop-dock.compact,.compact .dock-content { transition: none; } }
</style>
