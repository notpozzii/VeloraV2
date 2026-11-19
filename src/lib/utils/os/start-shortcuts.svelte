<script>
	import Icon from '$lib/utils/browser/icon.svelte';
	let {
		fullscreen = false, downloadUrl = '/download', external = false,
		onclose = () => {}, onbrowser = () => {}, onwidgets = (_event) => {},
		onfullscreen = (_event) => {}, onglass = (_event) => {}, onwallpaper = () => {}
	} = $props();
	function action(event, callback) {
		event.stopPropagation();
		onclose();
		callback(event);
	}
</script>

<nav class="start-shortcuts" id="start-shortcuts" aria-label="Desktop shortcuts">
	<button type="button" onclick={(event) => action(event, onbrowser)}><Icon name="globe" size={16} /><span>Browser</span></button>
	<button type="button" data-widget-picker-toggle onclick={(event) => action(event, onwidgets)} aria-label="Add desktop widgets" aria-haspopup="dialog"><Icon name="widgets" size={16} /><span>Widgets</span></button>
	<button type="button" onclick={(event) => action(event, onfullscreen)} aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}><Icon name="fullscreen" size={16} /><span>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button>
	<button type="button" onclick={(event) => action(event, onglass)} aria-label="Adjust liquid glass" aria-haspopup="dialog"><Icon name="settings" size={16} /><span>Glass</span></button>
	<button type="button" onclick={(event) => action(event, onwallpaper)} aria-label="Change wallpaper" aria-haspopup="dialog"><Icon name="desktop" size={16} /><span>Wallpaper</span></button>
	<a href={downloadUrl} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined} onclick={(event) => { event.stopPropagation(); onclose(); }}><Icon name="download" size={16} /><span>Download</span></a>
</nav>

<style>
	.start-shortcuts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); flex: none; gap: 6px; padding-top: 10px; border-top: 1px solid #e9edde16; }
	.start-shortcuts > :is(a, button) { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 6px; min-width: 0; min-height: 40px; padding: 8px 6px; border: 1px solid #e9edde16; border-radius: 8px; background: #eff6df08; color: inherit; text-decoration: none; font: inherit; font-size: 12px; line-height: 1.2; cursor: pointer; }
	.start-shortcuts > :is(a, button):hover { background: #d3e5b021; border-color: #d3e5b044; }
	.start-shortcuts :global(svg) { color: var(--os-accent, #d3e5b0); }
</style>
