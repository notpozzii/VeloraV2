<script>
	import { onMount } from 'svelte';
	import { loadSetting, onSettingChange } from '$lib/utils/localspace.js';
	import { saveSettingShared } from '$lib/utils/settingsSync.js';
	import { DEFAULT_DOCK_HOVER_STRENGTH, DOCK_HOVER_SETTING, normalizeDockHoverStrength } from '$lib/utils/os/dock-settings.js';
	let compact = $state(false);
	let strength = $state(DEFAULT_DOCK_HOVER_STRENGTH);
	let savedStrength = DEFAULT_DOCK_HOVER_STRENGTH;
	let savingStrength = $state(false);
	let pendingStrength = Promise.resolve();
	let strengthSaveId = 0;
	let ready = $state(false);
	let saving = $state(false);
	let error = $state('');
	onMount(() => {
		let alive = true;
		Promise.all([loadSetting('compactDock', false), loadSetting(DOCK_HOVER_SETTING, DEFAULT_DOCK_HOVER_STRENGTH)])
			.then(([value, hover]) => {
				if (alive) { compact = value === true; strength = savedStrength = normalizeDockHoverStrength(hover); }
			})
			.catch(() => { if (alive) error = 'Your dock preference could not be loaded.'; })
			.finally(() => { if (alive) ready = true; });
		const stop = onSettingChange('compactDock', value => { compact = value === true; });
		const stopStrength = onSettingChange(DOCK_HOVER_SETTING, value => {
			if (!savingStrength) strength = savedStrength = normalizeDockHoverStrength(value);
		});
		return () => { alive = false; stop(); stopStrength(); };
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
	function saveStrength() {
		const value = strength;
		const saveId = ++strengthSaveId;
		savingStrength = true;
		error = '';
		pendingStrength = pendingStrength.then(() => saveSettingShared(DOCK_HOVER_SETTING, value))
			.then(() => { savedStrength = value; })
			.catch(() => {
				if (saveId === strengthSaveId) { strength = savedStrength; error = 'Your dock animation preference could not be saved. Try again.'; }
			})
			.finally(() => { if (saveId === strengthSaveId) savingStrength = false; });
	}
</script>

<div class="settings-card dock-preferences">
	<div class="setting-row">
		<div class="setting-copy"><h2>Compact dock</h2><p>Keep the dock small and expand it on hover. You can also tap to open it.</p></div>
		<button class="setting-switch" type="button" role="switch" aria-label="Compact dock" aria-checked={compact}
			disabled={!ready || saving} onclick={toggle}><span></span></button>
	</div>
	<div class="setting-row hover-strength-row">
		<div class="setting-copy"><h2><label for="dock-hover-strength">Dock animation strength</label></h2><p>Adjust how much icons grow and rise on hover. Set to 0% to turn it off.</p></div>
		<div class="hover-strength-control">
			<output for="dock-hover-strength">{strength}%</output>
			<input id="dock-hover-strength" type="range" min="0" max="100" step="1" value={strength}
				aria-valuetext={strength === 0 ? 'Off' : `${strength}%`} disabled={!ready}
				oninput={(event) => { strength = normalizeDockHoverStrength(event.currentTarget.value); }} onchange={saveStrength} />
		</div>
	</div>
	{#if error}<p class="dock-preference-error" role="alert">{error}</p>{/if}
</div>

<style>
	.dock-preferences { margin-bottom: 24px; }
	.hover-strength-control { display: grid; gap: 9px; width: 200px; max-width: 100%; flex-shrink: 0; }
	.hover-strength-control output { text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; color: var(--color-text); }
	.hover-strength-control input { width: 100%; margin: 0; accent-color: var(--color-pin); cursor: pointer; }
	.hover-strength-control input:focus-visible { outline: 2px solid var(--color-pin); outline-offset: 4px; }
	@media(max-width:600px) { .hover-strength-row { flex-direction: column; align-items: stretch; gap: 16px; } .hover-strength-control { width: 100%; } }
	.dock-preference-error { color: #ffb4ab; font-size: 12px; margin: 0; padding: 0 20px 18px; }
</style>
