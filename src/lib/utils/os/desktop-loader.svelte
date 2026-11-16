<script>
	import { getContext, onMount, tick } from 'svelte';
	import { STARTUP_CONTEXT } from '$lib/utils/startup.js';
	import { notifyLauncherReady } from '$lib/utils/launcher-ready.js';

	/** @type {import('svelte').Component | null} */
	let Desktop = $state(null);
	let failed = $state(false);
	const startup = getContext(STARTUP_CONTEXT);
	// Register during component creation, before the layout checks readiness.
	const release = startup?.hold();

	onMount(() => {
		let disposed = false;
		async function loadDesktop() {
			try {
				const module = await import('./desktop.svelte');
				if (disposed) return;
				Desktop = module.default;
				await tick();
				if (!disposed) notifyLauncherReady(window);
			} catch (error) {
				if (disposed) return;
				console.error('Unable to load the Velora desktop', error);
				failed = true;
				await tick();
			} finally {
				if (!disposed) release?.();
			}
		}
		loadDesktop();
		return () => {
			disposed = true;
			release?.();
		};
	});
</script>

{#if Desktop}
	<Desktop />
{:else if failed}
	<section class="startup-error" role="alert">
		<h1>Velora couldn’t load.</h1>
		<p>Check your connection and try again.</p>
		<button onclick={() => window.location.reload()}>Try again</button>
	</section>
{/if}

<style>
	.startup-error {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #181e1b;
		color: #eeefe8;
		font-family: system-ui, sans-serif;
		text-align: center;
		padding: 24px;
	}
	h1 {
		font-size: 24px;
		font-weight: 500;
	}
	p {
		color: #b5beb1;
	}
	button {
		margin-top: 15px;
		padding: 12px 22px;
		border: 1px solid #d6c5a566;
		border-radius: 8px;
		background: #d6c5a5;
		color: #222820;
		font: inherit;
		cursor: pointer;
	}
</style>
