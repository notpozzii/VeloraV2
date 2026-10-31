<script>
	import Desktop from '$lib/utils/os/desktop.svelte';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/utils/theme.js';
	import { installGameKeyboard } from '$lib/utils/browser/game-keyboard.js';
	let note = $state(true);
	onMount(() => {
		const theme = initTheme();
		const keyboard = installGameKeyboard({ document, navigator, allApps: true });
		return () => { theme(); keyboard(); };
	});
</script>

<Desktop appOrigin="https://velorastudy.s3.us-east-2.amazonaws.com" />
{#if note}
	<aside class="portable-note" aria-label="Downloaded desktop">
		<span>Desktop runs from this file. Online apps need internet.</span>
		<button aria-label="Dismiss downloaded desktop note" onclick={() => (note = false)}>×</button>
	</aside>
{/if}

<style>
	.portable-note { position: fixed; bottom: 130px; left: 50%; transform: translateX(-50%); z-index: 10001; display: flex; align-items: center; gap: 14px; width: max-content; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 10px 14px; border: 1px solid #d3e5b03b; border-radius: 12px; background: #17221cf2; color: #e8efdf; font: 12px/1.5 system-ui, sans-serif; box-shadow: 0 8px 24px #0003; }
	button { border: 0; background: transparent; color: inherit; font: 22px/1 system-ui; cursor: pointer; padding: 3px; }
	button:focus-visible { outline: 2px solid #d3e5b0; }
</style>
