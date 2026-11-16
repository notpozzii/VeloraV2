<script>
	import favicon from '$lib/assets/favicon.png';
	import '$lib/style/variables.css';
	import '$lib/style/themes.css';
	import '$lib/style/assets.css';
	import { ensureSettingsDefaults } from '$lib/utils/localspace.js';
	import { initTheme } from '$lib/utils/theme.js';
	import { onMount, setContext, tick } from 'svelte';
	import { STARTUP_CONTEXT } from '$lib/utils/startup.js';
	import { installResetCoordinator } from '$lib/utils/reset-core.js';
	import { installRestoreCoordinator } from '$lib/utils/restore-core.js';
	import { activityOwner, getActivityHub, installActivityCollector } from '$lib/utils/developer/diagnostics.js';
	import { installGameKeyboard } from '$lib/utils/browser/game-keyboard.js';
	import { installPanicKey } from '$lib/utils/panic-key.js';
	import { dev } from '$app/environment';
	import { startWebAnalytics } from '$lib/utils/web-analytics.js';
	import { isLauncherProbe } from '$lib/utils/launcher-ready.js';
	let { children } = $props();
	let opening = $state(true);
	let contentAllowed = $state(false);
	let activityEnabled = $state(false);
	let pending = 0;
	let disposeTheme = () => {};
	let disposed = false;

	setContext(STARTUP_CONTEXT, {
		hold() {
			pending += 1;
			let released = false;
			return () => {
				if (released) return;
				released = true;
				pending -= 1;
				if (contentAllowed && pending === 0) opening = false;
			};
		}
	});

	async function startContent() {
		if (contentAllowed) return;
		await ensureSettingsDefaults();
		if (disposed || contentAllowed) return;
		contentAllowed = true;
		disposeTheme = initTheme();
		await tick();
		// Lazy routes release startup once their content has mounted.
		if (pending === 0) opening = false;
	}

	onMount(() => {
		// Verification must not trigger queued data restores, resets, or analytics.
		if (isLauncherProbe(window)) {
			startContent();
			return () => { disposed = true; disposeTheme(); };
		}
		const reset = installResetCoordinator(window);
		const restore = reset.holding ? null : installRestoreCoordinator(window);
		const holding = reset.holding || restore?.holding;
		if (!holding && !dev) startWebAnalytics(window);
		const disposePanic = holding ? () => {} : installPanicKey(window);
		// Keyboard Lock is top-level only. One owner covers every app, including
		// fullscreen requests made inside nested app and browser frames.
		const disposeFullscreenKeys = !holding && window.top === window
			? installGameKeyboard({ document, navigator, allApps: true }) : () => {};
		const disposeActivity = holding ? () => {} : installActivityCollector(window);
		// Diagnostics stay available for existing opt-in users, without making
		// every visitor download their interface and speed lab at startup.
		const disposeActivityUI = !holding && activityOwner(window) === window
			? getActivityHub(window).subscribe(state => { activityEnabled = state.enabled; }) : () => {};
		if (!holding) startContent();

		return () => {
			disposed = true;
			reset.dispose();
			restore?.dispose();
			disposePanic();
			disposeFullscreenKeys();
			disposeActivity();
			disposeActivityUI();
			disposeTheme();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Home - Classroom</title>
</svelte:head>

<main class="site-content" data-velora-site inert={opening}>
	{#if contentAllowed}
		{@render children()}
	{/if}
</main>
{#if activityEnabled}
	{#await import('$lib/utils/developer/activity-console.svelte') then { default: ActivityConsole }}
		<ActivityConsole />
	{/await}
{/if}

<style>
	.site-content {
		width: 100%;
		min-height: 100vh;
	}
</style>
