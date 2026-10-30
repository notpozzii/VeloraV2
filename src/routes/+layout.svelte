<script>
	import favicon from '$lib/assets/favicon.png';
	import '$lib/style/variables.css';
	import '$lib/style/themes.css';
	import '$lib/style/assets.css';
	import { initTheme } from '$lib/utils/theme.js';
	import { onMount, setContext, tick } from 'svelte';
	import { STARTUP_CONTEXT } from '$lib/utils/startup.js';
	import { installResetCoordinator } from '$lib/utils/reset-core.js';
	import { installActivityCollector } from '$lib/utils/developer/diagnostics.js';
	import ActivityConsole from '$lib/utils/developer/activity-console.svelte';
	import { installGameKeyboard } from '$lib/utils/browser/game-keyboard.js';
	let { children } = $props();
	let opening = $state(true);
	let contentAllowed = $state(false);
	let pending = 0;
	let disposeTheme = () => {};

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
		contentAllowed = true;
		disposeTheme = initTheme();
		await tick();
		// Lazy routes release startup once their content has mounted.
		if (pending === 0) opening = false;
	}

	onMount(() => {
		const reset = installResetCoordinator(window);
		// Keyboard Lock is top-level only. One owner covers every app, including
		// fullscreen requests made inside nested app and browser frames.
		const disposeFullscreenKeys = !reset.holding && window.top === window
			? installGameKeyboard({ document, navigator, allApps: true }) : () => {};
		const disposeActivity = reset.holding ? () => {} : installActivityCollector(window);
		if (!reset.holding) startContent();

		return () => {
			reset.dispose();
			disposeFullscreenKeys();
			disposeActivity();
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
<ActivityConsole />

<style>
	.site-content {
		width: 100%;
		min-height: 100vh;
	}
</style>
