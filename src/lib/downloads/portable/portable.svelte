<script>
	import Desktop from '$lib/utils/os/desktop.svelte';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/utils/theme.js';
	import { installGameKeyboard } from '$lib/utils/browser/game-keyboard.js';
	import { installRestoreCoordinator } from '$lib/utils/restore-core.js';
	const standaloneAppOrigin = 'https://velorastudy.s3.us-east-2.amazonaws.com';
	const directMode = location.hostname === 'cdn.jsdelivr.net';
	let appOrigin = $state();

	async function resolveAppOrigin(signal) {
		if (!/^https?:$/.test(location.protocol)) return standaloneAppOrigin;
		try {
			const worker = await fetch('/servy.js', { method: 'HEAD', redirect: 'error', signal });
			const contentType = worker.headers.get('Content-Type') || '';
			if (worker.ok && /^(?:text|application)\/javascript\b/i.test(contentType)) return '';
		} catch {
			// An SVG served without the app routes needs the standalone host.
		}
		return standaloneAppOrigin;
	}

	onMount(() => {
		const restore = /^https?:$/.test(location.protocol) ? installRestoreCoordinator(window) : null;
		if (restore?.holding) return () => restore.dispose();
		const theme = initTheme();
		const keyboard = installGameKeyboard({ document, navigator, allApps: true });
		const lookup = new AbortController();
		let disposed = false;
		const deadline = setTimeout(() => lookup.abort(), 2000);
		void resolveAppOrigin(lookup.signal).then((origin) => {
			clearTimeout(deadline);
			if (!disposed) appOrigin = origin;
		});
		return () => {
			disposed = true;
			clearTimeout(deadline);
			lookup.abort();
			theme();
			keyboard();
			restore?.dispose();
		};
	});
</script>

{#if appOrigin !== undefined}<Desktop {appOrigin} {directMode} />{/if}
