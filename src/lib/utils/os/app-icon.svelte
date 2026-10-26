<script>
	import Icon from '$lib/utils/browser/icon.svelte';
	let { app, size = 42 } = $props();
	const symbols = { 1: 'globe', 2: 'games', 4: 'apps', 5: 'settings' };
</script>

<span
	class="os-app-icon"
	class:browser={app.id === 1}
	class:games={app.id === 2}
	class:library={app.id === 4}
	class:settings={app.id === 5}
	class:geforce={app.id === 6}
	class:tiktok={app.id === 7}
	style:--icon-size={`${size}px`}
>
	{#if app.id === 6}
		<img src={app.icon} alt="" />
	{:else if symbols[app.id]}
		<Icon name={symbols[app.id]} size={Math.round(size * 0.53)} />
	{:else}
		<img src={app.icon} alt="" />
	{/if}
</span>

<style>
	.os-app-icon {
		--icon-size: 42px;
		display: grid;
		place-items: center;
		width: var(--icon-size);
		max-width: 100%;
		height: var(--icon-size);
		max-height: 100%;
		flex: 0 0 auto;
		overflow: hidden;
		border-radius: calc(var(--icon-size) * 0.29);
		background: #383e35;
		color: #e9eddf;
		box-shadow:
			inset 0 1px 0 #ffffff12,
			0 3px 6px #0000000d;
	}
	.browser {
		background: #d3e5b0;
		color: #35482e;
	}
	.games {
		background: #d2c6e6;
		color: #54466b;
	}
	.library {
		background: #bfd4dd;
		color: #3c5c6a;
	}
	.settings {
		background: #d9d7ce;
		color: #555951;
	}
	.geforce {
		background: #2e3927;
		color: #d3e5b0;
	}
	.tiktok {
		background: #171a17;
	}
	img {
		width: 58%;
		height: 58%;
		object-fit: contain;
	}
	.geforce img {
		filter: brightness(0) saturate(100%) invert(89%) sepia(18%) saturate(529%) hue-rotate(36deg)
			brightness(98%) contrast(91%);
	}
</style>
