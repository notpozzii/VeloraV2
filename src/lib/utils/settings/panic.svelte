<script>
	import { onMount, onDestroy } from 'svelte';
	import { loadSetting, onSettingChange } from '$lib/utils/localspace.js';
	import { saveSettingShared } from '$lib/utils/settingsSync.js';
	import { PANIC_SETTING, defaultPanicPreferences, normalizePanicPreferences, panicDestination, shortcutFromEvent, shortcutLabel } from '$lib/utils/panic-preferences.js';
	let preferences = $state(normalizePanicPreferences(null));
	let destination = $state(defaultPanicPreferences.url);
	let ready = $state(false);
	let recording = $state(false);
	let error = $state('');
	let saved = $state(false);
	let pending = Promise.resolve();
	let stopRecording = () => {};
	onMount(() => {
		let alive = true;
		const apply = value => { preferences = normalizePanicPreferences(value); destination = preferences.url; };
		loadSetting(PANIC_SETTING, null).then(value => { if (alive) apply(value); })
			.catch(() => { if (alive) error = 'Your panic key settings could not be loaded.'; })
			.finally(() => { if (alive) ready = true; });
		const stop = onSettingChange(PANIC_SETTING, apply);
		return () => { alive = false; stop(); };
	});
	onDestroy(() => stopRecording());
	function persist() {
		error = ''; saved = false;
		const value = $state.snapshot(preferences);
		pending = pending.then(() => saveSettingShared(PANIC_SETTING, value)).then(() => { saved = true; })
			.catch(() => { error = 'Settings could not be saved. Try again.'; });
	}
	function record() {
		error = ''; saved = false; recording = true;
		stopRecording();
		const capture = event => {
			event.preventDefault(); event.stopImmediatePropagation();
			if (event.key === 'Escape') { cancel(); return; }
			if (event.repeat || event.isComposing) return;
			const shortcut = shortcutFromEvent(event);
			if (!shortcut) return;
			preferences.shortcut = shortcut;
			cancel(); persist();
		};
		function cancel() { recording = false; stopRecording(); }
		window.addEventListener('keydown', capture, true);
		stopRecording = () => { window.removeEventListener('keydown', capture, true); };
	}
	function saveDestination(event) {
		event.preventDefault();
		const url = panicDestination(destination);
		if (!url) { error = 'Enter an http:// or https:// website address.'; saved = false; return; }
		preferences.url = url; destination = url; persist();
	}
	function reset() {
		recording = false; stopRecording();
		preferences = normalizePanicPreferences(null); destination = preferences.url; persist();
	}
</script>

<div class="settings-card panic-settings">
	<div class="setting-row">
		<div class="setting-copy"><h2>Panic key</h2><p>Instantly switch this tab to another website.</p></div>
		<button class="setting-switch" type="button" role="switch" aria-label="Panic key" aria-checked={preferences.enabled} disabled={!ready}
			onclick={() => { preferences.enabled = !preferences.enabled; persist(); }}><span></span></button>
	</div>
	<div class="setting-row shortcut-row">
		<div class="setting-copy"><h2>Shortcut</h2><p>{recording ? 'Press a key or key combination. Esc cancels.' : 'Single-character keys are ignored while typing.'}</p></div>
		<button class="actionBtn shortcut-button" type="button" aria-label="Change panic key" aria-pressed={recording}
			data-panic-recording={recording ? 'true' : undefined} disabled={!ready} onclick={record}
			onblur={() => { recording = false; stopRecording(); }}>
			{recording ? 'Press a key…' : shortcutLabel(preferences.shortcut)}
		</button>
	</div>
	<form class="panic-destination" onsubmit={saveDestination}>
		<label for="panic-destination">Destination</label>
		<div><input id="panic-destination" class="textInput" type="text" inputmode="url" bind:value={destination} placeholder="https://www.google.com/" disabled={!ready} oninput={() => { saved = false; error = ''; }} /><button class="actionBtn" type="submit" disabled={!ready}>Save</button></div>
	</form>
	<div class="panic-footer"><button class="actionBtn" type="button" onclick={reset} disabled={!ready}>Reset panic key</button><span role="status">{saved ? 'Saved' : ''}</span></div>
	{#if error}<p class="panic-error" role="alert">{error}</p>{/if}
</div>

<style>
	.panic-settings { margin-bottom: 24px; }
	.shortcut-button { min-width: 96px; white-space: nowrap; font-variant-numeric: tabular-nums; }
	.shortcut-button[aria-pressed='true'] { border-color: var(--color-pin); }
	.panic-destination { padding: 0 20px 20px; }
	.panic-destination label { display: block; margin-bottom: 8px; font-size: 13px; }
	.panic-destination > div { display: flex; align-items: center; gap: 10px; }
	.panic-destination input { flex: 1; min-width: 0; width: 100%; }
	.panic-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 0 20px 20px; color: var(--color-text-muted); font-size: 12px; }
	.panic-error { padding: 0 20px 18px; margin: 0; color: #ffb4ab; font-size: 12px; }
	@media(max-width:480px) { .shortcut-row { align-items: flex-start; } .shortcut-button { min-width: 80px; } }
</style>
