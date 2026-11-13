<script>
	import { onMount } from 'svelte';
	import { loadSetting, onSettingChange } from '$lib/utils/localspace.js';
	import { saveSettingShared } from '$lib/utils/settingsSync.js';
	let compact = $state(false);
	let ready = $state(false);
	let saving = $state(false);
	let error = $state('');
	onMount(() => {
		let alive = true;
		loadSetting('compactDock', false).then(value => { if (alive) compact = value === true; })
			.catch(() => { if (alive) error = 'Your dock preference could not be loaded.'; })
			.finally(() => { if (alive) ready = true; });
		const stop = onSettingChange('compactDock', value => { compact = value === true; });
		return () => { alive = false; stop(); };
	});
	async function toggle() {
		const previous = compact;
		compact = !compact;
		saving = true;
		error = '';
		try { await saveSettingShared('compactDock', compact); }
		catch { compact = previous; error = 'Your dock preference could not be saved. Try again.'; }
		finally { saving = false; }
	}
</script>

<div class="settings-card dock-preferences">
	<div class="setting-row">
		<div class="setting-copy"><h2>Compact dock</h2><p>Keep the dock small and expand it on hover. You can also tap to open it.</p></div>
		<button class="setting-switch" type="button" role="switch" aria-label="Compact dock" aria-checked={compact}
			disabled={!ready || saving} onclick={toggle}><span></span></button>
	</div>
	{#if error}<p class="dock-preference-error" role="alert">{error}</p>{/if}
</div>

<style>
	.dock-preferences { margin-bottom: 24px; }
	.dock-preference-error { color: #ffb4ab; font-size: 12px; margin: 0; padding: 0 20px 18px; }
</style>
