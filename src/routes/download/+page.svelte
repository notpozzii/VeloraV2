<script>
	import Icon from '$lib/utils/browser/icon.svelte';
</script>

<svelte:head>
	<title>Velora — Downloads</title>
	<meta name="description" content="Download the Velora HTML or SVG launcher." />
</svelte:head>

<main class="downloads">
	<div class="download-content">
		<header class="download-header">
			<a class="wordmark" href="/os"><span aria-hidden="true">v.</span> Velora</a>
			<a class="back" href="/os" target="_top"><Icon name="back" size={15} /> Desktop</a>
		</header>
		<section aria-labelledby="download-title">
			<h1 id="download-title">Download Velora</h1>
			<p class="intro">Both files open your online desktop. Internet required.</p>
			<div class="files">
				<a class="file" href="/download/files/index.html" download="index.html" data-sveltekit-reload aria-label="Download index.html">
					<span class="format" aria-hidden="true">HTML</span>
					<strong>index.html</strong>
					<span class="action">Download <Icon name="arrow" size={17} /></span>
				</a>
				<a class="file" href="/download/files/velora.svg" download="velora.svg" data-sveltekit-reload aria-label="Download velora.svg">
					<span class="format" aria-hidden="true">SVG</span>
					<strong>velora.svg</strong>
					<span class="action">Download <Icon name="arrow" size={17} /></span>
				</a>
			</div>
		</section>
	</div>
</main>

<style>
	.downloads { min-height: 100dvh; padding: 0 24px 48px; background: #191c17; color: #eeeae1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
	.downloads, .downloads * { box-sizing: border-box; }
	.download-content { width: 100%; max-width: 720px; margin: 0 auto; }
	.download-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 0; border-bottom: 1px solid #ffffff0c; }
	.wordmark { display: flex; align-items: center; gap: 9px; color: #eeeae1; font-size: 16px; font-weight: 550; text-decoration: none; }
	.wordmark > span { font: italic bold 28px/1 Georgia, serif; color: #d3e5b0; letter-spacing: -4px; padding-right: 4px; }
	.back { display: flex; align-items: center; gap: 7px; color: #a3ab97; font-size: 12px; text-decoration: none; }
	.back:hover { color: #eeeae1; }
	section { padding-top: clamp(36px, 7vh, 64px); }
	h1 { margin: 0; font-size: clamp(28px, 5vw, 36px); font-weight: 500; line-height: 1.2; letter-spacing: -1px; }
	.intro { margin: 12px 0 28px; color: #a3ab97; font-size: 13px; line-height: 1.6; }
	.files { display: grid; gap: 12px; }
	.file { display: flex; align-items: center; gap: 16px; min-height: 82px; padding: 18px 20px; border: 1px solid #d3e5b01c; border-radius: 10px; background: #242820; color: inherit; text-decoration: none; transition: background 160ms ease, border-color 160ms ease; }
	.file:hover { background: #2b3125; border-color: #d3e5b04d; }
	a:focus-visible { outline: 2px solid #d3e5b0; outline-offset: 4px; border-radius: 5px; }
	.format { display: grid; place-items: center; width: 48px; height: 44px; flex: none; border-radius: 7px; background: #d3e5b00c; color: #b7c7a1; font: 500 10px/1 monospace; }
	.file strong { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; }
	.action { display: flex; align-items: center; gap: 8px; color: #d3e5b0; font-size: 12px; white-space: nowrap; }
	@media (max-width: 420px) { .downloads { padding-inline: 18px; } .file { gap: 12px; padding: 16px 14px; } .format { width: 39px; } .file strong { font-size: 13px; } .action { font-size: 11px; gap: 5px; } }
	@media (prefers-reduced-motion: reduce) { .file { transition: none; } }
</style>
