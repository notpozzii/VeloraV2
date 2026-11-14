<script>
	import Desktop from '$lib/utils/os/desktop.svelte';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/utils/theme.js';
	import { installGameKeyboard } from '$lib/utils/browser/game-keyboard.js';
	import { installRestoreCoordinator } from '$lib/utils/restore-core.js';
	let ready = $state(false);
	onMount(() => {
		const restore = /^https?:$/.test(location.protocol) ? installRestoreCoordinator(window) : null;
		const theme = restore?.holding ? () => {} : initTheme();
		const keyboard = restore?.holding ? () => {} : installGameKeyboard({ document, navigator, allApps: true });
		ready = !restore?.holding;
		return () => { theme(); keyboard(); restore?.dispose(); };
	});
</script>

{#if ready}<Desktop appOrigin="https://velorastudy.s3.us-east-2.amazonaws.com" />{/if}
