<script>
	import { beginSiteReset } from '$lib/utils/reset-core.js';
	import { setAntiClose } from '$lib/utils/cloak.js';
	import Icon from '$lib/utils/browser/icon.svelte';
	let { disabled = false } = $props();
	let confirming = $state(false);
	let starting = $state(false);
	let error = $state('');
	function confirmReset() {
		if (starting) return;
		starting = true; error = '';
		try {
			setAntiClose(false);
			beginSiteReset(window, import.meta.env.VITE_VELORA_S3 === '1' ? '/index.html' : '/');
		} catch {
			error = 'The reset page could not open. Open Settings in a full browser tab and try again.';
			starting = false;
		}
	}
</script>

<div class="subGroup reset-defaults">
	<p class="subHeading">Reset</p>
	<p class="desc">Clear all saved Velora data on this link in this browser, including settings, bookmarks, widgets and notes, favorites, game saves, and proxy sessions.</p>
	<button class="reset-button" onclick={() => (confirming = true)} {disabled}>Reset to all defaults</button>
</div>

{#if confirming}
	<dialog class="reset-confirm" role="alertdialog" aria-labelledby="reset-title" aria-describedby="reset-description" oncancel={event => { if (starting) event.preventDefault(); }} onclose={() => { if (!starting) confirming = false; }}
		{@attach node => {
			const previous = document.activeElement;
			node.showModal(); node.querySelector('[data-cancel]')?.focus();
			return () => { node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
		}}>
		<div class="reset-heading"><h2 id="reset-title">Reset Velora?</h2><button aria-label="Close reset confirmation" disabled={starting} onclick={() => (confirming = false)}><Icon name="close" size={18} /></button></div>
		<p id="reset-description">This permanently deletes all saved data for this Velora link on this browser and returns to a fresh desktop. Export a backup first if you want to keep anything.</p>
		<p class="reset-warning">This cannot be undone. Other links, devices, browser history, and browser permissions are unaffected.</p>
		{#if error}<p class="reset-error" role="alert">{error}</p>{/if}
		<div class="reset-actions"><button data-cancel disabled={starting} onclick={() => (confirming = false)}>Cancel</button><button class="reset-button" disabled={starting} onclick={confirmReset}>{starting ? 'Starting reset…' : 'Reset everything'}</button></div>
	</dialog>
{/if}

<style>
	.reset-defaults { border-top: 1px solid #ffffff15; padding-top: 24px; }
	.reset-button { border: 1px solid #d59a8657; background: #9e4d3d1f; color: #efb6a5; font: inherit; font-size: 12px; border-radius: 9px; padding: 11px 15px; cursor: pointer; }
	.reset-button:hover { background: #9e4d3d35; }
	button:disabled { opacity: .5; cursor: wait; }
	.reset-confirm { width: min(450px, calc(100vw - 30px)); border: 1px solid #d3e5b02a; border-radius: 20px; padding: 25px; background: #202820; color: #f0f2e9; box-shadow: 0 24px 90px #0006; }
	.reset-confirm::backdrop { background: #08110cb3; backdrop-filter: blur(5px); }
	.reset-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
	.reset-heading h2 { margin: 0; font: 550 22px/1.3 system-ui, sans-serif; letter-spacing: -.5px; }
	.reset-heading button { display: grid; place-items: center; padding: 5px; border: 0; color: #c5d0b9; background: none; cursor: pointer; }
	.reset-confirm p { font: 12px/1.75 system-ui, sans-serif; color: #c5d0b9; margin: 0 0 13px; }
	.reset-confirm .reset-warning { color: #dcac9c; }
	.reset-confirm .reset-error { color: #f2b7aa; }
	.reset-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 24px; }
	.reset-actions > button:not(.reset-button) { border: 1px solid #ffffff20; border-radius: 9px; background: #ffffff05; color: #e3e9da; font: inherit; font-size: 12px; padding: 10px 14px; cursor: pointer; }
	.reset-confirm button:focus-visible, .reset-button:focus-visible { outline: 2px solid #d3e5b0; outline-offset: 3px; }
</style>
