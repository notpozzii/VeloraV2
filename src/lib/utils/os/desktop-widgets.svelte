<script>
	import { onMount } from 'svelte';
	import AppIcon from './app-icon.svelte';
	import Icon from '$lib/utils/browser/icon.svelte';

	let { apps, windows = [], hydrated = false, onlaunch, onfocus } = $props();
	let duration = $state(25);
	let remaining = $state(25 * 60);
	let running = $state(false);
	let deadline = 0;
	const minutes = $derived(String(Math.floor(remaining / 60)).padStart(2, '0'));
	const seconds = $derived(String(remaining % 60).padStart(2, '0'));
	const progress = $derived(1 - remaining / (duration * 60));
	const recent = $derived(windows.slice(-3).reverse());

	function tick() {
		if (!running) return;
		remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
		if (remaining === 0) running = false;
	}
	function toggleTimer() {
		if (running) { tick(); running = false; }
		else {
			if (!remaining) remaining = duration * 60;
			deadline = Date.now() + remaining * 1000;
			running = true;
		}
	}
	function resetTimer(value = duration) {
		duration = value;
		remaining = value * 60;
		running = false;
	}
	onMount(() => {
		const timer = setInterval(tick, 250);
		return () => clearInterval(timer);
	});
</script>

<section class="focus-widget glass-widget" aria-label="Focus timer">
	<div class="widget-heading"><span><span class="widget-dot"></span>Focus</span><span class="widget-tag">{running ? 'IN SESSION' : remaining === 0 ? 'COMPLETE' : 'TIMER'}</span></div>
	<div class="focus-display">
		<svg viewBox="0 0 120 120" class="focus-ring" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-track" /><circle cx="60" cy="60" r="52" class="ring-progress" stroke-dasharray="326.726" stroke-dashoffset={326.726 * progress} /></svg>
		<div class="focus-digits" role="timer" aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}>{minutes}<span>:</span>{seconds}</div>
	</div>
	<div class="focus-presets" aria-label="Focus duration">{#each [15, 25, 45] as value}<button aria-label={`${value} minute focus timer`} aria-pressed={duration === value} class:selected={duration === value} onclick={() => resetTimer(value)}>{value} min</button>{/each}</div>
	<div class="focus-actions"><button class="focus-start" onclick={toggleTimer}><Icon name={running ? 'pause' : 'play'} size={14} />{running ? 'Pause' : remaining < duration * 60 && remaining > 0 ? 'Resume' : 'Start focus'}</button><button class="focus-reset" onclick={() => resetTimer()} aria-label="Reset focus timer"><Icon name="reload" size={17} /></button></div>
</section>

<section class="session-widget glass-widget" aria-label="Open windows">
	<div class="widget-heading"><span>Open windows</span><span class="window-count">{windows.length.toString().padStart(2, '0')}</span></div>
	{#if recent.length}
		<div class="session-list">{#each recent as win (win.id)}{@const app = apps.find((entry) => entry.id === (win.parentApp ?? win.sender))}<button onclick={() => onfocus(win.sender)} aria-label={`Switch to ${win.name}`}>
			{#if app}<AppIcon {app} size={32} />{:else}<span class="session-fallback"><Icon name="desktop" size={17} /></span>{/if}
			<span><strong>{win.name}</strong><small>{win.minimized ? 'Minimized' : 'Open'}</small></span><Icon name="arrow" size={14} />
		</button>{/each}</div>
	{:else}
		<div class="session-empty"><span class="empty-window"><Icon name="desktop" size={24} /></span><p>No open windows</p><button onclick={() => onlaunch(apps[0])} disabled={!hydrated}>Open browser <Icon name="arrow" size={13} /></button></div>
	{/if}
</section>

<style>
	.glass-widget { width: 288px; border: 1px solid #ffffff24; border-radius: 25px; background: linear-gradient(125deg, #e7ede510, #9db3a006), #17211eb5; backdrop-filter: blur(28px) saturate(120%); -webkit-backdrop-filter: blur(28px) saturate(120%); box-shadow: 0 14px 50px #07110f24, inset 0 1px 0 #ffffff0b; padding: 21px; color: #f2f3ed; }
	.widget-heading { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 500; }
	.widget-heading > span:first-child { display: flex; align-items: center; gap: 7px; }
	.widget-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--os-accent); box-shadow: 0 0 12px #d3e5b04d; }
	.widget-tag { color: #c0ccbe; font-size: 8px; letter-spacing: 1.4px; }
	.focus-display { display: grid; place-items: center; height: 152px; position: relative; margin-top: 4px; }
	.focus-ring { width: 140px; height: 140px; position: absolute; transform: rotate(-90deg); overflow: visible; }
	.focus-ring circle { fill: none; stroke-width: 2; }
	.ring-track { stroke: #ffffff12; }
	.ring-progress { stroke: var(--os-accent); stroke-linecap: round; transition: stroke-dashoffset 500ms linear; filter: drop-shadow(0 0 4px #d3e5b033); }
	.focus-digits { font: 300 36px/1 system-ui, sans-serif; letter-spacing: -1.8px; font-variant-numeric: tabular-nums; }
	.focus-digits span { color: #f2f3ed66; padding: 0 2px; }
	.focus-presets { display: flex; justify-content: center; gap: 7px; margin: 1px 0 17px; }
	.focus-presets button { padding: 5px 9px; border: 1px solid transparent; background: transparent; border-radius: 7px; font-size: 10px; color: #b4c3b6; }
	.focus-presets button.selected { background: #ffffff0c; color: #edf2e5; border-color: #ffffff12; }
	.focus-presets button:hover { background: #ffffff12; }
	.focus-actions { display: flex; gap: 8px; }
	.focus-start { display: flex; align-items: center; justify-content: center; gap: 8px; flex: 1; padding: 11px; font-weight: 600; font-size: 11px; border: 0; border-radius: 11px; background: var(--os-accent); color: #253526; }
	.focus-start:hover { filter: brightness(1.06); }
	.focus-reset { width: 39px; border: 1px solid #ffffff1f; border-radius: 11px; background: #ffffff05; display: grid; place-items: center; color: #c2cfbf; }
	.focus-reset:hover { background: #ffffff12; }
	.window-count { background: #ffffff0c; border: 1px solid #ffffff13; font-size: 10px; border-radius: 6px; padding: 3px 5px; color: #c4d1bc; }
	.session-widget { padding-bottom: 15px; }
	.session-list { display: grid; gap: 3px; margin-top: 14px; }
	.session-list button { display: flex; align-items: center; width: 100%; gap: 10px; padding: 8px 0; border: 0; border-radius: 9px; text-align: left; background: transparent; }
	.session-list button:hover { background: #ffffff09; }
	.session-list button > span:not(.session-fallback) { min-width: 0; display: grid; gap: 4px; flex: 1; }
	.session-list strong { font-size: 11px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.session-list small { font-size: 9px; color: #a8b7a9; }
	.session-list :global(button > svg) { color: #c6d3c2; }
	.session-empty { display: flex; flex-direction: column; align-items: center; padding: 15px 0 2px; }
	.empty-window { color: #cfddc99c; display: grid; place-items: center; width: 48px; height: 42px; }
	.session-empty p { margin: 5px 0 11px; font-size: 11px; color: #c8d2c5; }
	.session-empty button { display: flex; align-items: center; gap: 9px; color: var(--os-accent); background: transparent; border: 0; font-size: 10px; padding: 5px; }
	.session-fallback { width: 32px; height: 32px; display: grid; place-items: center; background: #ffffff0d; border-radius: 9px; }
	@media (max-height: 740px) { .focus-display { height: 124px; } .focus-ring { width: 112px; height: 112px; } .focus-digits { font-size: 30px; } .glass-widget { padding: 16px; } .session-empty { padding-top: 6px; } }
	@media (prefers-reduced-motion: reduce) { .ring-progress { transition: none; } }
</style>
